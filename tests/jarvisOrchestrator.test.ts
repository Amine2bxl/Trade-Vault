import { afterEach, describe, expect, test } from "bun:test";
import { ensureJarvisTools, JARVIS_TOOL_NAMES } from "../src/backend/ai-tools";
import { orchestrateCoach, traceOfError } from "../src/modules/ai/agents/coach.orchestrator";
import { buildCoachMessages } from "../src/modules/ai/agents/coach.agent";
import type { AIProvider, AIRequest, AIResponse } from "../src/modules/ai-provider";
import { withFakePostgrest, type Row } from "./helpers/fakePostgrest";
import { fullCoachInput } from "./helpers/coachInput";

/**
 * LOT 2 — L'ORCHESTRATION DE BOUT EN BOUT.
 *
 * Question → route → plan de contexte → lectures préparées (compte actif) →
 * modèle du niveau → validation des chiffres → trace. Le fournisseur est
 * factice et scripté ; les lectures passent par les VRAIS outils, sur un
 * PostgREST en mémoire qui contient aussi un autre compte.
 */

ensureJarvisTools();

const savedRouter = process.env.AI_MODEL_ROUTER;
afterEach(() => {
  if (savedRouter === undefined) delete process.env.AI_MODEL_ROUTER;
  else process.env.AI_MODEL_ROUTER = savedRouter;
});

let seq = 0;
/** Un fournisseur qui rend ses réponses dans l'ordre et garde chaque requête. */
function scripted(answers: (string | Partial<AIResponse>)[], seen: AIRequest[]): AIProvider {
  const id = `orch-fake-${++seq}`;
  let i = 0;
  return {
    id,
    supportsTools: true,
    isConfigured: () => true,
    async complete(req) {
      seen.push(req);
      const a = answers[Math.min(i++, answers.length - 1)];
      const base: AIResponse = {
        text: "",
        provider: id,
        model: "claude-sonnet-5-5",
        usage: { inputTokens: 1_000, outputTokens: 100, thinkingTokens: 50, cachedInputTokens: 0 },
        finishReason: "stop",
      };
      return typeof a === "string" ? { ...base, text: a } : { ...base, ...a };
    },
  };
}

const allText = (req: AIRequest) => req.messages.map((m) => m.content).join("\n");

function septembre(): Record<string, Row[]> {
  const row = (id: string, account: string, date: string, pnl: number): Row => ({
    id,
    user_id: "u1",
    account_id: account,
    trade_date: date,
    symbol: "NQ",
    direction: "long",
    pnl,
    risk_amount: 100,
    r_multiple: pnl / 100,
    strategy: "ORB",
    mistakes: [],
    setup_quality: 3,
    entry_time: "09:35",
    exit_time: "10:00",
    confluences: [],
    confidence: 3,
    mae: null,
    mfe: null,
  });
  return {
    trades: [
      row("t3", "acc1", "2026-09-24", 250),
      row("t2", "acc1", "2026-09-12", -50),
      row("t1", "acc1", "2026-09-03", 100),
      row("t9", "acc2", "2026-09-10", 9_999),
    ],
  };
}

describe("bout en bout", () => {
  test("« salut » : niveau rapide, ni lecture ni outil, aucune validation, contexte réduit", async () => {
    const seen: AIRequest[] = [];
    const input = fullCoachInput("salut");
    const { text, trace } = await orchestrateCoach(input, {
      userId: "u1",
      accountId: "acc1",
      modelTools: JARVIS_TOOL_NAMES,
      prefetch: true,
      providers: [scripted(["Salut ! Prêt pour la séance ?"], seen)],
    });
    expect(text).toBe("Salut ! Prêt pour la séance ?");
    expect(seen.length).toBe(1);
    expect(seen[0].tools).toBeUndefined();
    expect(seen[0]).toMatchObject({ maxTokens: 2_048, reasoning: "none", timeoutMs: 20_000 });
    expect(trace).toMatchObject({
      tier: 1,
      slot: "fast",
      validation: "skipped",
      prefetch: [],
      tools: [],
    });
    const full = buildCoachMessages(input).reduce((n, m) => n + m.content.length, 0);
    expect(trace.contextChars).toBeLessThan(full * 0.6);
  });

  test("une période : les chiffres de CETTE période, lus sur le compte actif, avant le premier appel", async () => {
    await withFakePostgrest(septembre(), async (pg) => {
      const seen: AIRequest[] = [];
      const { text, trace } = await orchestrateCoach(
        fullCoachInput("Combien j'ai gagné en septembre ?"),
        {
          userId: "u1",
          accountId: "acc1",
          modelTools: JARVIS_TOOL_NAMES,
          prefetch: true,
          providers: [scripted(["En septembre, ton P&L net est de 300 € sur 3 trades."], seen)],
        },
      );
      const first = allText(seen[0]);
      expect(first).toContain("MEASURED — stats 2026-09-01..2026-09-30");
      expect(first).toContain('"totalPnl":300');
      expect(first).not.toContain("9999");
      expect(first).toContain('PERIOD: "septembre" = 2026-09-01..2026-09-30');
      for (const c of pg.callsTo("trades")) {
        expect(c.params.user_id).toBe("eq.u1");
        expect(c.params.account_id).toBe("eq.acc1");
      }
      expect(trace.prefetch.map((p) => [p.tool, p.ok])).toEqual([["get_stats", true]]);
      expect(trace.validation).toBe("ok");
      expect(text).toContain("300 €");
    });
  });

  test("un chiffre sans appui est réparé UNE fois, sans outils, et la trace additionne tous les appels", async () => {
    await withFakePostgrest(septembre(), async () => {
      const seen: AIRequest[] = [];
      const { text, trace } = await orchestrateCoach(
        fullCoachInput("Combien j'ai gagné en septembre ?"),
        {
          userId: "u1",
          accountId: "acc1",
          modelTools: JARVIS_TOOL_NAMES,
          prefetch: true,
          providers: [
            scripted(
              ["Ton P&L de septembre est de 4 200 €.", "Ton P&L de septembre est de 300 €."],
              seen,
            ),
          ],
        },
      );
      expect(seen.length).toBe(2);
      expect(seen[1].tools).toBeUndefined();
      expect(allText(seen[1])).toContain(
        "VERIFICATION FAILED: these figures in your draft do not appear",
      );
      expect(allText(seen[1])).toContain('"4 200 €"');
      expect(text).toBe("Ton P&L de septembre est de 300 €.");
      expect(trace).toMatchObject({
        validation: "repaired",
        unsupportedFigures: 0,
        modelCalls: 2,
        inputTokens: 2_000,
        outputTokens: 200,
        thinkingTokens: 100,
      });
      // Sonnet 5.5 : (1 000 × 2 $ + 150 × 10 $) / 1 M par appel, deux appels.
      expect(trace.costUsd).toBeCloseTo(0.007, 9);
    });
  });

  test("réparation sans effet : la réponse part avec une mention honnête, dans la langue du trader", async () => {
    await withFakePostgrest(septembre(), async () => {
      const { text, trace } = await orchestrateCoach(
        fullCoachInput("Combien j'ai gagné en septembre ?"),
        {
          userId: "u1",
          accountId: "acc1",
          modelTools: JARVIS_TOOL_NAMES,
          prefetch: true,
          providers: [scripted(["Ton P&L de septembre est de 4 200 €."], [])],
        },
      );
      expect(trace.validation).toBe("flagged");
      expect(trace.unsupportedFigures).toBe(1);
      expect(text).toContain("n'ont pas pu être vérifiés");
    });
  });
});

describe("outils offerts", () => {
  test("chemin sans outils (AI_TOOLS=off) : aucune boucle, les lectures préparées restent", async () => {
    await withFakePostgrest(septembre(), async () => {
      const seen: AIRequest[] = [];
      const { trace } = await orchestrateCoach(
        fullCoachInput("Combien j'ai gagné en septembre ?"),
        {
          userId: "u1",
          accountId: "acc1",
          modelTools: [],
          prefetch: true,
          providers: [scripted(["300 € en septembre."], seen)],
        },
      );
      expect(seen.length).toBe(1);
      expect(seen[0].tools).toBeUndefined();
      expect(allText(seen[0])).toContain("MEASURED — stats 2026-09-01..2026-09-30");
      expect(trace.prefetch.length).toBe(1);
    });
  });

  test("sans utilisateur authentifié : ni lecture, ni outil", async () => {
    const seen: AIRequest[] = [];
    const { trace } = await orchestrateCoach(fullCoachInput("Combien j'ai gagné en septembre ?"), {
      modelTools: JARVIS_TOOL_NAMES,
      prefetch: true,
      providers: [scripted(["Je n'ai pas accès à ton journal ici."], seen)],
    });
    expect(seen[0].tools).toBeUndefined();
    expect(trace.prefetch).toEqual([]);
  });

  test("seuls les outils du plan ET autorisés sont remis au modèle", async () => {
    await withFakePostgrest({ trades: [], profiles: [], accounts: [] }, async () => {
      const seen: AIRequest[] = [];
      await orchestrateCoach(fullCoachInput("Est-ce que je respecte mon Trading Plan ?"), {
        userId: "u1",
        accountId: "acc1",
        modelTools: ["get_stats", "get_profile", "not_in_plan"],
        prefetch: true,
        providers: [scripted(["Ton plan n'est pas encore écrit."], seen)],
      });
      expect(seen[0].tools?.map((t) => t.name).sort()).toEqual(["get_profile", "get_stats"]);
    });
  });
});

describe("question ambiguë", () => {
  const q = "Peux-tu m'en dire plus là-dessus stp ?";

  test("un petit modèle tranche, borné et en JSON, puis le niveau proposé s'applique", async () => {
    delete process.env.AI_MODEL_ROUTER;
    const seen: AIRequest[] = [];
    const { trace } = await orchestrateCoach(fullCoachInput(q, { conversation: [] }), {
      modelTools: [],
      prefetch: false,
      providers: [
        scripted(
          ['{"domains":["performance"],"tier":2}', "Voici ce que montrent tes chiffres."],
          seen,
        ),
      ],
    });
    expect(seen.length).toBe(2);
    expect(seen[0]).toMatchObject({ json: true, maxTokens: 256 });
    // Le petit modèle ne voit que la question, jamais les données.
    expect(allText(seen[0])).not.toContain("FOMO");
    expect(trace).toMatchObject({
      modelRouted: true,
      domains: ["performance"],
      tier: 2,
      slot: "balanced",
    });
  });

  test("AI_MODEL_ROUTER=off : pas d'appel de routage", async () => {
    process.env.AI_MODEL_ROUTER = "off";
    const seen: AIRequest[] = [];
    const { trace } = await orchestrateCoach(fullCoachInput(q, { conversation: [] }), {
      modelTools: [],
      prefetch: false,
      providers: [scripted(["Tu peux préciser ta question ?"], seen)],
    });
    expect(seen.length).toBe(1);
    expect(trace.modelRouted).toBe(false);
  });
});

describe("revue adversariale du LOT 2 — régressions", () => {
  test("une réparation COUPÉE par le plafond ne remplace jamais le brouillon complet", async () => {
    await withFakePostgrest(septembre(), async () => {
      const { text, trace } = await orchestrateCoach(
        fullCoachInput("Combien j'ai gagné en septembre ?"),
        {
          userId: "u1",
          accountId: "acc1",
          modelTools: JARVIS_TOOL_NAMES,
          prefetch: true,
          providers: [
            scripted(
              [
                "Ton P&L de septembre est de 300 € sur 3 trades. Ton meilleur jour : 999 €.",
                { text: "Ton P&L de septembre est de 300 € sur 3", finishReason: "length" },
              ],
              [],
            ),
          ],
        },
      );
      expect(text).toContain("Ton meilleur jour : 999 €.");
      expect(text).toContain("n'ont pas pu être vérifiés");
      expect(trace.validation).toBe("flagged");
      expect(trace.unsupportedFigures).toBe(1);
    });
  });

  test("les réponses PRÉCÉDENTES de Jarvis ne servent pas de preuve", async () => {
    const input = fullCoachInput("Et donc combien j'ai perdu sur le FOMO ?", {
      conversation: [
        { role: "user", content: "Combien me coûte le FOMO ?" },
        { role: "assistant", content: "Le FOMO te coûte 3 456 € sur 23 trades." },
      ],
    });
    const { trace } = await orchestrateCoach(input, {
      modelTools: [],
      prefetch: false,
      providers: [scripted(["Le FOMO te coûte 3 456 €."], [])],
    });
    // 3 456 € n'existe que dans l'ancienne réponse — jamais dans les données.
    expect(trace.validation).toBe("flagged");
  });

  test("une question qui ÉCHOUE garde la trace des appels déjà payés", async () => {
    await withFakePostgrest(septembre(), async () => {
      let calls = 0;
      const flaky: AIProvider = {
        id: `orch-flaky-${++seq}`,
        supportsTools: true,
        isConfigured: () => true,
        async complete(): Promise<AIResponse> {
          calls += 1;
          if (calls === 1) {
            return {
              text: "",
              provider: "orch-flaky",
              model: "claude-sonnet-5-5",
              usage: { inputTokens: 1_000, outputTokens: 40, thinkingTokens: 10 },
              finishReason: "tool_calls",
              toolCalls: [
                { name: "get_stats", arguments: { since: "2026-09-01", until: "2026-09-30" } },
              ],
            };
          }
          throw new Error("provider down");
        },
      };
      let caught: unknown;
      try {
        await orchestrateCoach(fullCoachInput("Pourquoi je perds autant le lundi ?"), {
          userId: "u1",
          accountId: "acc1",
          modelTools: JARVIS_TOOL_NAMES,
          prefetch: true,
          providers: [flaky],
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      const trace = traceOfError(caught);
      expect(trace).toBeDefined();
      expect(trace!.inputTokens).toBe(1_000);
      expect(trace!.thinkingTokens).toBe(10);
      expect(trace!.modelCalls).toBeGreaterThan(1);
      expect(trace!.tools.map((t) => t.name)).toEqual(["get_stats"]);
      expect(trace!.tier).toBe(3);
      expect(trace!.validation).toBe("skipped");
      // L'erreur d'origine n'est pas remplacée : askCoach lit toujours son
      // `type` (quota → « busy ») et son `technicalMessage`.
      const original = caught as { technicalMessage?: string; message?: string };
      expect(original.technicalMessage ?? original.message ?? "").toContain("provider down");
    });
  });
});

describe("relances de conversation", () => {
  test("« pourquoi ? » hérite des données de la question précédente, chiffres vérifiés", async () => {
    await withFakePostgrest(septembre(), async () => {
      const seen: AIRequest[] = [];
      const input = fullCoachInput("pourquoi ?", {
        conversation: [
          { role: "user", content: "Combien j'ai gagné en septembre ?" },
          { role: "assistant", content: "En septembre, ton P&L net est de 300 €." },
        ],
      });
      const { trace } = await orchestrateCoach(input, {
        userId: "u1",
        accountId: "acc1",
        modelTools: JARVIS_TOOL_NAMES,
        prefetch: true,
        providers: [scripted(["Une perte de 50 € le 12 a pesé sur le mois."], seen)],
      });
      expect(trace.signals).toContain("follow-up");
      expect(trace.domains).toContain("performance");
      // La période de la question précédente est relue, pour le compte actif.
      expect(allText(seen[0])).toContain("MEASURED — stats 2026-09-01..2026-09-30");
      expect(seen[0].tools?.length).toBeGreaterThan(0);
      // Et la réponse est vérifiée : -50 € figure dans les données lues.
      expect(trace.validation).toBe("ok");
    });
  });

  test("le petit modèle de routage voit la question précédente du trader, jamais une réponse", async () => {
    delete process.env.AI_MODEL_ROUTER;
    const seen: AIRequest[] = [];
    await orchestrateCoach(
      fullCoachInput("Peux-tu m'en dire plus là-dessus stp ?", {
        conversation: [
          { role: "user", content: "Peux-tu m'expliquer ça ?" },
          { role: "assistant", content: "Réponse confidentielle 4 321 €." },
        ],
      }),
      {
        modelTools: [],
        prefetch: false,
        providers: [scripted(['{"domains":["knowledge"],"tier":1}', "Bien sûr."], seen)],
      },
    );
    expect(seen[0].json).toBe(true);
    expect(allText(seen[0])).toContain("Previous question: Peux-tu m'expliquer ça ?");
    expect(allText(seen[0])).not.toContain("4 321");
  });
});

describe("question personnelle courte, petit modèle coupé", () => {
  test("« Mon setup préféré ? » reçoit le journal, pas le repli « knowledge »", async () => {
    process.env.AI_MODEL_ROUTER = "off";
    const seen: AIRequest[] = [];
    const { trace } = await orchestrateCoach(
      fullCoachInput("Et moi alors ?", { conversation: [] }),
      {
        userId: "u1",
        accountId: "acc1",
        modelTools: JARVIS_TOOL_NAMES,
        prefetch: false,
        providers: [scripted(["Ton win rate est de 58,3 %."], seen)],
      },
    );
    expect(trace.domains).toEqual(["performance"]);
    expect(trace.signals).toContain("personal-fallback");
    expect(seen[0].tools?.map((t) => t.name)).toContain("get_stats");
    // La consigne de période n'apparaît pas sur une salutation.
  });

  test("une salutation avec « aujourd'hui » ne reçoit aucune consigne de période", async () => {
    const seen: AIRequest[] = [];
    await orchestrateCoach(fullCoachInput("Salut Jarvis, ça va aujourd'hui ?"), {
      modelTools: [],
      prefetch: false,
      providers: [scripted(["Salut !"], seen)],
    });
    expect(allText(seen[0])).not.toContain("PERIOD:");
  });
});
