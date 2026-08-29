import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * L'ordre des opérations du checkout.
 *
 * `handleCheckout` est un handler HTTP qui parle à Stripe et à Supabase : il ne
 * s'exécute pas ici. Mais l'essentiel de sa correction N'EST PAS dans ce qu'il
 * calcule — c'est dans l'ORDRE dans lequel il agit. Réserver après avoir donné
 * l'accès, c'est un `max_uses` inopérant ; ne pas rendre la réservation quand
 * Stripe échoue, c'est un code à durée limitée grignoté par les pannes réseau.
 * Aucun typecheck et aucun test unitaire ne voit ces deux inversions.
 */

const read = (p: string) => readSource(import.meta.dir, p);
const code = stripComments;

const BILLING = read("../src/backend/billing.server.ts");
const PROMO = read("../src/backend/promo.server.ts");

const idx = (haystack: string, needle: string): number => {
  const i = haystack.indexOf(needle);
  expect(i, `introuvable : ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe("l'API PostgREST réellement disponible", () => {
  test("aucun appel à `.onConflict()` ou `.ignore()` — ces méthodes n'existent pas", () => {
    // Le bug d'origine, et le seul du dépôt : `postgrest-js` v2 n'expose
    // `onConflict` que comme OPTION d'`upsert`, jamais comme méthode chaînée.
    // TypeScript ne l'a pas vu parce que le client est typé `any`. Ce test est
    // le garde-fou qui manquait.
    for (const [name, source] of [
      ["billing.server.ts", code(BILLING)],
      ["promo.server.ts", code(PROMO)],
    ] as const) {
      expect(source.includes(".onConflict("), `${name} rappelle une méthode inexistante`).toBe(
        false,
      );
      expect(source.includes(".ignore()"), `${name} rappelle une méthode inexistante`).toBe(false);
    }
  });

  test("les upserts passent bien l'option `onConflict`", () => {
    // La forme correcte, pour que le test précédent ne se contente pas
    // d'interdire sans exiger.
    expect(BILLING).toContain('{ onConflict: "user_id" }');
    expect(PROMO).toContain('{ onConflict: "user_id" }');
  });
});

describe("parcours influenceur — accès permanent sans paiement", () => {
  const branch = BILLING.slice(
    idx(BILLING, 'if (app.status === "granted")'),
    idx(BILLING, 'if (app.status === "discount")'),
  );

  test("l'usage est RÉSERVÉ avant que l'accès ne soit ouvert", () => {
    // Réserver après, c'est découvrir que le code est épuisé une fois l'accès
    // déjà donné — il n'y a alors plus rien à refuser.
    expect(idx(branch, "reservePromoRedemption")).toBeLessThan(idx(branch, "grantPromoAccess"));
  });

  test("un refus de la base ferme le parcours au lieu de l'ouvrir", () => {
    expect(branch).toContain("if (!redemptionGrantsAccess(outcome))");
    expect(branch).toContain("invalid promo code");
  });

  test("une panne de base répond 503, jamais un accès offert par défaut", () => {
    expect(branch).toMatch(/outcome === "error"[\s\S]{0,120}503/);
  });

  test("un octroi qui échoue REND l'usage réservé", () => {
    // Sinon la personne perd sa place sans rien avoir obtenu.
    const failure = branch.slice(idx(branch, "if (!granted.ok)"));
    expect(idx(failure, "releasePromoRedemption")).toBeLessThan(idx(failure, "grant failed"));
  });
});

describe("parcours réduction communauté", () => {
  const branch = BILLING.slice(
    idx(BILLING, 'if (app.status === "discount")'),
    idx(BILLING, 'app.status === "not_app"'),
  );

  test("l'usage est réservé AVANT l'ouverture de la session Stripe", () => {
    expect(idx(branch, "reservePromoRedemption")).toBeLessThan(idx(branch, "openCheckoutSession"));
  });

  test("un échec Stripe rend l'usage réservé", () => {
    const failure = branch.slice(idx(branch, "} catch (e) {"));
    expect(failure).toContain("releasePromoRedemption");
  });

  test("l'URL de checkout est bien renvoyée", () => {
    // La régression d'origine : la session était créée, puis l'appel suivant
    // levait, et l'URL n'atteignait jamais le navigateur. Le paiement à prix
    // réduit était purement et simplement impossible.
    expect(branch).toContain("return json({ url });");
  });
});

describe("openCheckoutSession — un seul constructeur de session", () => {
  test("les métadonnées d'attribution sont TOUJOURS posées", () => {
    // C'est la seule chose que le webhook a pour rattacher l'abonnement à un
    // compte. Il y avait deux constructeurs de session et ils avaient déjà
    // divergé sur ce point.
    const fn = BILLING.slice(idx(BILLING, "async function openCheckoutSession"));
    expect(fn).toContain('"subscription_data[metadata][user_id]": opts.userId');
    expect(fn).toContain('"subscription_data[metadata][plan]": opts.plan');
  });

  test("il n'existe plus qu'un seul constructeur", () => {
    expect(BILLING).not.toContain("export async function createCheckoutSession");
    expect(BILLING.match(/"\/checkout\/sessions"/g) ?? []).toHaveLength(1);
  });

  test("coupon applicatif et promotion code ne sont jamais envoyés ensemble", () => {
    // Stripe refuse les deux à la fois : les combiner ferait échouer chaque
    // checkout portant un code du dashboard sur un compte déjà remisé.
    const fn = BILLING.slice(idx(BILLING, "async function openCheckoutSession"));
    expect(fn).toMatch(
      /if \(opts\.couponId\)[\s\S]{0,160}else if \(opts\.promotionCodeId\)[\s\S]{0,160}else /,
    );
  });

  test("une session sans URL est une erreur, pas un `undefined` renvoyé au navigateur", () => {
    expect(BILLING).toContain("checkout session without a url");
  });
});

describe("webhooks — robustesse aux rejeux", () => {
  test("plus aucun `update().eq(user_id)` pour projeter un abonnement", () => {
    // Un `update` sans ligne cible répond « succès » : c'était la perte
    // silencieuse d'un paiement.
    expect(BILLING).not.toMatch(/\.from\("subscriptions"\)\s*\.update\(/);
  });

  test("Stripe passe par la fonction idempotente et ordonnée", () => {
    expect(BILLING).toContain("await applySubscriptionEvent(sb, {");
    expect(BILLING).toContain("eventAt: eventTimestamp(event.created)");
    expect(BILLING).toContain('skipped: "out-of-order event"');
  });

  test("un échec de traitement RETIRE la marque d'idempotence", () => {
    // Sinon la retransmission du fournisseur est dédoublonnée comme « déjà
    // traitée » et l'événement — un abonnement payé — est perdu pour toujours.
    const CRYPTO = read("../src/backend/crypto-pay.server.ts");
    for (const [name, source, provider] of [
      ["stripe", BILLING, '"stripe"'],
      ["coinbase", CRYPTO, '"coinbase"'],
    ] as const) {
      const catchBlock = source.slice(idx(source, "} catch (e) {"));
      expect(catchBlock, `${name}: la marque doit être retirée`).toContain(
        '.from("processed_webhook_events")',
      );
      expect(catchBlock).toContain(".delete()");
      expect(catchBlock).toContain(provider);
    }
  });

  test("crypto : une charge déjà créditée n'ajoute pas une seconde période", () => {
    // La prolongation n'est pas idempotente par nature. `crypto_charge_id` est
    // la clé qui la rend sûre même si le dédoublonnage échoue ouvert.
    const CRYPTO = read("../src/backend/crypto-pay.server.ts");
    expect(CRYPTO).toContain("sub?.crypto_charge_id === charge.id");
    expect(CRYPTO).toContain("charge already credited");
    // La vérification doit précéder le calcul de la nouvelle date de fin.
    expect(idx(CRYPTO, "charge already credited")).toBeLessThan(idx(CRYPTO, "const periodEnd ="));
  });
});

describe("expiration des périodes payées", () => {
  const LIFECYCLE = read("../src/backend/lifecycle-emails.server.ts");

  test("le balayage quotidien couvre crypto, comp et promo", () => {
    expect(LIFECYCLE).toContain('.in("source", ["crypto", "comp", "promo"])');
  });

  test("Stripe est explicitement EXCLU du balayage", () => {
    // Stripe pilote son propre cycle de vie ; une seconde autorité sur la même
    // donnée produirait un état qui oscille.
    expect(LIFECYCLE).not.toMatch(/\.in\("source", \[[^\]]*"stripe"/);
    const ENTITLEMENT = read("../src/domain/entitlement.ts");
    expect(ENTITLEMENT).toContain('if (row.source === "stripe") return false;');
  });

  test("la décision revient au prédicat partagé, pas au filtre SQL", () => {
    expect(LIFECYCLE).toContain("if (!needsExpiry(row)) continue;");
  });

  test("l'écriture est gardée contre une réouverture concurrente", () => {
    // Si un paiement rouvre l'accès entre la lecture et l'écriture, le balayage
    // ne doit surtout pas le refermer.
    const sweep = LIFECYCLE.slice(idx(LIFECYCLE, "for (const row of lapsedPaid ?? [])"));
    expect(sweep).toContain('.eq("status", "active")');
    expect(sweep).toContain('.eq("current_period_end", row.current_period_end)');
  });
});
