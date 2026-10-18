import { describe, expect, test } from "bun:test";
import {
  accountName,
  accountType,
  armedCount,
  buildRules,
  checklistFromAnswers,
  defaultGoal,
  guardrailForLeak,
  ICT_CONFLUENCES,
  lotCalcSeed,
  memoriesFromAnswers,
  planFromAnswers,
  profileFields,
  suggestGuardrails,
  type OnboardingAnswers,
} from "../src/app/features/onboarding/onboardingPlan";
import { EMPTY_PLAN } from "../src/app/trading/tradingPlan";
import { readSource, stripComments } from "./helpers/source";

/**
 * L'ONBOARDING RECONFIGURE L'APPLICATION — ce fichier garde ce contrat.
 *
 * Chaque réponse doit produire un réglage réel (compte, règles, profil lu par
 * la checklist et par Jarvis), dans le VOCABULAIRE que ces consommateurs
 * lisent déjà. Le bug que la refonte ferme : l'ancien écran « faiblesses »
 * était à choix multiple et enregistrait « emotions, overtrading » — la
 * checklist compare `pain` par égalité, aucun de ses blocs ne se déclenchait.
 */

const base: OnboardingAnswers = {
  firstName: "Alex",
  arena: "prop_challenge",
  firm: "apex",
  capital: 50_000,
  currency: "USD",
  assets: ["futures"],
  usesIct: true,
  style: "daytrading",
  experience: "intermediate",
  leak: "emotions",
  goal: "prop_challenge",
  monthlyTarget: null,
  guardrails: { riskPct: 0.5, maxTrades: 4, stopAfter: 2, dailyLoss: 1000 },
};
const texts = {
  risk: "risk {v}",
  trades: "trades {v}",
  stop: "stop {v}",
  daily: "daily {v}",
};

describe("le compte", () => {
  test("un challenge prop devient « Apex 50K », de type prop", () => {
    const labels = { personal: "Personal", demo: "Demo", funded: "Funded", prop: "Prop" };
    expect(accountName(base, labels)).toBe("Apex 50K");
    expect(accountName({ ...base, arena: "funded" }, labels)).toBe("Apex 50K · Funded");
    expect(accountName({ ...base, firm: "other" }, labels)).toBe("Prop 50K");
    expect(accountName({ ...base, arena: "personal" }, labels)).toBe("Personal");
    expect(accountType("prop_challenge")).toBe("prop");
    expect(accountType("demo")).toBe("demo");
    expect(accountType("personal")).toBe("personal");
  });
});

describe("les garde-fous proposés", () => {
  test("prudents pour une prop firm, et l'angle mort resserre SA règle", () => {
    const g = suggestGuardrails(base);
    expect(g.riskPct).toBe(0.5);
    expect(g.stopAfter).toBe(2);
    expect(g.dailyLoss).toBe(1000);
    expect(guardrailForLeak("emotions")).toBe("stopAfter");

    const over = suggestGuardrails({
      ...base,
      arena: "personal",
      leak: "overtrading",
      style: "scalping",
    });
    expect(over.maxTrades).toBe(3);
    expect(over.riskPct).toBe(1);
    expect(over.dailyLoss).toBeNull();
  });

  test("deviennent des règles vérifiées par `ruleCheck`, aux identifiants stables", () => {
    const rules = buildRules(base.guardrails, texts, (n) => `$${n}`);
    expect(rules.map((r) => r.kind)).toEqual([
      "max_risk_pct",
      "max_trades_day",
      "stop_after_losses",
      "custom",
    ]);
    expect(rules.every((r) => r.id.startsWith("onb-") && r.enabled)).toBe(true);
    expect(rules[3].text).toBe("daily $1000");
    expect(armedCount(base.guardrails)).toBe(4);
  });

  test("refaire l'onboarding remplace ses règles et garde celles du trader", () => {
    const mine = { id: "r1", kind: "custom" as const, value: "", text: "Mine", enabled: true };
    const first = buildRules(base.guardrails, texts, String, [mine]);
    const again = buildRules({ ...base.guardrails, maxTrades: null }, texts, String, first);
    expect(again.filter((r) => r.id === "r1")).toHaveLength(1);
    expect(again.find((r) => r.id === "onb-max-trades")).toBeUndefined();
    expect(again.filter((r) => r.id === "onb-max-risk")).toHaveLength(1);
  });

  test("un garde-fou désactivé n'écrit aucune règle", () => {
    expect(
      buildRules(
        { riskPct: null, maxTrades: null, stopAfter: null, dailyLoss: null },
        texts,
        String,
      ),
    ).toEqual([]);
  });
});

describe("le profil parle la langue de ses consommateurs", () => {
  test("une seule faiblesse, comparable par égalité", () => {
    const p = profileFields(base);
    expect(p.pain).toBe("emotions");
    expect(p.pain).not.toContain(",");
    expect(p.style).toBe("daytrading");
    expect(p.goal).toBe("prop_challenge");
    expect(p.brokers).toEqual(["apex"]);
    expect(p.usesIct).toBe(true);
  });

  test("ICT n'est retenu que pour un marché où il a un sens", () => {
    expect(profileFields({ ...base, assets: ["stocks"] }).usesIct).toBe(false);
  });

  test("les valeurs écrites sont celles que lit la checklist", () => {
    const checklist = stripComments(
      readSource(import.meta.dir, "../src/app/features/checklist/checklistDefaults.ts"),
    );
    for (const pain of ["risk", "overtrading", "emotions", "consistency", "journaling"]) {
      expect(checklist, pain).toContain(`p.pain === "${pain}"`);
    }
    expect(checklist).toContain('style === "scalping"');
    expect(checklist).toContain('p.goal === "prop_challenge"');
  });

  test("la mission proposée suit le terrain", () => {
    expect(defaultGoal("prop_challenge")).toBe("prop_challenge");
    expect(defaultGoal("funded")).toBe("fulltime");
    expect(defaultGoal("demo")).toBe("discipline");
    expect(defaultGoal(null)).toBe("consistency");
  });
});

describe("la séquence elle-même", () => {
  const src = readSource(import.meta.dir, "../src/app/features/onboarding/Onboarding.tsx");

  test("n'affiche aucun chiffre de performance inventé au lancement", () => {
    // L'ancien lancement montrait un P&L, un profit factor « 1.84 » et
    // « 18 jours » — pour un compte qui n'avait pas encore un seul trade.
    const code = stripComments(src);
    expect(code).not.toContain("1.84");
    expect(code).not.toContain("previewPnl");
  });

  test("le son ne part jamais avant un geste du trader", () => {
    const sound = readSource(import.meta.dir, "../src/app/features/onboarding/onboardingSound.ts");
    expect(sound).toContain("export function unlockAudio");
    // Le contexte audio n'est créé QUE dans `unlockAudio`.
    expect(stripComments(sound).match(/new Ctor\(/g)?.length).toBe(1);
    expect(stripComments(src)).toContain("unlockAudio();");
  });

  test("l'enregistrement critique bloque, le reste est au mieux", () => {
    const code = stripComments(src);
    expect(code).toContain('setSave("error")');
    expect(code).toContain("Promise.allSettled(tasks)");
    expect(code).toContain('new CustomEvent("tv-rules-updated"');
  });
});

/**
 * CHAQUE RÉPONSE ARRIVE QUELQUE PART — le contrat de la seconde passe.
 *
 * Avant : la calibration annonçait « construction de ta checklist » et rien
 * n'était écrit pour elle ; l'Edge Score ignorait le risque max choisi (il lit
 * le plan de trading, que l'onboarding ne touchait pas) ; Jarvis ignorait le
 * terrain (challenge ou compte financé). Ces tests tiennent chaque branchement.
 */
describe("le reste de l'application reçoit les réponses", () => {
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  const planTexts = {
    mission: "Pass my challenge — Hit the target, keep every rule",
    markets: ["Futures"],
    sessions: "09:30 · New York",
    preMarket: "Checklist first.",
    postMarket: "",
  };

  test("le plan de trading porte les chiffres des garde-fous (lus par l'Edge Score)", () => {
    const plan = planFromAnswers(base, structuredClone(EMPTY_PLAN), planTexts);
    expect(plan.risk.maxRiskPerTradePct).toBe("0.5");
    expect(plan.risk.maxDailyLossPct).toBe("2");
    expect(plan.limits.maxTradesPerDay).toBe("4");
    expect(plan.limits.stopAfterLosses).toBe("2");
    expect(plan.limits.noRevenge).toBe(true);
    expect(plan.mission).toBe(planTexts.mission);
    expect(plan.markets).toEqual(["Futures"]);
    expect(plan.sessions).toBe("09:30 · New York");
  });

  test("le plan ne réécrit jamais ce que le trader a rédigé lui-même", () => {
    const mine = {
      ...structuredClone(EMPTY_PLAN),
      mission: "Ma mission à moi",
      markets: ["NQ"],
      sessions: "10:00–11:00",
    };
    const plan = planFromAnswers(base, mine, planTexts);
    expect(plan.mission).toBe("Ma mission à moi");
    expect(plan.markets).toEqual(["NQ"]);
    expect(plan.sessions).toBe("10:00–11:00");
    // …mais les chiffres viennent d'être choisis : ils font foi.
    expect(plan.risk.maxRiskPerTradePct).toBe("0.5");
  });

  test("la checklist reprend les chiffres de l'onboarding, pas des génériques", () => {
    const over: OnboardingAnswers = {
      ...base,
      leak: "overtrading",
      guardrails: { ...base.guardrails, maxTrades: 3 },
    };
    const cfg = checklistFromAnswers(over, "en", money);
    const titles = cfg.items.map((i) => i.title).join(" | ");
    expect(titles).toContain("Max 3 trades today");
    expect(titles).not.toMatch(/max 1 trade/i);
    expect(titles).toContain("Daily loss limit known: $1,000");
    expect(cfg.items.length).toBeLessThanOrEqual(6);
    expect(cfg.startTime).toBe("09:30");
    expect(cfg.timeZone).toBe("America/New_York");
    // Le reste de la configuration est complet (la page l'attend tel quel).
    expect(cfg.fomo.length).toBe(4);
  });

  test("Jarvis retient le terrain, l'engagement daté et le ton — sans doublon du profil", () => {
    const mem = memoriesFromAnswers(base, money, "2026-10-18");
    const byKey = Object.fromEntries(mem.map((m) => [m.key, m]));
    expect(byKey["onb:arena"].content).toContain("prop firm evaluation with Apex");
    expect(byKey["onb:arena"].content).toContain("$50,000");
    expect(byKey["onb:commitments"].kind).toBe("decision");
    expect(byKey["onb:commitments"].content).toContain("2026-10-18");
    expect(byKey["onb:commitments"].content).toContain("max 0.5% risk per trade");
    expect(byKey["onb:commitments"].content).toContain("daily loss limit $1,000");
    expect(byKey["onb:coaching"].kind).toBe("preference");
    // Le profil (style, faiblesse, mission) vit déjà dans `profiles` : pas ici.
    expect(mem.every((m) => m.kind !== ("profile" as string))).toBe(true);
    expect(new Set(mem.map((m) => m.key)).size).toBe(mem.length);
  });

  test("le calculateur et le journal démarrent sur le bon marché", () => {
    expect(lotCalcSeed(base)).toEqual({ mode: "futures", riskPct: "0.5" });
    expect(lotCalcSeed({ ...base, assets: ["forex"] })?.mode).toBe("forex");
    expect(lotCalcSeed({ ...base, assets: ["stocks"] })).toBeNull();
    expect(ICT_CONFLUENCES).toContain("Fair value gap");
  });

  test("la calibration écrit réellement chaque bloc qu'elle annonce", () => {
    const code = stripComments(
      readSource(import.meta.dir, "../src/app/features/onboarding/Onboarding.tsx"),
    );
    for (const call of [
      "saveTradingPlan(",
      "saveChecklistConfig(",
      "remember(",
      "saveAccountBalance(",
      "saveConfluences(",
      'saveUserPref(userId, "lotCalc"',
      "saveTradingRules(",
    ]) {
      expect(code, call).toContain(call);
    }
    // L'écriture mémoire vient du trader : sa source le dit.
    expect(code).toContain('source: "onboarding"');
  });
});
