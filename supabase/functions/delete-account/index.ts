// Permanently deletes the calling user's account and every trace of it:
// the paid subscription at Stripe, storage files, all row data, and the
// auth.users record. Irreversible.
// Auth: the caller's JWT is verified; a user can only delete themselves.
//
// La version épinglée est explicite (`@2.58.0`) et non plus `@2` : cette
// fonction tourne avec le rôle de service, donc avec les pleins pouvoirs sur
// la base. Une plage de versions y fait entrer, sans revue et sans build, le
// code que le registre servira demain.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const cors = {
  // L'appel n'aboutit qu'avec un jeton porteur valide dans l'en-tête
  // `Authorization` — jamais un cookie — donc aucune origine tierce ne peut le
  // déclencher au nom de quelqu'un. L'astérisque reste néanmoins large : on le
  // restreint au domaine du produit, avec un repli permissif seulement si la
  // variable n'est pas renseignée (déploiements de préversion).
  "Access-Control-Allow-Origin": Deno.env.get("PUBLIC_SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Résilie l'abonnement Stripe, IMMÉDIATEMENT.
 *
 * Sans cette étape, supprimer son compte laissait l'abonnement vivant chez
 * Stripe : la personne continuait d'être prélevée pour un compte qui n'existe
 * plus, et le webhook suivant ne trouvait plus aucune ligne à mettre à jour.
 *
 * Rend `true` dès lors que l'abonnement n'est PLUS ACTIF à la sortie — ce qui
 * inclut « il n'existe déjà plus ». Une résiliation déjà faite n'est pas une
 * erreur : elle est le résultat recherché.
 *
 * Rend `false` UNIQUEMENT sur un échec réel (réseau, clé invalide, 5xx). Dans
 * ce cas on interrompt : effacer les données alors que la facturation continue
 * est le pire des deux mondes, parce qu'on perd le lien qui permettrait de la
 * retrouver.
 */
async function cancelStripeSubscription(subscriptionId: string): Promise<boolean> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    // Aucune clé configurée = ce déploiement n'encaisse pas. Il n'y a rien à
    // résilier, et bloquer la suppression pour autant serait absurde.
    console.warn("[delete-account] STRIPE_SECRET_KEY missing — skipping cancellation");
    return true;
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${key}` },
    });

    if (res.ok) return true;

    const body = await res.json().catch(() => null);
    const code = body?.error?.code;
    // `resource_missing` : Stripe ne connaît pas cet abonnement (déjà résilié,
    // purgé, ou identifiant issu d'un autre environnement). Rien à faire.
    if (res.status === 404 || code === "resource_missing") return true;
    // Un abonnement déjà annulé répond 400 sur une seconde annulation. Même
    // conclusion : l'état voulu est atteint.
    if (res.status === 400 && /canceled|cancelled/i.test(body?.error?.message ?? "")) return true;

    console.error("[delete-account] Stripe cancellation failed", res.status, body?.error?.message);
    return false;
  } catch (e) {
    console.error("[delete-account] Stripe cancellation threw", e);
    return false;
  }
}

/**
 * Tous les fichiers d'un préfixe, PAGINÉS.
 *
 * `list()` plafonne à 100 par défaut et à 1 000 au maximum. La version
 * précédente demandait 1 000 et s'arrêtait là : au-delà, les captures d'écran
 * survivaient à la suppression du compte — des données personnelles conservées
 * après une demande d'effacement.
 */
/** La part du client Storage dont cette fonction dépend — déclarée plutôt
 *  qu'`any`, pour qu'un changement d'API se voie ici et pas en production. */
interface StorageLister {
  storage: {
    from(bucket: string): {
      list(
        prefix: string,
        options: { limit: number; offset: number },
      ): Promise<{
        data: { name?: string; id?: string | null }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}

async function listAllFiles(
  admin: StorageLister,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });
    if (error) {
      console.error("[delete-account] storage list failed", prefix, error.message);
      break;
    }
    const files = data ?? [];
    for (const f of files) {
      // Une entrée sans `id` est un DOSSIER, pas un fichier : la supprimer
      // n'aurait aucun effet et masquerait son contenu.
      if (f.name && f.id) out.push(`${prefix}/${f.name}`);
    }
    if (files.length < pageSize) break;
    // Garde-fou : un préfixe anormalement gros ne doit pas faire tourner la
    // fonction jusqu'au timeout de la plateforme.
    if (out.length >= 50_000) {
      console.warn("[delete-account] storage listing capped at 50000 files for", prefix);
      break;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Missing authentication" }, 401);

    // Identify the caller from their JWT — they can only ever delete themselves.
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: uErr,
    } = await userClient.auth.getUser(token);
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);
    const uid = user.id;

    const admin = createClient(url, service);

    // 1. LA FACTURATION D'ABORD. Tant que l'abonnement Stripe vit, la ligne
    //    `subscriptions` est le seul endroit qui porte son identifiant : la
    //    supprimer avant de résilier reviendrait à perdre la seule référence
    //    permettant d'arrêter les prélèvements.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (sub?.stripe_subscription_id) {
      const canceled = await cancelStripeSubscription(sub.stripe_subscription_id);
      if (!canceled) {
        // On n'efface RIEN. La personne réessaiera, ou le support résiliera à
        // la main — dans les deux cas le compte est encore là pour le faire.
        return json(
          {
            error:
              "Your subscription could not be cancelled right now, so the account was not deleted. Please try again in a few minutes.",
          },
          502,
        );
      }
    }

    // 2. Storage: remove every screenshot the user uploaded.
    const bucket = "trade-screenshots";
    const toRemove: string[] = [];
    for (const prefix of [uid, `${uid}/missed`]) {
      toRemove.push(...(await listAllFiles(admin, bucket, prefix)));
    }
    // `remove()` accepte un lot limité : on découpe.
    for (let i = 0; i < toRemove.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(toRemove.slice(i, i + 100));
      if (error) console.error("[delete-account] storage remove failed", error.message);
    }

    // 3. Row data across every table keyed to the user.
    //
    //    La plupart de ces tables sont déjà en `on delete cascade` depuis
    //    `auth.users` : ces suppressions explicites sont une ceinture en plus
    //    de la bretelle, et elles couvrent les tables qui n'ont pas la clé
    //    étrangère. La liste suit `docs/development/DATABASE.md` ; toute
    //    nouvelle table portant `user_id` doit y être ajoutée.
    const userTables = [
      "trades",
      "missed_opportunities",
      "push_subscriptions",
      "notifications",
      "six_month_goals",
      "goal_plans",
      "habits",
      "user_preferences",
      "ai_memory",
      "ai_reports",
      "ai_rate_limits",
      "ai_agent_runs",
      "ai_jobs",
      "ai_embeddings",
      "agent_proposals",
      "detected_patterns",
      "trading_sessions",
      "trade_intent",
      "trade_reflection",
      "simulation_scenarios",
      "monthly_reports",
      "email_log",
      "promo_redemptions",
      "subscriptions",
      "accounts",
    ];
    for (const table of userTables) {
      const { error } = await admin.from(table).delete().eq("user_id", uid);
      // Une table absente (migration pas encore appliquée) ne doit pas empêcher
      // la suppression du compte : on journalise et on continue.
      if (error) console.error("[delete-account] delete failed", table, error.message);
    }
    await admin.from("profiles").delete().eq("id", uid);

    // 4. The auth account itself. This is the point of no return.
    const { error: dErr } = await admin.auth.admin.deleteUser(uid);
    if (dErr) return json({ error: dErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
