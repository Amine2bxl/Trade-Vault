import { describe, it, expect } from "bun:test";
import {
  selectMemories,
  detectMemoryIntent,
  estimateTokens,
  MEMORY_TOKEN_BUDGET,
  MAX_MEMORY_CHARS,
  MAX_MEMORIES,
  type MemoryLike,
} from "../memory-select";

/**
 * Mémoire de Jarvis — non-régression.
 *
 * Ce module décide de ce que Jarvis « sait » à chaque réponse. Une erreur ici
 * ne provoque pas un crash : elle produit un coach qui parle à côté. C'est
 * précisément le genre de défaut qu'aucun test d'intégration ne rattrape, d'où
 * une couverture exhaustive du scoring ET du budget.
 */

const NOW = Date.parse("2026-08-05T12:00:00Z");
const recent = "2026-08-04T12:00:00Z";
const old = "2026-01-01T12:00:00Z";

const CORPUS: MemoryLike[] = [
  {
    id: "p",
    kind: "profile",
    content: "Trader intraday indices, 3 ans d'expérience.",
    createdAt: old,
  },
  {
    id: "f1",
    kind: "fact",
    content: "Augmente sa taille après deux pertes consécutives.",
    createdAt: recent,
  },
  {
    id: "f2",
    kind: "fact",
    content: "Win rate nettement plus faible le vendredi.",
    createdAt: recent,
  },
  {
    id: "l1",
    kind: "lesson",
    content: "S'est engagé à stopper après une perte.",
    createdAt: recent,
  },
  {
    id: "l2",
    kind: "lesson",
    content: "Règle acceptée : taille fixe, maximum 2 trades.",
    createdAt: recent,
  },
  {
    id: "c1",
    kind: "conversation",
    content: "A demandé un bilan mensuel la semaine dernière.",
    createdAt: old,
  },
];

function ids(list: MemoryLike[]): string[] {
  return list.map((m) => m.id as string);
}

describe("detectMemoryIntent — les scénarios demandés", () => {
  const cases: Array<[string, string]> = [
    ["Je panique après une perte, j'ai peur de reprendre", "psychology"],
    ["Est-ce que je respecte bien ma taille max ?", "discipline"],
    ["Quel est mon win rate ce mois-ci ?", "performance"],
    ["Est-ce que je vais atteindre mon objectif mensuel ?", "goals"],
    ["Quelle règle je devrais m'imposer ?", "rules"],
    ["Raconte-moi un truc", "generic"],
  ];
  for (const [question, expected] of cases) {
    it(`« ${question} » → ${expected}`, () => {
      expect(detectMemoryIntent(question)).toBe(expected);
    });
  }

  it("l'ÉMOTION prime sur la performance quand les deux sont présentes", () => {
    // « peur de perdre » contient un mot de performance ; c'est pourtant
    // l'état mental qui détermine quels souvenirs aident vraiment.
    expect(detectMemoryIntent("j'ai peur de perdre encore")).toBe("psychology");
  });
});

describe("selectMemories — ce que Jarvis retient selon la question", () => {
  it("DISCIPLINE : les engagements passés (lesson) remontent en tête", () => {
    const r = selectMemories(CORPUS, "Est-ce que je respecte ma taille max ?", { now: NOW });
    expect(r.intent).toBe("discipline");
    expect(ids(r.scored.slice(0, 2).map((s) => s.memory))).toContain("l2");
  });

  it("OBJECTIFS : le profil domine — savoir qui est le trader prime", () => {
    const r = selectMemories(CORPUS, "Vais-je atteindre mon objectif ?", { now: NOW });
    expect(r.intent).toBe("goals");
    expect(r.scored[0].memory.kind).toBe("profile");
  });

  it("PERFORMANCE : le fait qui parle du même sujet gagne par recoupement lexical", () => {
    const r = selectMemories(CORPUS, "Pourquoi mon win rate chute le vendredi ?", { now: NOW });
    expect(r.intent).toBe("performance");
    expect(r.scored[0].memory.id).toBe("f2");
    expect(r.scored[0].reason.overlap).toBeGreaterThan(0);
  });

  it("la CONVERSATION reste en dernier — contexte de repli, pas un fait durable", () => {
    const r = selectMemories(CORPUS, "Est-ce que je respecte ma discipline ?", { now: NOW });
    expect(r.scored[r.scored.length - 1].memory.kind).toBe("conversation");
  });

  it("à pertinence égale, le souvenir le plus RÉCENT passe devant", () => {
    const pair: MemoryLike[] = [
      { id: "vieux", kind: "fact", content: "Observation neutre.", createdAt: old },
      { id: "neuf", kind: "fact", content: "Observation neutre.", createdAt: recent },
    ];
    const r = selectMemories(pair, "question sans mot-clé particulier", { now: NOW });
    expect(r.scored[0].memory.id).toBe("neuf");
  });
});

describe("budget de tokens — contrainte DURE", () => {
  it("ne dépasse jamais le budget, même avec un corpus énorme", () => {
    const huge: MemoryLike[] = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
      kind: "fact" as const,
      content: `Souvenir numéro ${i} — ${"détail ".repeat(30)}`,
      createdAt: recent,
    }));
    const r = selectMemories(huge, "discipline et respect du plan", { now: NOW });
    expect(r.tokens).toBeLessThanOrEqual(MEMORY_TOKEN_BUDGET);
    // L'économie face à un envoi intégral doit être massive.
    expect(r.tokensIfUnbounded).toBeGreaterThan(r.tokens * 10);
  });

  it("tronque un souvenir trop long au lieu de le laisser manger le budget", () => {
    const long: MemoryLike[] = [
      { id: "x", kind: "fact", content: "z".repeat(5000), createdAt: recent },
    ];
    const r = selectMemories(long, "performance", { now: NOW });
    expect(r.selected[0].content.length).toBeLessThanOrEqual(MAX_MEMORY_CHARS);
  });

  it("un souvenir COURT n'est pas écarté parce qu'un long l'a précédé", () => {
    // Régression : une boucle qui s'arrête au premier dépassement perdrait le
    // fait court et pertinent placé juste après le long.
    const mix: MemoryLike[] = [
      { id: "long", kind: "lesson", content: "a".repeat(MAX_MEMORY_CHARS), createdAt: recent },
      { id: "court", kind: "lesson", content: "Stop après 1 perte.", createdAt: recent },
    ];
    // Budget 30 : le long (60 tokens) NE rentre pas, le court (5) rentre.
    // Une boucle qui ferait `break` au premier dépassement renverrait [].
    const r = selectMemories(mix, "discipline", { budget: 30, now: NOW });
    expect(ids(r.selected)).toEqual(["court"]);
  });

  it("un budget nul ne sélectionne rien et ne lève pas", () => {
    const r = selectMemories(CORPUS, "discipline", { budget: 0, now: NOW });
    expect(r.selected).toEqual([]);
    expect(r.tokens).toBe(0);
  });

  it("PLAFOND : jamais plus de MAX_MEMORIES souvenirs, même si le budget le permet", () => {
    // Découvert par la mesure : un corpus réaliste tient entièrement dans le
    // budget, donc celui-ci n'écartait RIEN. Un coach qui reçoit tout ce qu'il
    // sait n'est pas plus pertinent, il est plus dilué.
    const many: MemoryLike[] = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      kind: "lesson" as const,
      content: `Engagement court ${i}.`,
      createdAt: recent,
    }));
    const r = selectMemories(many, "discipline", { now: NOW });
    expect(r.selected.length).toBe(MAX_MEMORIES);
    expect(r.tokens).toBeLessThan(MEMORY_TOKEN_BUDGET);
  });

  it("PLANCHER : un souvenir sans lien avec la question est écarté malgré la place restante", () => {
    const noise: MemoryLike[] = [
      { id: "utile", kind: "lesson", content: "Stop après une perte.", createdAt: recent },
      // `conversation` (affinité 1) + aucun mot commun + ancien ⇒ score < 2.
      { id: "bruit", kind: "conversation", content: "Bonjour.", createdAt: old },
    ];
    const r = selectMemories(noise, "Comment tenir ma discipline ?", { now: NOW });
    expect(ids(r.selected)).toEqual(["utile"]);
  });

  it("corpus vide = aucune sélection", () => {
    const r = selectMemories([], "peu importe", { now: NOW });
    expect(r.selected).toEqual([]);
    expect(r.tokensIfUnbounded).toBe(0);
  });
});

describe("estimateTokens", () => {
  it("approxime ~4 caractères par token", () => {
    expect(estimateTokens("12345678")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});
