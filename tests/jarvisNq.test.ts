import { afterEach, describe, expect, test } from "bun:test";
import { buildCoachMessages } from "../src/modules/ai/agents/coach.agent";
import {
  AUTONOMOUS_TOOLS,
  JARVIS_NQ,
  answerShape,
  jarvisNqSlot,
  jarvisNqTools,
} from "../src/modules/ai/agents/jarvis-nq";
import { orchestrateCoach, routeGuidance } from "../src/modules/ai/agents/coach.orchestrator";
import { routeQuestion } from "../src/modules/ai/router/route";
import { planContext, UNAVAILABLE_NOTICE } from "../src/modules/ai/context-engine";
import { contractMath, futuresSpecFor } from "../src/domain/futuresContracts";
import { POINT_VALUES } from "../src/app/trading/positionCalc";
import { shapeCalendar, newYorkDay } from "../src/backend/ai-tools/market";
import { ensureJarvisSources } from "../src/backend/ai-tools/sources";
import { ensureJarvisTools, JARVIS_TOOL_NAMES } from "../src/backend/ai-tools";
import { AI_LIMITS } from "../src/domain/ai-limits";
import {
  isEndCommand,
  readTranscript,
  speechLangTag,
} from "../src/app/features/jarvis/voiceConversation";
import { pickJarvisVoice } from "../src/modules/voice";
import type { AIProvider, AIRequest, AIResponse } from "../src/modules/ai-provider";
import { fullCoachInput } from "./helpers/coachInput";

/**
 * JARVIS_NQ v2 — un vrai interlocuteur : polyvalent, autonome, constructif,
 * les chiffres en preuve et pas en conversation ; lecture mot à mot,
 * connaissance du NQ, voix.
 */

const TODAY = "2026-10-20";
const ROUTER = process.env.AI_MODEL_ROUTER;
afterEach(() => {
  if (ROUTER === undefined) delete process.env.AI_MODEL_ROUTER;
  else process.env.AI_MODEL_ROUTER = ROUTER;
});

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

describe("le prompt jarvis_nq — un interlocuteur, pas un relevé de stats", () => {
  const system = buildCoachMessages({ question: "Je doute de moi en ce moment", language: "fr" })[0]
    .content;

  test("polyvalent, conversationnel, autonome et constructif", () => {
    expect(system).toContain(JARVIS_NQ.id);
    expect(system).toContain("versatile assistant");
    expect(system).toContain("A REAL CONVERSATION PARTNER, NOT A REPORT GENERATOR");
    expect(system).toContain("read it yourself with your tools");
    expect(system).toContain("Constructive");
  });

  test("les chiffres sont une preuve, pas la conversation", () => {
    expect(system).toContain("Most replies need no number at all");
    // Les consignes de la v1 qui transformaient chaque réponse en relevé.
    expect(system).not.toContain("Every sentence carries something specific");
    expect(system).not.toContain("The first sentence IS the answer");
  });

  test("la règle des chiffres ne bride que les affirmations sur le trader", () => {
    expect(system).toContain("STRICT DATA RULE");
    expect(system).toContain("General knowledge, explanations, opinions, ideas");
    expect(system).toContain("never give a trade signal");
  });

  test("garde la lecture mot à mot, la fiche NQ et la langue de l'UI", () => {
    expect(system).toContain("READ EVERY LETTER");
    expect(system).toContain("tick 0.25 point = $5, 1 point = $20");
    expect(system).toContain("Write the ENTIRE written response in French");
  });
});

describe("la forme de réponse — des repères, pas un gabarit", () => {
  test("aucune forme n'impose un verdict chiffré en première ligne", () => {
    for (const tier of [1, 2, 3, 4]) {
      expect(answerShape(tier)).toContain("REPLY SHAPE");
      expect(answerShape(tier)).not.toMatch(/line one|verdict with its key figure/i);
    }
    expect(answerShape(1)).toContain("conversational");
  });

  test("en vocal : deux ou trois phrases, sans Markdown, quel que soit le niveau", () => {
    for (const tier of [1, 2, 3, 4]) {
      const shape = answerShape(tier, "voice");
      expect(shape).toContain("VOICE MODE");
      expect(shape).toContain("No markdown");
    }
  });

  test("la consigne de la question porte la forme du canal", () => {
    const route = routeQuestion("Pourquoi je perds le vendredi ?", { today: TODAY });
    const plan = planContext(route);
    expect(routeGuidance(route, plan)).toContain("REPLY SHAPE");
    expect(routeGuidance(route, plan, "voice")).toContain("VOICE MODE");
  });
});

describe("le modèle — le cerveau puissant dès qu'il y a matière à penser", () => {
  test("le bavardage reste sur le modèle rapide", () => {
    expect(jarvisNqSlot({ tier: 1, domains: ["smalltalk"] })).toBe("fast");
  });

  test("la discussion ouverte et l'analyse partent sur « strong »", () => {
    expect(jarvisNqSlot({ tier: 1, domains: ["knowledge"] })).toBe("strong");
    expect(jarvisNqSlot({ tier: 2, domains: ["performance"] })).toBe("strong");
    expect(jarvisNqSlot({ tier: 3, domains: ["patterns"] })).toBe("strong");
    expect(jarvisNqSlot({ tier: 4, domains: ["performance"] })).toBe("deep");
  });

  test("une mesure simple reste sur « balanced »", () => {
    expect(jarvisNqSlot({ tier: 1, domains: ["performance"] })).toBe("balanced");
  });

  test("en vocal, la réponse vient vite : jamais « deep », discussion sur « balanced »", () => {
    expect(jarvisNqSlot({ tier: 4, domains: ["performance"] }, "voice")).toBe("strong");
    expect(jarvisNqSlot({ tier: 1, domains: ["knowledge"] }, "voice")).toBe("balanced");
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

describe("autonomie — il décide lui-même de lire le journal", () => {
  test("hors bavardage, toute la boîte de lecture est offerte", () => {
    const tools = jarvisNqTools(["get_stats"], { domains: ["psychology"] });
    for (const t of AUTONOMOUS_TOOLS) expect(tools).toContain(t);
    expect(jarvisNqTools([], { domains: ["smalltalk"] })).toEqual([]);
  });

  test("le bloc Edge Score du client garde la main sur l'outil serveur", () => {
    const tools = jarvisNqTools([], { domains: ["performance"] }, { edgeKept: true });
    expect(tools).not.toContain("get_edge_score");
  });

  test("une question personnelle reçoit les outils au-delà du plan", async () => {
    process.env.AI_MODEL_ROUTER = "off";
    ensureJarvisTools();
    const seen: AIRequest[] = [];
    await orchestrateCoach(
      { question: "Je doute de moi, tu en penses quoi ?", language: "fr", today: TODAY },
      {
        userId: "u1",
        modelTools: JARVIS_TOOL_NAMES,
        prefetch: false,
        providers: [scripted("On en parle.", seen)],
      },
    );
    const offered = seen[0].tools?.map((t) => t.name) ?? [];
    expect(offered).toContain("search_memory");
    expect(offered).toContain("get_day");
  });

  test("une vraie discussion se souvient du fil : douze tours au moins", async () => {
    const seen: AIRequest[] = [];
    await orchestrateCoach(fullCoachInput("salut"), {
      modelTools: [],
      prefetch: false,
      providers: [scripted("Salut !", seen)],
    });
    const turns = seen[0].messages.filter((m) => m.content.startsWith("Et sur la semaine"));
    expect(turns.length).toBeGreaterThanOrEqual(6);
  });

  test("la fiche NQ citée dans une réponse sur le journal n'est pas un chiffre inventé", async () => {
    const { trace } = await orchestrateCoach(
      { question: "Combien j'ai perdu sur NQ ce mois-ci ?", language: "fr", today: TODAY },
      {
        modelTools: [],
        prefetch: false,
        validate: true,
        providers: [scripted("Pour rappel, 1 point de NQ vaut $20 par contrat.", [])],
      },
    );
    expect(trace.validation).toBe("ok");
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
