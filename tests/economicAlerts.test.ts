import { describe, expect, test } from "bun:test";
import type { CalendarEvent } from "../src/modules/economic-calendar/types";
import {
  alertesEconomiquesImminentes,
  reglesEconomiques,
  PREAVIS_MIN,
} from "../src/modules/notifications/economic";
import { shouldInterrupt } from "../src/modules/notifications/policy";

/**
 * LES ALERTES DU CALENDRIER ÉCONOMIQUE — le seul popup du produit.
 *
 * Une heure avant une annonce à fort impact, sur une devise que le trader
 * trade vraiment. Le mode d'échec d'une alerte datée est le SPAM : évaluée
 * toutes les cinq minutes, une règle mal bornée produit douze notifications
 * pour une seule publication — et le trader coupe tout. Ces tests fixent donc
 * surtout ce qui NE doit pas déclencher.
 */

const MAINTENANT = new Date("2026-03-10T12:00:00Z");

function ev(partial: Partial<CalendarEvent> & { startsAt: string }): CalendarEvent {
  return {
    id: `e-${partial.startsAt}-${partial.title ?? "x"}-${partial.currency ?? "USD"}`,
    currency: "USD",
    country: "United States",
    title: "Non-Farm Payrolls",
    impact: "high",
    previous: "150K",
    forecast: "180K",
    actual: null,
    allDay: false,
    source: "forexfactory",
    ...partial,
  } as CalendarEvent;
}

/** Un événement à `min` minutes de MAINTENANT. */
const dans = (min: number) => new Date(MAINTENANT.getTime() + min * 60_000).toISOString();

describe("ce qui déclenche", () => {
  test("un seul préavis : une heure", () => {
    expect(PREAVIS_MIN).toBe(60);
  });

  test("une publication à fort impact dans une heure alerte", () => {
    const a = alertesEconomiquesImminentes([ev({ startsAt: dans(58) })], MAINTENANT);
    expect(a.length).toBe(1);
    expect(a[0].preavis).toBe(60);
    expect(a[0].restant).toBe(58);
  });

  test("la fenêtre tient quinze minutes : évaluée toutes les cinq, rien n'est manqué", () => {
    for (const min of [46, 50, 55, 60]) {
      expect(
        alertesEconomiquesImminentes([ev({ startsAt: dans(min) })], MAINTENANT).length,
        `${min}`,
      ).toBe(1);
    }
  });

  test("la plus proche passe devant", () => {
    const a = alertesEconomiquesImminentes(
      [ev({ startsAt: dans(58), title: "CPI" }), ev({ startsAt: dans(48), title: "NFP" })],
      MAINTENANT,
    );
    expect(a.map((x) => x.event.title)).toEqual(["NFP", "CPI"]);
  });

  test("annonces simultanées d'une même devise : UNE alerte qui les nomme", () => {
    const [r, ...reste] = reglesEconomiques(
      [
        ev({ startsAt: dans(55), title: "CPI m/m", id: "a" }),
        ev({ startsAt: dans(55), title: "Core CPI m/m", id: "b" }),
      ],
      MAINTENANT,
    );
    expect(reste).toEqual([]);
    expect(r.input.title).toContain("CPI m/m + Core CPI m/m");
    expect(r.input.data?.titles).toEqual(["CPI m/m", "Core CPI m/m"]);
  });

  test("elle est la SEULE à ouvrir un popup", () => {
    const [r] = reglesEconomiques([ev({ startsAt: dans(55) })], MAINTENANT);
    expect(shouldInterrupt({ kind: r.input.kind, data: r.input.data })).toBe(true);
    // Une alerte grave du journal attend dans la boîte, même juste après un trade.
    expect(shouldInterrupt({ kind: "risk_loss_streak", data: {} })).toBe(false);
    expect(shouldInterrupt({ kind: "discipline_limit", data: undefined })).toBe(false);
    expect(shouldInterrupt({ kind: "economic_event", data: {} })).toBe(false);
  });

  test("elle peut sonner sur le téléphone, jamais en toast", () => {
    const [r] = reglesEconomiques([ev({ startsAt: dans(55) })], MAINTENANT);
    expect(r.input.channels).toEqual(["dashboard", "push"]);
  });
});

describe("seulement ce que le trader trade", () => {
  const usd = ev({ startsAt: dans(55), currency: "USD", title: "CPI" });
  const jpy = ev({ startsAt: dans(55), currency: "JPY", title: "BoJ Rate" });
  const eur = ev({ startsAt: dans(50), currency: "EUR", title: "ECB Rate" });

  test("un trader de NQ (USD) ne reçoit pas la BoJ", () => {
    const a = alertesEconomiquesImminentes([usd, jpy, eur], MAINTENANT, { currencies: ["USD"] });
    expect(a.map((x) => x.event.currency)).toEqual(["USD"]);
  });

  test("un trader d'EUR/USD reçoit les deux devises de sa paire", () => {
    const a = alertesEconomiquesImminentes([usd, jpy, eur], MAINTENANT, {
      currencies: ["EUR", "USD"],
    });
    expect(a.map((x) => x.event.currency).sort()).toEqual(["EUR", "USD"]);
  });

  test("sans devise connue, l'USD — la plus tradée du produit", () => {
    const a = alertesEconomiquesImminentes([usd, jpy], MAINTENANT, { currencies: [] });
    expect(a.map((x) => x.event.currency)).toEqual(["USD"]);
  });

  test("à même échéance, la devise la plus tradée d'abord", () => {
    const a = alertesEconomiquesImminentes([usd, jpy], MAINTENANT, {
      currencies: ["USD", "JPY"],
      share: { USD: 0.3, JPY: 0.7 },
    });
    expect(a.map((x) => x.event.currency)).toEqual(["JPY", "USD"]);
  });

  test("l'exposition chiffrée voyage avec l'alerte", () => {
    const [r] = reglesEconomiques([usd], MAINTENANT, false, {
      currencies: ["USD"],
      share: { USD: 0.8 },
    });
    expect(r.input.data?.exposure).toBe(0.8);
    expect(r.input.body).toContain("80%");
  });
});

describe("ce qui se tait", () => {
  test("un impact moyen ou faible n'alerte jamais", () => {
    for (const impact of ["medium", "low"] as const) {
      const a = alertesEconomiquesImminentes([ev({ startsAt: dans(55), impact })], MAINTENANT);
      expect(a, impact).toEqual([]);
    }
  });

  test("une heure approximative (repli intégré) n'alerte jamais", () => {
    const a = alertesEconomiquesImminentes(
      [ev({ startsAt: dans(55), source: "builtin" })],
      MAINTENANT,
    );
    expect(a).toEqual([]);
  });

  test("un événement PASSÉ ou trop proche n'a plus de préavis à donner", () => {
    for (const min of [-5, 0, 14, 30, 45]) {
      expect(
        alertesEconomiquesImminentes([ev({ startsAt: dans(min) })], MAINTENANT),
        `${min}`,
      ).toEqual([]);
    }
  });

  test("bien avant l'heure, rien", () => {
    expect(alertesEconomiquesImminentes([ev({ startsAt: dans(61) })], MAINTENANT)).toEqual([]);
    expect(alertesEconomiquesImminentes([ev({ startsAt: dans(240) })], MAINTENANT)).toEqual([]);
  });

  test("un événement « toute la journée » ne se compte pas en minutes", () => {
    const a = alertesEconomiquesImminentes([ev({ startsAt: dans(55), allDay: true })], MAINTENANT);
    expect(a).toEqual([]);
  });

  test("réévaluer en boucle ne multiplie pas les alertes", () => {
    // On fixe la publication et on avance la montre à travers la fenêtre :
    // toutes les évaluations produisent la MÊME clé, que la déduplication
    // reconnaît.
    const publication = ev({ startsAt: dans(60), id: "nfp-mars" });
    const clés = new Set<string>();
    for (let ecoule = 0; ecoule <= 14; ecoule++) {
      const montre = new Date(MAINTENANT.getTime() + ecoule * 60_000);
      for (const r of reglesEconomiques([publication], montre)) clés.add(r.key);
    }
    expect([...clés]).toEqual(["economic_event:nfp-mars:60"]);
  });
});

describe("ce que l'alerte transporte", () => {
  test("catégorie « économie », lien vers la page Calendrier (id `news`)", () => {
    const [r] = reglesEconomiques([ev({ startsAt: dans(55) })], MAINTENANT);
    expect(r.input.category).toBe("economic");
    expect(r.input.url).toBe("/news");
    expect(r.input.data?.ctaPage).toBe("news");
  });

  test("les chiffres attendus et un plan d'action, pas seulement un titre", () => {
    const [r] = reglesEconomiques([ev({ startsAt: dans(55) })], MAINTENANT, true);
    expect(r.input.data?.forecast).toBe("180K");
    expect(r.input.data?.previous).toBe("150K");
    expect(r.input.data?.currency).toBe("USD");
    expect(typeof r.input.data?.plan).toBe("string");
    expect(r.input.title).toContain("dans 55 min");
  });
});
