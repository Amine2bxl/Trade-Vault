import { describe, expect, test } from "bun:test";
import {
  localDateDaysAgo,
  localDateOf,
  localMonthOf,
  todayLocalDate,
} from "../src/shared/calendar-date";
import { readSource, stripComments } from "./helpers/source";

/**
 * « AUJOURD'HUI », pour un trader.
 *
 * Le produit écrivait `new Date().toISOString().slice(0, 10)` à vingt-quatre
 * endroits. Ce n'est pas aujourd'hui : c'est le jour à Greenwich. Pour un
 * trader à New York, dès 20 h locales, cette expression rend DEMAIN — en pleine
 * séance US. Son compteur de trades du jour repartait à zéro, sa série de
 * discipline se cassait, son brief était daté du lendemain.
 */

describe("localDateOf — la date civile locale", () => {
  test("compose la date à partir des composantes LOCALES", () => {
    // `new Date(2026, 2, 3, 0, 30)` est le 3 mars à 00 h 30 heure locale. Selon
    // le fuseau de la machine, cet instant est le 2 mars en UTC — et c'est
    // précisément ce que l'ancienne expression rendait.
    expect(localDateOf(new Date(2026, 2, 3, 0, 30, 0))).toBe("2026-03-03");
  });

  test("tient jusqu'à la dernière seconde de la journée", () => {
    expect(localDateOf(new Date(2026, 5, 15, 23, 59, 59))).toBe("2026-06-15");
    expect(localDateOf(new Date(2026, 5, 16, 0, 0, 0))).toBe("2026-06-16");
  });

  test("complète mois et jour pour rester triable en tant que texte", () => {
    expect(localDateOf(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(localDateOf(new Date(2026, 10, 30, 12))).toBe("2026-11-30");
    // Comparaison lexicographique = comparaison chronologique. C'est ce qui
    // permet aux filtres de période de comparer des chaînes.
    expect(localDateOf(new Date(2026, 0, 5, 12)) < localDateOf(new Date(2026, 10, 30, 12))).toBe(
      true,
    );
  });

  test("todayLocalDate est localDateOf appliqué à maintenant", () => {
    const now = new Date(2026, 7, 29, 22, 15);
    expect(todayLocalDate(now)).toBe(localDateOf(now));
  });
});

describe("localDateDaysAgo — par le calendrier, pas par 86 400 000", () => {
  test("recule du bon nombre de jours", () => {
    expect(localDateDaysAgo(7, new Date(2026, 7, 29, 12))).toBe("2026-08-22");
    expect(localDateDaysAgo(0, new Date(2026, 7, 29, 12))).toBe("2026-08-29");
  });

  test("traverse correctement un changement de mois et d'année", () => {
    expect(localDateDaysAgo(1, new Date(2026, 0, 1, 12))).toBe("2025-12-31");
    expect(localDateDaysAgo(1, new Date(2026, 2, 1, 12))).toBe("2026-02-28");
  });

  test("« il y a sept jours » reste le MÊME jour de la semaine", () => {
    // C'est la raison du calcul par composantes : sur un changement d'heure,
    // un jour ne fait pas 24 heures, et une soustraction de millisecondes
    // décalerait la fenêtre d'un jour deux fois par an.
    for (const start of [
      new Date(2026, 2, 30, 12), // après le passage à l'heure d'été (Europe)
      new Date(2026, 9, 27, 12), // après le retour à l'heure d'hiver
      new Date(2026, 6, 15, 12),
    ]) {
      const before = new Date(`${localDateDaysAgo(7, start)}T12:00:00`);
      expect(before.getDay()).toBe(start.getDay());
    }
  });
});

describe("localMonthOf", () => {
  test("rend le mois civil local", () => {
    expect(localMonthOf(new Date(2026, 7, 1, 0, 30))).toBe("2026-08");
    expect(localMonthOf(new Date(2026, 7, 31, 23, 30))).toBe("2026-08");
  });
});

describe("aucune date métier ne repasse par UTC", () => {
  /**
   * Les fichiers où « aujourd'hui » ou « ce jour-là » est une notion MÉTIER.
   * Un `toISOString().slice(0, 10)` qui réapparaîtrait ici ramènerait le
   * décalage silencieux que ce travail vient de fermer.
   */
  const BUSINESS_DATE_FILES = [
    "../src/modules/notifications/rules.ts",
    "../src/modules/notifications/engine.ts",
    "../src/shared/ui/StreakCalendar.tsx",
    "../src/app/hooks/useEdgeScore.ts",
    "../src/app/utils/ruleAdherence.ts",
    "../src/app/utils/tradeFilter.ts",
    "../src/app/utils/checklistStreak.ts",
    "../src/app/utils/behavioral.ts",
    "../src/app/utils/exportCsv.ts",
    "../src/app/utils/previewTrades.ts",
    "../src/app/utils/demoTrades.ts",
    "../src/app/pages/checklist/helpers.ts",
    "../src/app/pages/MissedOpportunities.tsx",
    "../src/app/pages/Goals.tsx",
    "../src/app/pages/Inbox.tsx",
    "../src/app/components/jarvis/workspaces/HomeWorkspace.tsx",
    "../src/app/components/jarvis/workspaces/ConversationWorkspace.tsx",
  ];

  for (const file of BUSINESS_DATE_FILES) {
    test(`${file.replace("../src/", "")} n'utilise plus la date UTC`, () => {
      const code = stripComments(readSource(import.meta.dir, file));
      expect(code.includes("toISOString().slice(0, 10)")).toBe(false);
      expect(code.includes("toISOString().slice(0,10)")).toBe(false);
    });
  }

  test("les deux exceptions UTC sont volontaires et documentées", () => {
    // `windowStart` n'a qu'un appelant, le cron de scan de patterns, qui tourne
    // sur le serveur : il n'y existe aucun fuseau « local » qui voudrait dire
    // quelque chose, et une borne dépendante du fuseau de la machine rendrait
    // le balayage non reproductible. Le balayage multi-fuseaux de la suite
    // avait d'ailleurs attrapé la conversion abusive de cette fonction.
    const persist = readSource(import.meta.dir, "../src/modules/patterns/persist.ts");
    expect(persist).toContain("EN UTC, DÉLIBÉRÉMENT");
    expect(persist).toContain("toISOString().slice(0, 10)");
  });

  test("le sitemap, lui, garde UTC — et c'est volontaire", () => {
    // `lastmod` n'appartient à aucun trader, et le serveur n'a pas de fuseau
    // « local » qui voudrait dire quelque chose. L'exception est documentée
    // dans le fichier ; ce test existe pour qu'on ne la « corrige » pas par
    // symétrie.
    const server = readSource(import.meta.dir, "../src/server.ts");
    expect(server).toContain("toISOString().slice(0, 10)");
    expect(server).toContain("UTC est ICI le bon choix");
  });

  test("le compteur d'usage IA et la date de séance parlent du même jour", () => {
    // Trois définitions d'« aujourd'hui » coexistaient : UTC, locale, et le
    // fuseau explicite de la checklist. Les deux premières sont maintenant la
    // même — c'est ce que ce test verrouille.
    const aiUsage = readSource(import.meta.dir, "../src/app/utils/aiUsage.ts");
    const now = new Date(2026, 7, 29, 23, 30);
    // `aiUsage.todayKey` compose la date de la même façon : mêmes composantes
    // locales, même format.
    expect(aiUsage).toContain("d.getFullYear()");
    expect(aiUsage).toContain("d.getMonth() + 1");
    expect(aiUsage).toContain("d.getDate()");
    expect(todayLocalDate(now)).toBe("2026-08-29");
  });
});
