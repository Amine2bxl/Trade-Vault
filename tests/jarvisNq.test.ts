import { describe, expect, test } from "bun:test";
import { buildCoachMessages } from "../src/modules/ai/agents/coach.agent";
import { JARVIS_NQ, answerShape, jarvisNqSlot } from "../src/modules/ai/agents/jarvis-nq";
import { orchestrateCoach, routeGuidance } from "../src/modules/ai/agents/coach.orchestrator";
import { routeQuestion } from "../src/modules/ai/router/route";
import { planContext, UNAVAILABLE_NOTICE } from "../src/modules/ai/context-engine";
import { contractMath, futuresSpecFor } from "../src/domain/futuresContracts";
import { POINT_VALUES } from "../src/app/trading/positionCalc";
import { shapeCalendar, newYorkDay } from "../src/backend/ai-tools/market";
import { ensureJarvisSources } from "../src/backend/ai-tools/sources";
import { AI_LIMITS } from "../src/domain/ai-limits";
import {
  isEndCommand,
  readTranscript,
  speechLangTag,
} from "../src/app/features/jarvis/voiceConversation";
import { pickJarvisVoice } from "../src/modules/voice";
import type { AIProvider, AIRequest, AIResponse } from "../src/modules/ai-provider";

/**
 * JARVIS_NQ — le cerveau de Jarvis : lire chaque mot, répondre court et
 * concret, connaître le NQ, réfléchir plus, parler.
 */

const TODAY = "2026-10-20";

function scripted(answer: string, seen: AIRequest[]): AIProvider {
  return {
    id: "nq-fake",
    supportsTools: true,
    isConfigured: () => true,
    async complete(req) {
      seen.push(req);
      const res: AIResponse = {
        text: answer,
        provider: "nq-fake",
        model: "m",
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
      };
      return res;
    },
  };
}

describe("le prompt jarvis_nq", () => {
  const system = buildCoachMessages({ question: "Combien vaut un tick NQ ?", language: "fr" })[0]
    .content;

  test("porte le nom du modèle, la lecture mot à mot et la concision", () => {
    expect(system).toContain(JARVIS_NQ.id);
    expect(system).toContain("HOW YOU READ");
    expect(system).toContain("The first sentence IS the answer");
    expect(system).toContain("Generic advice is banned");
  });

  test("connaît la fiche du NQ et du MNQ, et ne prédit jamais", () => {
    expect(system).toContain("tick 0.25 point = $5, 1 point = $20");
    expect(system).toContain("1 point = $2");
    expect(system).toContain("never give a trade signal");
  });

  test("garde le contrat « ne jamais inventer » et la réponse dans la langue de l'UI", () => {
    expect(system).toContain("STRICT DATA RULE");
    expect(system).toContain("Write the ENTIRE written response in French");
  });
});

describe("la forme de réponse — des budgets, pas des intentions", () => {
  test("chaque niveau a son plafond de mots", () => {
    expect(answerShape(1)).toContain("60 words");
    expect(answerShape(2)).toContain("120 words");
    expect(answerShape(3)).toContain("180 words");
    expect(answerShape(4)).toContain("350 words");
  });

  test("en vocal : deux ou trois phrases, sans Markdown, quel que soit le niveau", () => {
    for (const tier of [1, 2, 3, 4]) {
      const shape = answerShape(tier, "voice");
      expect(shape).toContain("VOICE MODE");
      expect(shape).toContain("45 words");
      expect(shape).toContain("No markdown");
    }
  });

  test("la consigne de la question porte la forme du canal", () => {
    const route = routeQuestion("Pourquoi je perds le vendredi ?", { today: TODAY });
    const plan = planContext(route);
    expect(routeGuidance(route, plan)).toContain("ANSWER SHAPE");
    expect(routeGuidance(route, plan, "voice")).toContain("VOICE MODE");
  });
});

describe("le modèle — plus de réflexion, sauf pour bavarder", () => {
  test("le bavardage reste sur le modèle rapide", () => {
    expect(jarvisNqSlot({ tier: 1, domains: ["smalltalk"] })).toBe("fast");
  });

  test("une question de connaissance ou de journal monte au moins à « balanced »", () => {
    expect(jarvisNqSlot({ tier: 1, domains: ["knowledge"] })).toBe("balanced");
    expect(jarvisNqSlot({ tier: 1, domains: ["performance"] })).toBe("balanced");
    expect(jarvisNqSlot({ tier: 3, domains: ["patterns"] })).toBe("strong");
  });

  test("en vocal, jamais le modèle le plus lent", () => {
    expect(jarvisNqSlot({ tier: 4, domains: ["performance"] })).toBe("deep");
    expect(jarvisNqSlot({ tier: 4, domains: ["performance"] }, "voice")).toBe("strong");
  });

  test("la trace dit le profil, le canal et l'emplacement réellement servi", async () => {
    const seen: AIRequest[] = [];
    const { trace } = await orchestrateCoach(
      { question: "C'est quoi un FVG ?", language: "fr", today: TODAY, channel: "voice" },
      { modelTools: [], prefetch: false, providers: [scripted("Un trou de prix.", seen)] },
    );
    expect(trace).toMatchObject({ profile: "jarvis_nq", channel: "voice", slot: "balanced" });
    const guidance = seen[0].messages.find((m, i) => i > 0 && m.role === "system")?.content ?? "";
    expect(guidance).toContain("VOICE MODE");
  });
});

describe("get_contract_math — l'arithmétique d'un contrat, jamais de tête", () => {
  test("15 points sur 2 NQ = 60 ticks, 600 $", () => {
    const out = contractMath({ symbol: "NQ", points: 15, contracts: 2 });
    expect(out).toMatchObject({
      move: { points: 15, ticks: 60, dollarsPerContract: 300, dollarsTotal: 600, onTickGrid: true },
    });
  });

  test("des ticks et des dollars se convertissent aussi", () => {
    expect(contractMath({ symbol: "MNQ", ticks: 8 })).toMatchObject({
      move: { points: 2, dollarsPerContract: 4 },
    });
    expect(contractMath({ symbol: "MNQ", dollars: 100, contracts: 5 })).toMatchObject({
      move: { points: 10, ticks: 40, dollarsTotal: 100 },
    });
  });

  test("dimensionner : 500 $ de risque, stop de 10 points", () => {
    const out = contractMath({ symbol: "NQ", riskDollars: 500, stopPoints: 10 });
    expect(out).toMatchObject({
      sizing: {
        riskPerContract: 200,
        maxContracts: 2,
        riskAtMaxContracts: 400,
        pairContract: { symbol: "MNQ", maxContracts: 25, riskAtMaxContracts: 500 },
      },
    });
  });

  test("les symboles réels se lisent ; un CFD est refusé, pas deviné", () => {
    expect(futuresSpecFor("CME_MINI:NQ1!")?.symbol).toBe("NQ");
    expect(futuresSpecFor("NQZ5")?.symbol).toBe("NQ");
    expect(futuresSpecFor("MNQ DEC25")?.symbol).toBe("MNQ");
    expect(futuresSpecFor("mes")?.symbol).toBe("MES");
    expect(futuresSpecFor("NAS100")).toBeNull();
    expect("error" in contractMath({ symbol: "NAS100", points: 10 })).toBe(true);
  });

  test("le calculateur de taille lit la même fiche", () => {
    expect(POINT_VALUES.find((p) => p.label === "NQ")?.value).toBe(20);
    expect(POINT_VALUES.find((p) => p.label === "MNQ")?.value).toBe(2);
  });

  test("offert pour une question de connaissance et de risque", () => {
    const knowledge = planContext(routeQuestion("C'est quoi un tick ?", { today: TODAY }));
    expect(knowledge.tools).toContain("get_contract_math");
    const salut = planContext(routeQuestion("salut", { today: TODAY }));
    expect(salut.tools).toEqual([]);
  });
});

describe("get_economic_calendar — le calendrier branché", () => {
  const rows = [
    // 12:30 UTC en octobre = 08:30 à New York (heure d'été).
    {
      starts_at: "2026-10-20T12:30:00Z",
      currency: "USD",
      title: "CPI m/m",
      impact: "high",
      previous: "0.2%",
      forecast: "0.3%",
      actual: null,
      all_day: false,
    },
    // 03:30 UTC le 21 = 23:30 le 20 à New York : c'est encore le 20.
    {
      starts_at: "2026-10-21T03:30:00Z",
      currency: "USD",
      title: "Late speech",
      impact: "medium",
      previous: null,
      forecast: null,
      actual: null,
      all_day: false,
    },
    {
      starts_at: "2026-10-20T09:00:00Z",
      currency: "EUR",
      title: "German ZEW",
      impact: "high",
      previous: null,
      forecast: null,
      actual: null,
      all_day: false,
    },
  ];

  test("heure de New York, filtre d'impact et de devise", () => {
    const out = shapeCalendar(rows, {
      since: "2026-10-20",
      until: "2026-10-20",
      impacts: ["high", "medium"],
      currencies: ["USD"],
    });
    expect(out.timezone).toBe("America/New_York");
    expect(out.events.map((e) => [e.date, e.time, e.title])).toEqual([
      ["2026-10-20", "08:30", "CPI m/m"],
      ["2026-10-20", "23:30", "Late speech"],
    ]);
  });

  test("une fenêtre vide le DIT au lieu de laisser deviner", () => {
    const out = shapeCalendar([], {
      since: "2026-10-20",
      until: "2026-10-20",
      impacts: ["high"],
      currencies: [],
    });
    expect(out.eventCount).toBe(0);
    expect(out.note).toContain("never guess");
  });

  test("la journée new-yorkaise ne dépend pas du fuseau du serveur", () => {
    expect(newYorkDay(0, new Date("2026-10-21T03:30:00Z"))).toBe("2026-10-20");
    expect(newYorkDay(1, new Date("2026-10-21T03:30:00Z"))).toBe("2026-10-21");
  });

  test("branché, le domaine marché perd son avertissement et prépare la lecture", () => {
    const off = ensureJarvisSources();
    try {
      const p = planContext(routeQuestion("Quelles news sur NQ aujourd'hui ?", { today: TODAY }));
      expect(p.notices).not.toContain(UNAVAILABLE_NOTICE.market!);
      const call = p.prefetch.find((c) => c.tool === "get_economic_calendar");
      expect(call?.args).toMatchObject({ currencies: ["USD"], impact: "medium" });
      expect(p.tools).toContain("get_economic_calendar");
    } finally {
      off();
    }
    expect(
      planContext(routeQuestion("Quelles news aujourd'hui ?", { today: TODAY })).notices,
    ).toContain(UNAVAILABLE_NOTICE.market!);
  });
});

describe("chaque lettre compte", () => {
  test("une question longue n'est plus coupée à 500 caractères", () => {
    expect(AI_LIMITS.question).toBeGreaterThanOrEqual(4_000);
  });
});

describe("la conversation vocale", () => {
  test("« stop », « merci Jarvis », « c'est tout » ferment le mode — seuls", () => {
    for (const s of ["stop", "Stop.", "Merci Jarvis !", "c'est tout", "That's all", "au revoir"])
      expect(isEndCommand(s)).toBe(true);
    for (const s of ["stop loss à 10 points sur MNQ ?", "c'est tout ce que j'ai perdu ?", ""])
      expect(isEndCommand(s)).toBe(false);
  });

  test("la reconnaissance reçoit une langue avec région", () => {
    expect(speechLangTag("fr")).toBe("fr-FR");
    expect(speechLangTag("en")).toBe("en-US");
    expect(speechLangTag("fr-CA")).toBe("fr-CA");
  });

  test("ce qui est acquis et ce qui s'écrit encore sont séparés", () => {
    const results = [
      Object.assign([{ transcript: "combien vaut " }], { isFinal: true }),
      Object.assign([{ transcript: "un tick" }], { isFinal: false }),
    ];
    expect(readTranscript({ results })).toEqual({ final: "combien vaut", interim: "un tick" });
  });

  test("une réponse française est lue par une voix française masculine", () => {
    const v = (name: string, lang: string) =>
      ({ name, lang, localService: true, default: false, voiceURI: name }) as SpeechSynthesisVoice;
    const voices = [v("Amelie", "fr-CA"), v("Thomas", "fr-FR"), v("Daniel", "en-GB")];
    expect(pickJarvisVoice(voices, "fr")?.name).toBe("Thomas");
    // L'anglais reste le défaut : les répliques fixes ne changent pas de voix.
    expect(pickJarvisVoice(voices)?.name).toBe("Daniel");
  });
});
