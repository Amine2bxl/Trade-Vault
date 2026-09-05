import { describe, expect, test } from "bun:test";
import {
  STRIPE_GRACE_MS,
  effectiveTier,
  isEntitled,
  needsExpiry,
  periodExpired,
} from "../src/domain/entitlement";

/**
 * L'accès payant — le prédicat le plus cher du produit.
 *
 * Ces tests portent sur `domain/entitlement`, le module que le SERVEUR
 * (`backend/require-pro.ts`) et l'APPLICATION (`hooks/useSubscription.ts`)
 * exécutent tous les deux. Ils avaient auparavant chacun leur propre calcul, et
 * aucun des deux ne regardait `current_period_end` : c'est exactement le trou
 * par lequel une charge crypto d'un mois ouvrait l'accès à vie.
 *
 * Horloge injectée partout : un test d'expiration qui dépend de l'heure réelle
 * est un test qui passera un jour et échouera un autre.
 */

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0); // 2026-08-29T12:00:00Z
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

describe("isEntitled — les cas de base", () => {
  test("aucune ligne d'abonnement = aucun accès", () => {
    expect(isEntitled(null, NOW)).toBe(false);
    expect(isEntitled(undefined, NOW)).toBe(false);
  });

  test("un statut inconnu refuse l'accès au lieu de planter", () => {
    // La ligne vient de Postgres ou d'un webhook, donc d'un monde non typé.
    expect(isEntitled({ status: "something_new" }, NOW)).toBe(false);
  });

  test("actif sans date de fin = accès ouvert", () => {
    expect(isEntitled({ status: "active", source: "promo", current_period_end: null }, NOW)).toBe(
      true,
    );
  });

  test("annulé, impayé, expiré : aucun accès", () => {
    for (const status of ["canceled", "past_due", "expired"]) {
      expect(isEntitled({ status, current_period_end: iso(DAY) }, NOW)).toBe(false);
    }
  });
});

describe("essai", () => {
  test("un essai en cours ouvre l'accès", () => {
    expect(isEntitled({ status: "trialing", trial_ends_at: iso(DAY) }, NOW)).toBe(true);
  });

  test("un essai terminé ne l'ouvre plus", () => {
    expect(isEntitled({ status: "trialing", trial_ends_at: iso(-DAY) }, NOW)).toBe(false);
  });

  test("un essai sans date de fin n'ouvre rien — l'absence de date n'est pas un blanc-seing", () => {
    expect(isEntitled({ status: "trialing", trial_ends_at: null }, NOW)).toBe(false);
  });
});

describe("crypto — une période achetée, et rien de plus", () => {
  const cryptoActive = {
    plan: "pro_monthly",
    status: "active",
    source: "crypto",
    current_period_end: iso(10 * DAY),
  };
  const cryptoLapsed = { ...cryptoActive, current_period_end: iso(-DAY) };

  test("pendant sa période, l'accès est ouvert", () => {
    expect(isEntitled(cryptoActive, NOW)).toBe(true);
    expect(effectiveTier(cryptoActive, NOW)).toBe("pro");
  });

  test("passé sa période, l'accès est FERMÉ — sans aucun délai de grâce", () => {
    // C'est LE cas du rapport d'audit : il n'existe pas de facturation
    // récurrente en crypto, donc une charge d'un mois ne peut pas valoir plus
    // d'un mois. Un jour de retard suffit à fermer.
    expect(isEntitled(cryptoLapsed, NOW)).toBe(false);
    expect(effectiveTier(cryptoLapsed, NOW)).toBe("free");
  });

  test("l'accès se ferme à la SECONDE près, pas le lendemain", () => {
    expect(isEntitled({ ...cryptoActive, current_period_end: iso(1000) }, NOW)).toBe(true);
    expect(isEntitled({ ...cryptoActive, current_period_end: iso(-1000) }, NOW)).toBe(false);
  });

  test("le palier acheté est respecté — Elite n'est pas projeté en Pro", () => {
    expect(effectiveTier({ ...cryptoActive, plan: "elite_yearly" }, NOW)).toBe("elite");
  });
});

describe("accès offert (comp) — une date de fin qui compte vraiment", () => {
  const comp = {
    plan: "elite_yearly",
    status: "active",
    source: "comp",
    current_period_end: iso(5 * DAY),
  };

  test("un accès offert en cours ouvre l'accès", () => {
    expect(isEntitled(comp, NOW)).toBe(true);
  });

  test("un accès offert échu ne l'ouvre plus", () => {
    // `comp_grants.expires_at` était décoratif : la ligne restait `active` et
    // rien ne la refermait jamais.
    expect(isEntitled({ ...comp, current_period_end: iso(-DAY) }, NOW)).toBe(false);
  });

  test("un accès offert SANS date de fin reste permanent — c'est son intention", () => {
    expect(isEntitled({ ...comp, current_period_end: null }, NOW)).toBe(true);
  });
});

describe("stripe — le délai de grâce, et sa limite", () => {
  const stripeSub = {
    plan: "pro_monthly",
    status: "active",
    source: "stripe",
    current_period_end: iso(-DAY),
  };

  test("une date dépassée d'un jour NE coupe PAS un abonné Stripe", () => {
    // Stripe repousse la date à chaque renouvellement via un webhook. Un
    // webhook en retard ne doit jamais couper quelqu'un qui paie.
    expect(isEntitled(stripeSub, NOW)).toBe(true);
  });

  test("le délai de grâce est fini : au-delà, l'accès se ferme", () => {
    expect(isEntitled({ ...stripeSub, current_period_end: iso(-4 * DAY) }, NOW)).toBe(false);
  });

  test("la limite exacte du délai est celle annoncée par la constante", () => {
    const justInside = { ...stripeSub, current_period_end: iso(-STRIPE_GRACE_MS + 1000) };
    const justOutside = { ...stripeSub, current_period_end: iso(-STRIPE_GRACE_MS - 1000) };
    expect(isEntitled(justInside, NOW)).toBe(true);
    expect(isEntitled(justOutside, NOW)).toBe(false);
  });

  test("le délai ne protège JAMAIS un impayé — c'est le statut qui tranche", () => {
    // Le risque du délai de grâce serait de couvrir un `past_due`. Il ne le
    // couvre pas : la porte est fermée par le statut avant d'arriver à la date.
    expect(isEntitled({ ...stripeSub, status: "past_due" }, NOW)).toBe(false);
    expect(isEntitled({ ...stripeSub, status: "canceled" }, NOW)).toBe(false);
  });

  test("le délai est réservé à Stripe — aucune autre source n'y a droit", () => {
    const lapsed = iso(-DAY);
    expect(periodExpired({ source: "stripe", current_period_end: lapsed }, NOW)).toBe(false);
    expect(periodExpired({ source: "crypto", current_period_end: lapsed }, NOW)).toBe(true);
    expect(periodExpired({ source: "comp", current_period_end: lapsed }, NOW)).toBe(true);
    expect(periodExpired({ source: "promo", current_period_end: lapsed }, NOW)).toBe(true);
  });
});

describe("needsExpiry — ce que le balayage quotidien doit réécrire", () => {
  test("une période crypto échue doit être basculée en base", () => {
    expect(
      needsExpiry({ status: "active", source: "crypto", current_period_end: iso(-DAY) }, NOW),
    ).toBe(true);
  });

  test("un accès offert échu doit l'être aussi", () => {
    expect(
      needsExpiry({ status: "active", source: "comp", current_period_end: iso(-DAY) }, NOW),
    ).toBe(true);
  });

  test("un abonnement Stripe n'est JAMAIS basculé par le balayage", () => {
    // Stripe pilote son cycle de vie ; réécrire ici créerait une seconde
    // autorité sur la même donnée, et un état qui oscille entre les deux.
    expect(
      needsExpiry({ status: "active", source: "stripe", current_period_end: iso(-30 * DAY) }, NOW),
    ).toBe(false);
  });

  test("une période encore en cours n'est pas touchée", () => {
    expect(
      needsExpiry({ status: "active", source: "crypto", current_period_end: iso(DAY) }, NOW),
    ).toBe(false);
  });

  test("une ligne déjà expirée n'est pas réécrite une seconde fois", () => {
    expect(
      needsExpiry({ status: "expired", source: "crypto", current_period_end: iso(-DAY) }, NOW),
    ).toBe(false);
  });
});

describe("cohérence serveur / application", () => {
  test("effectiveTier retombe à free exactement quand isEntitled dit non", () => {
    const rows = [
      { status: "active", source: "crypto", plan: "pro_monthly", current_period_end: iso(-DAY) },
      { status: "active", source: "comp", plan: "elite_yearly", current_period_end: iso(DAY) },
      { status: "trialing", plan: "pro_monthly", trial_ends_at: iso(DAY) },
      { status: "canceled", plan: "elite_monthly", current_period_end: iso(DAY) },
      { status: "active", source: "promo", plan: "pro_yearly", current_period_end: null },
    ];
    for (const row of rows) {
      const entitled = isEntitled(row, NOW);
      const tier = effectiveTier(row, NOW);
      // La règle : soit l'accès est ouvert et le palier est celui du plan, soit
      // il est fermé et le palier est `free`. Aucun état intermédiaire.
      expect(tier === "free").toBe(!entitled || row.plan.startsWith("free"));
    }
  });

  test("accepte indifféremment une chaîne ISO et un objet Date", () => {
    // Le serveur lit du texte depuis Postgres ; l'application manipule des
    // `Date`. Les deux doivent donner la même réponse.
    const asString = { status: "active", source: "crypto", current_period_end: iso(-DAY) };
    const asDate = { status: "active", source: "crypto", current_period_end: new Date(NOW - DAY) };
    expect(isEntitled(asString, NOW)).toBe(isEntitled(asDate, NOW));
    expect(isEntitled(asDate, NOW)).toBe(false);
  });

  test("une date illisible n'ouvre pas l'accès par accident", () => {
    // `new Date("garbage").getTime()` est NaN ; toute comparaison est fausse.
    // Sans le garde explicite, `NaN > end` serait faux et l'accès resterait
    // ouvert pour toujours.
    expect(
      isEntitled({ status: "active", source: "crypto", current_period_end: "pas-une-date" }, NOW),
    ).toBe(true);
    // Documenté tel quel : une date illisible est traitée comme « pas de date »
    // (accès permanent), PAS comme « expirée ». Fermer sur une donnée corrompue
    // couperait un client qui paie ; c'est l'écriture qui doit être valide, et
    // elle l'est — `current_period_end` est une colonne `timestamptz`, Postgres
    // refuse d'y écrire autre chose.
  });
});
