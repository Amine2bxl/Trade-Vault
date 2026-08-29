import { afterEach, describe, expect, test } from "bun:test";
import {
  ConversationSchema,
  MemorySchema,
  TradeSummarySchema,
  TradesSchema,
  maxContextBytes,
  withGlobalByteCeiling,
} from "../src/backend/ai-payload";
import { z } from "zod";
import {
  AI_CONTEXT_TOO_LARGE,
  AI_LIMITS,
  AI_MAX_CONTEXT_BYTES_DEFAULT,
  contextByteSize,
} from "../src/domain/ai-limits";

/**
 * LE COÛT DU MODÈLE, borné par la validation.
 *
 * Tout le contexte de Jarvis vient du client : le serveur ne relit pas les
 * trades. La validation Zod est donc le SEUL endroit qui décide combien un
 * compte authentifié peut faire dépenser en une requête. Ces tests exécutent
 * les schémas réels — ce sont des fonctions pures, il n'y a rien à simuler.
 */

const trade = (over: Partial<z.input<typeof TradeSummarySchema>> = {}) => ({
  date: "2026-08-29",
  symbol: "EURUSD",
  direction: "long",
  pnl: 120,
  rMultiple: 1.5,
  strategy: "breakout",
  mistakes: [],
  setupQuality: 80,
  confluences: [],
  ...over,
});

describe("notes de trade — le champ qui portait tout le risque", () => {
  test("une note de taille normale passe", () => {
    expect(
      TradeSummarySchema.safeParse(trade({ notes: "Entrée sur retest, sortie au TP." })).success,
    ).toBe(true);
  });

  test("une note à la limite exacte passe", () => {
    const notes = "x".repeat(AI_LIMITS.tradeNote);
    expect(TradeSummarySchema.safeParse(trade({ notes })).success).toBe(true);
  });

  test("une note d'un caractère de trop est REFUSÉE", () => {
    const notes = "x".repeat(AI_LIMITS.tradeNote + 1);
    expect(TradeSummarySchema.safeParse(trade({ notes })).success).toBe(false);
  });

  test("l'ancien plafond de 10 000 caractères ne passe plus", () => {
    // 500 trades × 10 000 caractères, c'était cinq mégaoctets de texte pour une
    // seule question — de l'ordre du million de tokens d'entrée, soixante fois
    // par heure et par compte.
    expect(TradeSummarySchema.safeParse(trade({ notes: "x".repeat(10_000) })).success).toBe(false);
  });

  test("le pire cas d'un lot complet reste sous le mégaoctet", () => {
    // La borne qui compte n'est pas celle d'un champ, c'est leur produit.
    const worst = Array.from({ length: AI_LIMITS.trades }, () =>
      trade({
        notes: "x".repeat(AI_LIMITS.tradeNote),
        mistakes: Array.from({ length: 20 }, () => "y".repeat(100)),
        confluences: Array.from({ length: 30 }, () => "z".repeat(100)),
      }),
    );
    // Le schéma par champ l'accepte…
    expect(TradesSchema.safeParse(worst).success).toBe(true);
    // …mais il pèse encore trop, ce qui est précisément pourquoi le plafond
    // global existe : les bornes par champ se multiplient, pas lui.
    expect(contextByteSize(worst)).toBeGreaterThan(AI_MAX_CONTEXT_BYTES_DEFAULT);
  });
});

describe("profondeur d'historique", () => {
  test("cinq cents trades restent acceptés — c'est une décision produit", () => {
    // Réduire ce nombre changerait ce sur quoi le coach raisonne. Le coût est
    // réglé par la taille des notes et le plafond global, pas en amputant
    // l'historique.
    const many = Array.from({ length: AI_LIMITS.trades }, () => trade());
    expect(TradesSchema.safeParse(many).success).toBe(true);
  });

  test("au-delà, c'est refusé", () => {
    const tooMany = Array.from({ length: AI_LIMITS.trades + 1 }, () => trade());
    expect(TradesSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe("conversation et mémoire", () => {
  test("un tour de conversation est borné", () => {
    const ok = [{ role: "user" as const, content: "x".repeat(AI_LIMITS.conversationContent) }];
    const tooLong = [
      { role: "user" as const, content: "x".repeat(AI_LIMITS.conversationContent + 1) },
    ];
    expect(ConversationSchema.safeParse(ok).success).toBe(true);
    expect(ConversationSchema.safeParse(tooLong).success).toBe(false);
  });

  test("le nombre de tours est borné", () => {
    const turns = Array.from({ length: AI_LIMITS.conversation + 1 }, () => ({
      role: "user" as const,
      content: "bonjour",
    }));
    expect(ConversationSchema.safeParse(turns).success).toBe(false);
  });

  test("la mémoire est bornée en nombre et en taille", () => {
    expect(
      MemorySchema.safeParse([{ kind: "fact", content: "x".repeat(AI_LIMITS.memoryContent + 1) }])
        .success,
    ).toBe(false);
    expect(
      MemorySchema.safeParse(
        Array.from({ length: AI_LIMITS.memory + 1 }, () => ({ kind: "fact", content: "ok" })),
      ).success,
    ).toBe(false);
  });
});

describe("plafond GLOBAL d'octets", () => {
  const Schema = withGlobalByteCeiling(z.object({ trades: TradesSchema.optional() }));

  afterEach(() => {
    delete process.env.AI_MAX_CONTEXT_BYTES;
  });

  test("un contexte de taille normale passe", () => {
    const payload = { trades: Array.from({ length: 50 }, () => trade({ notes: "note courte" })) };
    expect(contextByteSize(payload)).toBeLessThan(AI_MAX_CONTEXT_BYTES_DEFAULT);
    expect(Schema.safeParse(payload).success).toBe(true);
  });

  test("un contexte trop gros est REFUSÉ, pas tronqué en silence", () => {
    // Tronquer ferait raisonner le coach sur des données amputées sans que
    // personne ne le sache — un coach qui affirme « tu n'as jamais tradé le
    // lundi » parce que les lundis ont été coupés est pire qu'une erreur.
    const payload = {
      trades: Array.from({ length: AI_LIMITS.trades }, () =>
        trade({ notes: "x".repeat(AI_LIMITS.tradeNote) }),
      ),
    };
    const result = Schema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes(AI_CONTEXT_TOO_LARGE))).toBe(true);
    }
  });

  test("le plafond est réglable par variable d'environnement", () => {
    const payload = { trades: [trade({ notes: "une note tout à fait ordinaire" })] };
    expect(Schema.safeParse(payload).success).toBe(true);

    process.env.AI_MAX_CONTEXT_BYTES = "10";
    expect(maxContextBytes()).toBe(10);
    expect(Schema.safeParse(payload).success).toBe(false);
  });

  test("une valeur d'environnement absurde retombe sur le défaut", () => {
    for (const bad of ["", "abc", "-1", "0"]) {
      process.env.AI_MAX_CONTEXT_BYTES = bad;
      expect(maxContextBytes()).toBe(AI_MAX_CONTEXT_BYTES_DEFAULT);
    }
  });

  test("la taille est mesurée en OCTETS UTF-8, pas en caractères", () => {
    // « é » compte pour deux octets. Mesurer avec `.length` sous-estimerait le
    // coût réel d'un contexte en français — la langue par défaut du produit.
    const accented = { trades: [trade({ notes: "é".repeat(1000) })] };
    const ascii = { trades: [trade({ notes: "e".repeat(1000) })] };
    expect(contextByteSize(accented)).toBeGreaterThan(contextByteSize(ascii));
  });

  test("une valeur non sérialisable est traitée comme hors-limites", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(contextByteSize(circular)).toBe(Number.POSITIVE_INFINITY);
  });
});
