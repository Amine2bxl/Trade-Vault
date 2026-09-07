import { describe, expect, test } from "bun:test";
import type { CalendarEvent } from "../src/modules/economic-calendar/types";
import {
  alertesEconomiquesImminentes,
  reglesEconomiques,
  PREAVIS_MIN,
} from "../src/modules/notifications/economic";

/**
 * LES ALERTES DU CALENDRIER ÉCONOMIQUE.
 *
 * ── POURQUOI CE FICHIER ─────────────────────────────────────────────────────
 *
 * `NotificationKind` déclarait `"economic_event"` et la boîte de réception
 * avait son filtre « Économie » — mais aucune règle n'émettait jamais cette
 * notification. Le calendrier vivait dans sa page, et nulle part ailleurs.
 *
 * C'est pourtant la seule donnée du produit qui soit à la fois DATÉE et
 * EXTERNE : le trader ne peut pas la déduire de son journal, et elle a une
 * heure limite. Tout le reste peut attendre qu'il ouvre la page.
 *
 * Le mode d'échec d'une alerte datée est le SPAM : évaluée toutes les minutes,
 * une règle mal bornée produit soixante notifications pour une seule
 * publication — et le trader coupe tout. Ces tests fixent donc surtout ce qui
 * NE doit pas déclencher.
 */

const MAINTENANT = new Date("2026-03-10T12:00:00Z");

function ev(partial: Partial<CalendarEvent> & { startsAt: string }): CalendarEvent {
  return {
    id: `e-${partial.startsAt}-${partial.title ?? "x"}`,
    currency: "USD",
    country: "United States",
    title: "Non-Farm Payrolls",
    impact: "high",
    previous: "150K",
    forecast: "180K",
    actual: null,
    allDay: false,
    source: "test",
    ...partial,
  } as CalendarEvent;
}

/** Un événement à `min` minutes de MAINTENANT. */
const dans = (min: number) => new Date(MAINTENANT.getTime() + min * 60_000).toISOString();

describe("ce qui déclenche", () => {
  test("les deux préavis existent, du plus lointain au plus proche", () => {
    expect([...PREAVIS_MIN]).toEqual([60, 15]);
  });

  test("une publication à fort impact dans une heure alerte", () => {
    const a = alertesEconomiquesImminentes([ev({ startsAt: dans(58) })], MAINTENANT);
    expect(a.length).toBe(1);
    expect(a[0].preavis).toBe(60);
  });

  test("la même à quinze minutes alerte de nouveau, sous une AUTRE clé", () => {
    // Deux préavis, deux rappels : celui qui décide de sortir et celui qui est
    // déjà en position n'ont pas besoin du même message. Sans clés distinctes,
    // le second serait avalé par la déduplication du premier.
    const publication = ev({ startsAt: dans(60), id: "nfp-mars" });
    // La même publication, vue à deux moments : c'est l'HEURE qui change, pas
    // l'événement.
    const r60 = reglesEconomiques([publication], MAINTENANT);
    const r15 = reglesEconomiques([publication], new Date(MAINTENANT.getTime() + 46 * 60_000));
    expect(r60[0].key).not.toBe(r15[0].key);
    // Comparaison EXACTE plutôt qu'un suffixe : elle vérifie du même coup que
    // la clé porte bien l'identifiant de l'événement, ce qu'un `toEndWith`
    // laissait passer.
    expect(r60[0].key).toBe("economic_event:nfp-mars:60");
    expect(r15[0].key).toBe("economic_event:nfp-mars:15");
  });

  test("le rappel de quinze minutes est le SEUL à pouvoir sonner", () => {
    // Un push est la seule notification qui interrompt vraiment. Un événement
    // daté à un quart d'heure est le cas le plus légitime du produit ; une
    // heure avant, un toast suffit.
    const [r60] = reglesEconomiques([ev({ startsAt: dans(58) })], MAINTENANT);
    const [r15] = reglesEconomiques([ev({ startsAt: dans(14) })], MAINTENANT);
    expect(r60.input.channels).not.toContain("push");
    expect(r15.input.channels).toContain("push");
  });

  test("la plus urgente passe devant", () => {
    const a = alertesEconomiquesImminentes(
      [ev({ startsAt: dans(58), title: "CPI" }), ev({ startsAt: dans(12), title: "NFP" })],
      MAINTENANT,
    );
    expect(a.map((x) => x.event.title)).toEqual(["NFP", "CPI"]);
  });
});

describe("ce qui se tait", () => {
  test("un impact moyen ou faible n'alerte jamais", () => {
    // Le calendrier publie des dizaines d'événements par jour. Les alerter tous
    // revient à n'en alerter aucun.
    for (const impact of ["medium", "low"] as const) {
      const a = alertesEconomiquesImminentes([ev({ startsAt: dans(14), impact })], MAINTENANT);
      expect(a, impact).toEqual([]);
    }
  });

  test("un événement PASSÉ n'a plus de préavis à donner", () => {
    // Le signaler ferait douter de tous les autres.
    expect(alertesEconomiquesImminentes([ev({ startsAt: dans(-5) })], MAINTENANT)).toEqual([]);
    expect(alertesEconomiquesImminentes([ev({ startsAt: dans(0) })], MAINTENANT)).toEqual([]);
  });

  test("un événement « toute la journée » ne se compte pas en minutes", () => {
    const a = alertesEconomiquesImminentes([ev({ startsAt: dans(14), allDay: true })], MAINTENANT);
    expect(a).toEqual([]);
  });

  test("entre les deux préavis, silence", () => {
    // 40 minutes : hors de la fenêtre des 60 (déjà passée) et loin des 15.
    expect(alertesEconomiquesImminentes([ev({ startsAt: dans(40) })], MAINTENANT)).toEqual([]);
    // Et bien avant, rien non plus.
    expect(alertesEconomiquesImminentes([ev({ startsAt: dans(240) })], MAINTENANT)).toEqual([]);
  });

  test("un même événement ne porte JAMAIS deux préavis d'un coup", () => {
    // C'est le mode d'échec le plus coûteux : deux alertes simultanées pour la
    // même publication, et le trader coupe les notifications.
    for (let min = 1; min <= 90; min++) {
      const a = alertesEconomiquesImminentes([ev({ startsAt: dans(min) })], MAINTENANT);
      expect(a.length, `${min} min`).toBeLessThanOrEqual(1);
    }
  });

  test("réévaluer en boucle ne multiplie pas les alertes", () => {
    // La règle tourne à chaque ouverture de l'application. Ce qui bouge dans la
    // vraie vie, c'est L'HEURE — pas l'événement : on fixe donc la publication
    // et on avance la montre minute par minute à travers la fenêtre des 60.
    //
    // La clé porte l'identifiant de l'événement ET le préavis : toutes ces
    // évaluations produisent donc la MÊME clé, que la déduplication du moteur
    // reconnaît. Une clé dérivée de l'heure courante donnerait soixante
    // notifications pour une seule publication — et le trader coupe tout.
    const publication = ev({ startsAt: dans(60), id: "nfp-mars" });
    const clés = new Set<string>();
    for (let ecoule = 0; ecoule <= 9; ecoule++) {
      const montre = new Date(MAINTENANT.getTime() + ecoule * 60_000);
      for (const r of reglesEconomiques([publication], montre)) clés.add(r.key);
    }
    expect(clés.size).toBe(1);
    expect([...clés][0]).toBe("economic_event:nfp-mars:60");
  });
});

describe("ce que l'alerte transporte", () => {
  test("elle range dans la catégorie « économie » et pointe vers le calendrier", () => {
    // Le filtre « Économie » de la boîte de réception existait sans jamais
    // pouvoir se remplir.
    const [r] = reglesEconomiques([ev({ startsAt: dans(14) })], MAINTENANT);
    expect(r.input.category).toBe("economic");
    expect(r.input.url).toBe("/economic-news");
    expect(r.input.data?.ctaPage).toBe("economic-news");
  });

  test("elle porte les chiffres attendus, pas seulement un titre", () => {
    // Prévision et précédent sont ce qui permet de juger l'écart à la
    // publication : sans eux, l'alerte dit « attention » sans dire à quoi.
    const [r] = reglesEconomiques([ev({ startsAt: dans(14) })], MAINTENANT);
    expect(r.input.data?.forecast).toBe("180K");
    expect(r.input.data?.previous).toBe("150K");
    expect(r.input.data?.currency).toBe("USD");
  });
});
