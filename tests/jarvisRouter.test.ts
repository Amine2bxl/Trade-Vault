import { describe, expect, test } from "bun:test";
import {
  extractPeriods,
  extractSymbols,
  mergeModelRoute,
  normalizeQuestion,
  routeQuestion,
  type RouteDomain,
} from "../src/modules/ai/router/route";
import { classifyQuestion } from "../src/app/features/jarvis/intent";
import { detectMemoryIntent } from "../src/modules/ai/memory-select";

/**
 * LOT 2 — LE ROUTEUR UNIFIÉ.
 *
 * Une seule compréhension de la question sert trois usages qui avaient chacun
 * leur classifieur : les étapes affichées (`intent.ts`), la sélection des
 * souvenirs (`memory-select.ts`) et, désormais, le choix des données et du
 * niveau de modèle. Ces tests figent les scénarios de la spécification : se
 * tromper ici, c'est envoyer le journal sur « salut » ou rien sur « pourquoi
 * je perds le lundi ».
 *
 * `today` est FIXÉ : le routeur ne lit jamais l'horloge quand on lui donne la
 * date, ce qui rend ces cas identiques sous tous les fuseaux de la CI.
 */

const TODAY = "2026-10-01";
const route = (q: string) => routeQuestion(q, { today: TODAY });

const JOURNAL: RouteDomain[] = [
  "identity",
  "trade",
  "day",
  "performance",
  "comparison",
  "mistakes",
  "psychology",
  "risk",
  "plan",
  "rules",
  "goals",
  "sessions",
  "patterns",
];
const touchesJournal = (d: readonly RouteDomain[]) => d.some((x) => JOURNAL.includes(x));

describe("scénarios de la spécification", () => {
  test.each([
    "What is TradeVault?",
    "What does the free plan include?",
    "How does Seasonality work?",
    "Comment fonctionne Seasonality dans TradeVault ?",
    "combien coûte l'abonnement pro ?",
  ])("« %s » → produit, sans lire le journal", (q) => {
    const r = route(q);
    expect(r.primary).toBe("product");
    expect(touchesJournal(r.domains)).toBe(false);
    expect(r.tier).toBe(1);
  });

  test.each([
    "What are today's important news?",
    "What news affects NQ today?",
    "What's coming in the next two hours?",
    "Quelles sont les news importantes aujourd'hui pour le NQ ?",
  ])("« %s » → marché seul : « aujourd'hui » y est une date de calendrier", (q) => {
    const r = route(q);
    expect(r.domains).toEqual(["market"]);
    expect(r.tier).toBe(1);
  });

  test("l'horizon et le symbole d'une question marché sont extraits", () => {
    expect(route("What's coming in the next two hours?").entities.horizonHours).toBe(2);
    expect(route("What news affects NQ today?").entities.symbols).toEqual(["NQ"]);
  });

  test("marché croisé avec le journal → les deux, en diagnostic", () => {
    const r = route("Did economic news affect my losses today?");
    expect(r.domains).toContain("market");
    expect(r.domains).toContain("day");
    expect(r.domains).toContain("performance");
    expect(r.tier).toBe(3);
  });

  test("« pourquoi j'ai perdu aujourd'hui » → la journée, avec un raisonnement", () => {
    const r = route("Why did I lose today?");
    expect(r.domains).toEqual(["day", "performance"]);
    expect(r.asksWhy).toBe(true);
    expect(r.entities.period).toMatchObject({ since: TODAY, until: TODAY, granularity: "day" });
    expect(r.uiIntent).toBe("day");
  });

  test("« pourquoi je perds autant le lundi » → schéma par jour de semaine", () => {
    const r = route("Pourquoi je perds autant le lundi ?");
    expect(r.domains).toContain("patterns");
    expect(r.entities.weekdays).toEqual([1]);
    expect(r.tier).toBe(3);
  });

  test("« ma plus grosse erreur ce mois-ci » → erreurs sur le mois en cours", () => {
    const r = route("What is my biggest mistake this month?");
    expect(r.domains).toContain("mistakes");
    // Le 1er du mois, « ce mois » ne compte qu'une date — ce n'est PAS une journée.
    expect(r.entities.period).toMatchObject({ since: TODAY, until: TODAY, granularity: "month" });
    expect(r.domains).not.toContain("day");
  });

  test("« ce qui a changé entre août et septembre » → comparaison chronologique", () => {
    const r = route("What changed between August and September?");
    expect(r.domains).toContain("comparison");
    expect(r.tier).toBe(3);
    expect(r.entities.comparison?.map((p) => `${p.since}..${p.until}`)).toEqual([
      "2026-08-01..2026-08-31",
      "2026-09-01..2026-09-30",
    ]);
  });

  test.each(["Do I follow my trading plan?", "Est-ce que je respecte mon Trading Plan ?"])(
    "« %s » → tenue du plan (journal, pas produit)",
    (q) => {
      const r = route(q);
      expect(r.domains).toContain("plan");
      expect(r.domains).not.toContain("product");
      expect(r.tier).toBe(3);
      expect(r.memoryIntent).toBe("discipline");
    },
  );

  test("« mes pertes sont-elles concentrées sur certaines sessions » → sessions + schémas", () => {
    const r = route("Are my losses concentrated around specific sessions?");
    expect(r.domains).toContain("sessions");
    expect(r.domains).toContain("patterns");
    expect(r.tier).toBe(3);
  });

  test("« analyse complète » → revue profonde, niveau 4", () => {
    const r = route("Fais-moi une analyse complète de mon trading");
    expect(r.tier).toBe(4);
    for (const d of ["performance", "patterns", "mistakes"] as RouteDomain[])
      expect(r.domains).toContain(d);
  });

  test("« et si je risquais moitié moins » → simulation", () => {
    const r = route("Et si je risquais moitié moins ?");
    expect(r.domains).toContain("simulation");
    expect(r.uiIntent).toBe("risk");
  });

  test("« qu'est-ce que j'avais noté le 12 » → le 12 du mois écoulé, une journée", () => {
    const r = route("Qu'est-ce que j'avais noté le 12 ?");
    expect(r.domains).toEqual(["day"]);
    expect(r.entities.period).toMatchObject({ since: "2026-09-12", until: "2026-09-12" });
  });
});

describe("pas de journal sans raison", () => {
  test.each(["salut", "merci", "hello", "bonjour !"])("« %s » → bavardage", (q) => {
    const r = route(q);
    expect(r.domains).toEqual(["smalltalk"]);
    expect(r.tier).toBe(1);
  });

  test("une définition générale reste générale", () => {
    const r = route("c'est quoi le drawdown ?");
    expect(r.domains).toEqual(["knowledge"]);
    expect(r.tier).toBe(1);
  });

  test("une question non reconnue n'est PAS rabattue sur le journal", () => {
    const r = route("Peux-tu m'en dire plus là-dessus stp ?");
    expect(touchesJournal(r.domains)).toBe(false);
    expect(r.ambiguous).toBe(true);
  });

  test("« c'est quoi mon nom » → identité, une lecture simple", () => {
    const r = route("c'est quoi mon nom ?");
    expect(r.domains).toEqual(["identity"]);
    expect(r.tier).toBe(1);
  });
});

describe("entités", () => {
  test("mois nommé sans année : le plus récent déjà commencé", () => {
    const [p] = extractPeriods(normalizeQuestion("combien j'ai perdu en mars ?"), TODAY);
    expect(p).toMatchObject({ since: "2026-03-01", until: "2026-03-31", granularity: "month" });
    const [nov] = extractPeriods(normalizeQuestion("et en novembre ?"), TODAY);
    expect(nov.since).toBe("2025-11-01");
  });

  test("hier, cette semaine, ce mois", () => {
    const [hier] = extractPeriods(normalizeQuestion("hier"), TODAY);
    expect(hier).toMatchObject({ since: "2026-09-30", until: "2026-09-30", granularity: "day" });
    const [mois] = extractPeriods(normalizeQuestion("this month"), "2026-10-15");
    expect(mois).toMatchObject({ since: "2026-10-01", until: "2026-10-15", granularity: "month" });
  });

  test("« may » anglais n'est pas un mois sans préposition ni année", () => {
    expect(
      extractPeriods(normalizeQuestion("I may lose today"), TODAY).map((p) => p.label),
    ).not.toContain("may");
    expect(route("I may lose today").entities.period).toMatchObject({ since: TODAY, until: TODAY });
  });

  test("symboles : instruments connus, pas les mots courants", () => {
    expect(extractSymbols("Combien sur NQ et XAUUSD ?").sort()).toEqual(["NQ", "XAUUSD"]);
    expect(extractSymbols("I AM SO TIRED OK")).toEqual([]);
  });

  test("le routeur ne dépend pas du fuseau quand la date est fournie", () => {
    const a = routeQuestion("Why did I lose yesterday?", { today: "2026-03-01" });
    expect(a.entities.period).toMatchObject({ since: "2026-02-28", until: "2026-02-28" });
  });
});

describe("compatibilité : un seul routeur pour trois usages", () => {
  test("les étapes affichées et l'intention mémoire en dérivent", () => {
    for (const q of [
      "Why did I lose today?",
      "j'ai peur de perdre encore",
      "Do I follow my trading plan?",
      "salut",
    ]) {
      expect(classifyQuestion(q)).toBe(routeQuestion(q).uiIntent);
      expect(detectMemoryIntent(q)).toBe(routeQuestion(q).memoryIntent);
    }
  });
});

describe("résolution d'ambiguïté par un petit modèle", () => {
  test("seuls les domaines de la taxonomie sont retenus", () => {
    const base = route("Peux-tu m'en dire plus là-dessus stp ?");
    const merged = mergeModelRoute(base, { domains: ["performance", "hack_the_db"], tier: 2 });
    expect(merged.domains).toEqual(["performance"]);
    expect(merged.ambiguous).toBe(false);
    expect(merged.signals).toContain("model-routed");
  });

  test("une proposition vide ou illisible laisse la route intacte", () => {
    const base = route("Peux-tu m'en dire plus là-dessus stp ?");
    expect(mergeModelRoute(base, null)).toBe(base);
    expect(mergeModelRoute(base, { domains: ["nope"] })).toBe(base);
  });

  test("le petit modèle ne peut pas ouvrir le niveau le plus cher", () => {
    const base = route("Peux-tu m'en dire plus là-dessus stp ?");
    expect(mergeModelRoute(base, { domains: ["patterns"], tier: 4 }).tier).toBe(3);
  });
});
