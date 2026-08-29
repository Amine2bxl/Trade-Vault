import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * La suppression de compte est une fonction Deno (`Deno.serve`, `Deno.env`) :
 * elle ne s'exécute pas sous `bun test`. Ce qui est vérifié ici, ce sont ses
 * INVARIANTS DE SOURCE — ceux dont la violation ne casserait aucun autre test,
 * ne serait signalée par aucun typecheck, et coûterait de l'argent réel à des
 * gens qui ont demandé à partir.
 *
 * Même convention que `tests/proposalAccept.test.ts`, pour la même raison.
 */

const SOURCE = readFileSync(
  resolve(import.meta.dir, "../supabase/functions/delete-account/index.ts"),
  "utf8",
);

const at = (needle: string): number => {
  const i = SOURCE.indexOf(needle);
  expect(i, `introuvable dans la source : ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe("suppression de compte — la facturation d'abord", () => {
  test("l'abonnement Stripe est RÉSILIÉ, pas seulement oublié", () => {
    // Le défaut d'origine : la ligne `subscriptions` était supprimée et
    // l'abonnement continuait de vivre chez Stripe. La personne était prélevée
    // pour un compte qui n'existait plus.
    expect(SOURCE).toContain("cancelStripeSubscription");
    expect(SOURCE).toContain("https://api.stripe.com/v1/subscriptions/");
    expect(SOURCE).toContain('method: "DELETE"');
  });

  test("la résiliation précède TOUTE suppression de données", () => {
    // L'ordre est la garantie : `subscriptions` porte le seul identifiant qui
    // permet d'arrêter les prélèvements. Le supprimer d'abord, c'est perdre la
    // capacité de résilier.
    const cancel = at("await cancelStripeSubscription(");
    const storage = at("listAllFiles(admin, bucket, prefix)");
    const rows = at("for (const table of userTables)");
    const authDelete = at("admin.auth.admin.deleteUser(uid)");

    expect(cancel).toBeLessThan(storage);
    expect(cancel).toBeLessThan(rows);
    expect(cancel).toBeLessThan(authDelete);
  });

  test("un abonnement DÉJÀ résilié n'empêche pas la suppression", () => {
    // Stripe répond 404 / `resource_missing` sur un abonnement inconnu et 400
    // sur une seconde annulation. Les deux sont l'état recherché, pas un échec :
    // les traiter comme des erreurs rendrait le compte indestructible.
    const fn = SOURCE.slice(
      at("async function cancelStripeSubscription"),
      at("* Tous les fichiers"),
    );
    expect(fn).toContain("resource_missing");
    expect(fn).toContain("res.status === 404");
    expect(fn).toMatch(/canceled\|cancelled/);
  });

  test("un échec RÉEL de résiliation interrompt la suppression", () => {
    // Effacer les données pendant que la facturation continue est le pire des
    // deux mondes : on perd le lien qui permettrait de la retrouver.
    const guard = SOURCE.slice(at("const canceled = await cancelStripeSubscription"));
    expect(guard).toContain("if (!canceled)");
    expect(guard.slice(0, guard.indexOf("// 2."))).toContain("502");
  });

  test("l'absence de clé Stripe ne bloque pas un déploiement qui n'encaisse pas", () => {
    const fn = SOURCE.slice(
      at("async function cancelStripeSubscription"),
      at("* Tous les fichiers"),
    );
    expect(fn).toContain('Deno.env.get("STRIPE_SECRET_KEY")');
    expect(fn).toMatch(/if \(!key\)[\s\S]{0,400}return true;/);
  });
});

describe("suppression de compte — effacement complet", () => {
  test("le listage du stockage est PAGINÉ", () => {
    // `list()` plafonne à 1000. La version d'origine demandait 1000 et
    // s'arrêtait là : au-delà, des captures d'écran survivaient à une demande
    // d'effacement.
    const fn = SOURCE.slice(at("async function listAllFiles"), at("Deno.serve"));
    expect(fn).toContain("offset");
    expect(fn).toContain("for (let offset = 0;");
    expect(fn).toContain("if (files.length < pageSize) break;");
  });

  test("les dossiers ne sont pas confondus avec des fichiers", () => {
    const fn = SOURCE.slice(at("async function listAllFiles"), at("Deno.serve"));
    expect(fn).toContain("f.name && f.id");
  });

  test("la suppression des fichiers est découpée en lots", () => {
    expect(SOURCE).toContain("toRemove.slice(i, i + 100)");
  });

  test("toutes les tables portant `user_id` sont couvertes", () => {
    // Ces tables étaient absentes de la liste d'origine. La plupart sont en
    // `on delete cascade`, mais la liste explicite est la ceinture qui protège
    // celles qui ne le sont pas.
    for (const table of [
      "trading_sessions",
      "trade_intent",
      "trade_reflection",
      "detected_patterns",
      "agent_proposals",
      "ai_agent_runs",
      "ai_jobs",
      "ai_embeddings",
      "simulation_scenarios",
      "promo_redemptions",
    ]) {
      expect(SOURCE, `table absente de l'effacement : ${table}`).toContain(`"${table}"`);
    }
  });

  test("le compte d'authentification est supprimé en DERNIER", () => {
    // C'est le point de non-retour : après lui, `uid` ne désigne plus rien et
    // aucune des suppressions précédentes ne pourrait être rattrapée.
    expect(at("admin.auth.admin.deleteUser(uid)")).toBeGreaterThan(
      at("for (const table of userTables)"),
    );
  });

  test("une table absente n'interrompt pas la suppression", () => {
    // Une migration pas encore appliquée ne doit pas rendre un compte
    // indestructible : on journalise et on continue.
    const loop = SOURCE.slice(
      at("for (const table of userTables)"),
      at("admin.auth.admin.deleteUser"),
    );
    expect(loop).toContain("console.error");
    expect(loop).not.toContain("return json");
  });
});

describe("suppression de compte — surface d'attaque", () => {
  test("l'appelant est identifié par son propre jeton", () => {
    expect(SOURCE).toContain("userClient.auth.getUser(token)");
    expect(SOURCE).toContain("const uid = user.id;");
    // Aucun identifiant ne vient du corps de la requête : on ne peut supprimer
    // que soi-même.
    expect(SOURCE).not.toMatch(/req\.json\(\)/);
  });

  test("la dépendance est épinglée à une version exacte", () => {
    // Cette fonction tourne avec le rôle de service. Une plage de versions y
    // ferait entrer, sans revue et sans build, le code servi demain.
    expect(SOURCE).toMatch(/esm\.sh\/@supabase\/supabase-js@\d+\.\d+\.\d+/);
    expect(SOURCE).not.toMatch(/esm\.sh\/@supabase\/supabase-js@\d+"/);
  });

  test("l'origine CORS suit le domaine du produit", () => {
    expect(SOURCE).toContain('Deno.env.get("PUBLIC_SITE_URL")');
  });
});
