/**
 * LES BALAYAGES QUI SURVIVENT AU TIMEOUT.
 *
 * Les crons « une opération par utilisateur » — rapport mensuel, scan de
 * patterns — étaient écrits comme une boucle séquentielle dans UNE SEULE
 * invocation :
 *
 *     const { data } = await sb.from("trades").select("user_id").gte(…)
 *     for (const userId of [...new Set(...)]) await work(userId)
 *
 * Trois défauts, chacun invisible en production :
 *
 *  1. Le `select` n'avait aucune limite, donc PostgREST le tronquait à
 *     `db.max_rows` (1 000 chez Supabase). Au-delà de quelques centaines de
 *     trades sur la fenêtre, la majorité des comptes disparaissait du balayage
 *     — sans erreur, sans journal.
 *  2. La boucle appelait un modèle par utilisateur, en série, dans une fonction
 *     serverless bornée en durée. À ~3 s par compte, le plafond était atteint
 *     entre vingt et cent utilisateurs. Passé ce point, le cron mourait au
 *     milieu.
 *  3. Rien ne reprenait. Un rapport mensuel perdu l'était pour un mois.
 *
 * Ce module apporte les trois pièces manquantes : une pagination EXACTE (par
 * curseur sur `user_id`, via `users_with_trades_since`), un BUDGET DE TEMPS qui
 * s'arrête avant que la plateforme ne coupe, et un CHAÎNAGE qui relance
 * l'invocation suivante là où la précédente s'est arrêtée.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = any;

/**
 * Budget de temps d'une invocation, en millisecondes.
 *
 * `maxDuration` vaut 300 s pour la fonction serveur (posé par `vite.config.ts`
 * via le preset Nitro, et vérifiable dans
 * `.vercel/output/functions/__server.func/.vc-config.json`). On s'arrête
 * bien avant : il faut qu'il reste de quoi écrire l'état, lancer le maillon
 * suivant et répondre. Un cron coupé net par la plateforme ne laisse aucune
 * trace de l'endroit où il en était.
 */
export const CRON_TIME_BUDGET_MS = Number(process.env.CRON_TIME_BUDGET_MS ?? "240000");

/** Utilisateurs traités par page. Assez grand pour limiter les allers-retours,
 *  assez petit pour que le curseur avance souvent. */
export const CRON_PAGE_SIZE = 200;

/**
 * Combien d'utilisateurs traiter EN PARALLÈLE.
 *
 * Deux, pas dix : chaque unité de travail fait plusieurs requêtes Supabase et,
 * pour les rapports, un appel modèle. Paralléliser trop transforme un cron en
 * pic de charge sur la base et en rafale de quota chez le fournisseur d'IA —
 * on gagnerait du temps mural en échangeant contre des échecs.
 */
const CONCURRENCY = 2;

export interface BatchOptions {
  /** Début de la fenêtre — `YYYY-MM-DD`. */
  since: string;
  /** Reprise : dernier `user_id` traité par l'invocation précédente. */
  after?: string | null;
  /** Horloge de départ, pour le budget de temps. */
  startedAt?: number;
  /**
   * Budget de temps de CETTE invocation, en millisecondes.
   *
   * Injectable plutôt que constant : les deux crons n'ont pas le même coût par
   * utilisateur (un appel modèle pour un rapport, quatre requêtes pour un scan),
   * et surtout un budget non injectable n'est pas testable — on ne peut pas
   * laisser un test attendre quatre minutes pour observer l'arrêt.
   */
  budgetMs?: number;
}

export interface BatchResult {
  /** Utilisateurs réellement traités par CETTE invocation. */
  processed: number;
  /** Échecs individuels — un compte qui échoue n'emporte jamais les autres. */
  failed: number;
  /** Dernier utilisateur traité. `null` quand il n'y en avait aucun. */
  lastUserId: string | null;
  /** Vrai s'il reste du travail : l'appelant doit alors chaîner. */
  hasMore: boolean;
}

/**
 * Une page d'identifiants d'utilisateurs actifs sur la fenêtre.
 *
 * Passe par la fonction SQL `users_with_trades_since` : elle rend des
 * identifiants DISTINCTS et TRIÉS, donc la pagination par curseur ne peut ni
 * dupliquer ni sauter quelqu'un — ce qu'un `select user_id` brut, dédoublonné
 * en mémoire après troncature, ne pouvait pas garantir.
 *
 * Replie sur la requête directe si la fonction n'est pas encore déployée : le
 * code peut atteindre la production avant la migration, et un cron qui refuse
 * de tourner ce jour-là est pire qu'un cron partiel.
 */
export async function pageOfActiveUsers(
  sb: AnyClient,
  since: string,
  after: string | null,
  limit: number = CRON_PAGE_SIZE,
): Promise<string[]> {
  const { data, error } = await sb.rpc("users_with_trades_since", {
    p_since: since,
    p_after: after,
    p_limit: limit,
  });
  if (!error) {
    return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  }

  console.warn("[cron] users_with_trades_since unavailable, falling back", error);
  let query = sb
    .from("trades")
    .select("user_id")
    .gte("trade_date", since)
    .order("user_id", { ascending: true })
    // Le repli lit des lignes de trades, pas des utilisateurs : on demande
    // large pour espérer couvrir `limit` personnes distinctes, et on borne
    // quand même — c'est l'absence de borne qui faisait la troncature muette.
    .limit(limit * 20);
  if (after) query = query.gt("user_id", after);
  const { data: rows, error: fallbackError } = await query;
  if (fallbackError) throw fallbackError;
  const seen: string[] = [];
  for (const row of (rows ?? []) as { user_id: string }[]) {
    if (seen[seen.length - 1] !== row.user_id) seen.push(row.user_id);
    if (seen.length >= limit) break;
  }
  return seen;
}

/**
 * Traite les utilisateurs actifs, page par page, dans un budget de temps.
 *
 * S'arrête pour deux raisons seulement : plus personne à traiter, ou budget
 * épuisé. Dans le second cas, `hasMore` est vrai et `lastUserId` dit où
 * reprendre — c'est à l'appelant de chaîner (`chainNextInvocation`).
 */
export async function runUserBatch(
  sb: AnyClient,
  opts: BatchOptions,
  work: (userId: string) => Promise<void>,
): Promise<BatchResult> {
  const startedAt = opts.startedAt ?? Date.now();
  const budgetMs = opts.budgetMs ?? CRON_TIME_BUDGET_MS;
  let after = opts.after ?? null;
  let processed = 0;
  let failed = 0;
  let lastUserId: string | null = null;

  for (;;) {
    const page = await pageOfActiveUsers(sb, opts.since, after);
    if (page.length === 0) {
      return { processed, failed, lastUserId, hasMore: false };
    }

    for (let i = 0; i < page.length; i += CONCURRENCY) {
      // Budget vérifié AVANT chaque groupe : on préfère un groupe de moins à
      // une coupure au milieu d'une écriture.
      if (Date.now() - startedAt > budgetMs) {
        return { processed, failed, lastUserId, hasMore: true };
      }
      const group = page.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(group.map((id) => work(id)));
      results.forEach((r, k) => {
        if (r.status === "fulfilled") processed++;
        else {
          failed++;
          // Un compte qui échoue ne doit pas emporter le passage des autres.
          console.error("[cron] user failed", group[k], r.reason);
        }
        lastUserId = group[k];
      });
      after = group[group.length - 1];
    }

    // Une page plus courte que demandée signifie qu'on a atteint la fin.
    if (page.length < CRON_PAGE_SIZE) {
      return { processed, failed, lastUserId, hasMore: false };
    }
  }
}

/**
 * Relance la même route avec le curseur suivant.
 *
 * POURQUOI ON N'ATTEND PAS LA RÉPONSE. Le maillon suivant fait le même travail
 * que celui-ci : l'attendre ferait tenir toute la chaîne dans la durée d'une
 * seule invocation, ce qui est exactement le problème qu'on résout. On attend
 * seulement que la requête soit PARTIE — au-delà, l'invocation distante vit sa
 * vie, indépendante de notre socket.
 *
 * Le secret de cron est retransmis : le maillon suivant passe la même
 * authentification que le premier, il n'y a pas de porte dérobée.
 */
export async function chainNextInvocation(
  request: Request,
  params: Record<string, string>,
): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const url = new URL(request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  try {
    const dispatched = fetch(url.toString(), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }).catch((e) => {
      console.error("[cron] chained invocation failed to dispatch", e);
    });

    // 1,5 s : largement de quoi établir la connexion et envoyer la requête, et
    // sans rapport avec le temps que mettra le maillon suivant à répondre.
    await Promise.race([dispatched, new Promise((resolve) => setTimeout(resolve, 1500))]);
    return true;
  } catch (e) {
    console.error("[cron] chained invocation threw", e);
    return false;
  }
}

/** Le curseur de reprise porté par l'URL, s'il y en a un. */
export function cursorFrom(request: Request): string | null {
  try {
    return new URL(request.url).searchParams.get("after");
  } catch {
    return null;
  }
}
