import { describe, expect, it } from "bun:test";
import { evaluateNotificationRules, type RuleContext } from "./rules";
import { categoryOf } from "./engine";

// Un trader fictif — données stables, règles prévisibles.
function baseContext(overrides: Partial<RuleContext> = {}): RuleContext {
  const today = new Date().toISOString().slice(0, 10);
  return {
    trades: [
      { date: today, pnl: -120, mistakes: ["overtrading"] },
      { date: today, pnl: -80, mistakes: ["overtrading"] },
      { date: today, pnl: -55, mistakes: ["revenge_trading"] },
    ],
    stats: {
      totalPnl: -255,
      winRate: 0.2,
      tradeCount: 12,
      mistakeStats: {
        overtrading: { count: 6, totalPnl: -420 },
        revenge_trading: { count: 3, totalPnl: -90 },
      },
    },
    rulesEnabled: 2,
    ...overrides,
  };
}

const keyOf = (rules: ReturnType<typeof evaluateNotificationRules>, key: string) =>
  rules.some((r) => r.key.startsWith(key));

describe("coded notification rules", () => {
  it("flags a 3+ losing streak under Risk", () => {
    const rules = evaluateNotificationRules(baseContext());
    const streak = rules.find((r) => r.key.startsWith("risk_loss_streak"));
    expect(streak).toBeDefined();
    expect(streak!.input.kind).toBe("risk_loss_streak");
    expect(streak!.input.severity).toBe("warning");
    expect(streak!.input.category).toBe("risk");
  });

  it("does NOT flag a streak when recent trades win", () => {
    const today = new Date().toISOString().slice(0, 10);
    const rules = evaluateNotificationRules(
      baseContext({
        trades: [
          { date: today, pnl: 140, mistakes: [] },
          { date: today, pnl: -30, mistakes: [] },
          { date: today, pnl: 90, mistakes: [] },
        ],
      }),
    );
    expect(keyOf(rules, "risk_loss_streak")).toBe(false);
  });

  it("surfaces the most expensive mistake as a leak", () => {
    const rules = evaluateNotificationRules(baseContext());
    const leak = rules.find((r) => r.key.startsWith("risk_leak"));
    expect(leak).toBeDefined();
    expect(leak!.input.data?.["mistake"]).toBe("overtrading");
  });

  it("fires an activity lull when the last trade is 5+ days old", () => {
    const old = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const rules = evaluateNotificationRules(
      baseContext({ trades: [{ date: old, pnl: 40, mistakes: [] }] }),
    );
    expect(keyOf(rules, "activity_lull")).toBe(true);
  });

  it("does not fire a lull when trades are recent", () => {
    const rules = evaluateNotificationRules(baseContext());
    expect(keyOf(rules, "activity_lull")).toBe(false);
  });

  it("signs discipline is armed when rules are enabled", () => {
    const rules = evaluateNotificationRules(baseContext());
    expect(keyOf(rules, "discipline_armed")).toBe(true);
    const none = evaluateNotificationRules(baseContext({ rulesEnabled: 0 }));
    expect(keyOf(none, "discipline_armed")).toBe(false);
  });

  it("carries a short action plan and CTA on every rule", () => {
    for (const rule of evaluateNotificationRules(baseContext())) {
      expect(typeof rule.input.data?.["plan"]).toBe("string");
      expect(typeof rule.input.data?.["ctaLabel"]).toBe("string");
      expect(typeof rule.input.data?.["ctaPage"]).toBe("string");
      expect(rule.input.channels).toContain("dashboard");
    }
  });
});

/**
 * Règles PROACTIVES — non-régression.
 *
 * Ces deux règles décident quand Jarvis interrompt le trader. C'est le
 * paramètre le plus dangereux du produit : un canal bruyant se fait
 * désactiver, et on perd alors TOUT le canal — y compris les alertes de
 * risque qui comptent. Les seuils sont donc verrouillés par test.
 */
describe("règles proactives", () => {
  it("félicite un recul NET, chiffré", () => {
    const rules = evaluateNotificationRules(
      baseContext({
        mistakeTrends: [{ mistake: "Overtrading", deltaPct: -60, recent: 2, previous: 5 }],
      }),
    );
    const r = rules.find((x) => x.input.kind === "pattern_detected");
    expect(r).toBeDefined();
    // La preuve chiffrée doit être dans le message : féliciter sans chiffre
    // serait de la flatterie, et le produit s'interdit la flatterie.
    expect(r?.input.body).toContain("5");
    expect(r?.input.body).toContain("2");
  });

  it("SE TAIT sur un recul faible — sinon le canal devient du bruit", () => {
    const rules = evaluateNotificationRules(
      baseContext({
        mistakeTrends: [{ mistake: "Overtrading", deltaPct: -10, recent: 9, previous: 10 }],
      }),
    );
    expect(rules.find((x) => x.input.kind === "pattern_detected")).toBeUndefined();
  });

  it("SE TAIT quand l'échantillon est trop mince pour conclure", () => {
    // 1 fois -> 0 fois, c'est -100 % mais ça ne prouve rien.
    const rules = evaluateNotificationRules(
      baseContext({
        mistakeTrends: [{ mistake: "Overtrading", deltaPct: -100, recent: 0, previous: 1 }],
      }),
    );
    expect(rules.find((x) => x.input.kind === "pattern_detected")).toBeUndefined();
  });

  it("alerte sur la règle la MOINS tenue", () => {
    const rules = evaluateNotificationRules(
      baseContext({
        adherence: [
          { text: "Max 2 trades par jour", kept: 8, applicable: 10, ratePct: 80 },
          { text: "Pas de trade après 16h", kept: 2, applicable: 10, ratePct: 20 },
        ],
      }),
    );
    const r = rules.find((x) => x.input.kind === "discipline_warning");
    expect(r?.input.body).toContain("Pas de trade après 16h");
  });

  it("SE TAIT sur une règle bien tenue", () => {
    const rules = evaluateNotificationRules(
      baseContext({
        adherence: [{ text: "Max 2 trades", kept: 9, applicable: 10, ratePct: 90 }],
      }),
    );
    expect(rules.find((x) => x.input.kind === "discipline_warning")).toBeUndefined();
  });

  it("SE TAIT sur une règle à peine éprouvée", () => {
    // 0 sur 2 est un mauvais ratio, mais deux trades ne font pas un constat.
    const rules = evaluateNotificationRules(
      baseContext({
        adherence: [{ text: "Max 2 trades", kept: 0, applicable: 2, ratePct: 0 }],
      }),
    );
    expect(rules.find((x) => x.input.kind === "discipline_warning")).toBeUndefined();
  });

  it("sans données de tendance ni d'adhérence, aucune de ces règles ne se déclenche", () => {
    const rules = evaluateNotificationRules(baseContext());
    expect(rules.find((x) => x.input.kind === "pattern_detected")).toBeUndefined();
    expect(rules.find((x) => x.input.kind === "discipline_warning")).toBeUndefined();
  });
});

describe("categoryOf — un progrès n'est pas un risque", () => {
  it("range une AMÉLIORATION avec les observations de Jarvis, pas dans les risques", () => {
    // `pattern_detected` couvre deux réalités opposées : un motif nuisible qui
    // apparaît, et un motif nuisible qui RECULE. Le classer systématiquement en
    // `risk` affichait « ton erreur recule de 40 % » en ROUGE, sous une icône
    // de tendance baissière, et le faisait remonter dans le filtre « risque ».
    // Un produit dont la seule bonne nouvelle ressemble à une alerte apprend au
    // trader à redouter ses notifications.
    expect(categoryOf("pattern_detected", "success")).toBe("jarvis");
  });

  it("garde un motif NUISIBLE dans les risques", () => {
    expect(categoryOf("pattern_detected", "warning")).toBe("risk");
    expect(categoryOf("pattern_detected")).toBe("risk");
  });

  it("ne change rien aux autres catégories", () => {
    expect(categoryOf("discipline_warning", "success")).toBe("discipline");
    expect(categoryOf("goal_completed", "success")).toBe("goals");
    expect(categoryOf("risk_max_loss", "success")).toBe("risk");
  });
});
