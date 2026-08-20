import type { Trade, TradeStats, MissedOpportunity } from "../../../../types";
import type { BehaviorSignals } from "../../../../utils/behaviorSignals";
import type { RuleAdherence } from "../../../../utils/ruleAdherence";
import type { EdgeResult } from "../../../../utils/edgeScore";
import type { TradeIntent, TradeReflection } from "../../../../store/tradeIntel";
import { computeStats } from "../../../../utils/tradeCalcs";
import { computeBehaviorSignals } from "../../../../utils/behaviorSignals";
import { sampleVerdict, MIN_SAMPLE } from "@/modules/coaching";
import type {
  WeekComparison,
  WeeklyEvidence,
  WeeklyEvolution,
  WeeklyGoal,
  WeeklySection,
} from "./types";

/**
 * Weekly Evolution — le GÉNÉRATEUR (Step 7). PUR et déterministe.
 *
 * Orchestration uniquement : il découpe l'historique en semaines (lundi →
 * lundi, même convention que la notification weekly_review), applique les
 * fonctions EXISTANTES (`computeStats`, `computeBehaviorSignals`) aux fenêtres,
 * et produit des sections adossées à leurs preuves. Aucune métrique dupliquée.
 */

export interface WeeklyInput {
  trades: Trade[];
  stats: TradeStats;
  signals: BehaviorSignals;
  adherence: RuleAdherence[];
  edge: EdgeResult | null;
  goals?: WeeklyGoal[];
  intents?: Record<string, TradeIntent | null> | null;
  reflections?: Record<string, TradeReflection | null> | null;
  missed?: MissedOpportunity[] | null;
  /** Injectable pour les tests. Défaut : maintenant. */
  now?: Date;
}

// ── Bornes de semaine (lundi, même convention que la notification weekly)
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // 0 = lundi
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() - day);
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const round = (n: number, p = 1): number => {
  const f = 10 ** p;
  return Math.round(n * f) / f;
};
const money = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}${Math.abs(Math.round(n))}$`;
const pct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100);

/** Comparaison semaine courante vs précédente pour une métrique. */
function compareWeek(
  thisValue: number,
  prevValue: number,
  thisSample: number,
  prevSample: number,
): WeekComparison {
  const sufficient = thisSample >= MIN_SAMPLE && prevSample >= 3;
  return {
    value: round(thisValue),
    previous: prevSample >= 3 ? round(prevValue) : null,
    delta: prevSample >= 3 ? round(thisValue - prevValue) : null,
    deltaPct:
      prevSample >= 3 && prevValue !== 0
        ? round(((thisValue - prevValue) / Math.abs(prevValue)) * 100)
        : null,
    sample: thisSample,
    previousSample: prevSample,
    sufficient,
  };
}

const weakLine = (fr: string, en: string) => ({ fr, en });

type Line = WeeklySection["lines"];

function evid(
  partial: Omit<WeeklyEvidence, "lowSample"> & { lowSample?: boolean },
): WeeklyEvidence {
  return { lowSample: sampleVerdict(partial.sampleSize).sufficient ? false : true, ...partial };
}

const idsOf = (ts: Trade[]) => ts.map((t) => t.id);

export function buildWeeklyEvolution(input: WeeklyInput): WeeklyEvolution {
  const now = input.now ?? new Date();
  const mondayThis = mondayOf(now);
  const mondayPrev = addDays(mondayThis, -7);
  const thisStart = iso(mondayThis);
  const prevStart = iso(mondayPrev);
  const period = thisStart;
  const previousPeriod = prevStart;

  const thisWeek = input.trades.filter((t) => t.date >= thisStart);
  const prevWeek = input.trades.filter((t) => t.date >= prevStart && t.date < thisStart);

  const empty = (): WeeklyEvolution => ({
    status: "empty",
    period,
    previousPeriod,
    score: null,
    sections: [],
  });

  if (thisWeek.length === 0) return empty();

  const thisStats = computeStats(thisWeek);
  const prevStats = computeStats(prevWeek);
  const weeklySignals = computeBehaviorSignals(thisWeek);

  // ── SCORE GLOBAL — Edge Score actuel (window 10 jours) vs semaine précédente.
  // On ne PEUT pas recalculer l'edge d'une semaine passée (c'est une fenêtre
  // glissante) : on compare donc les deux fenêtres quand les deux existent,
  // sinon on affiche le score actuel sans comparaison inventée.
  const score = input.edge
    ? {
        current: input.edge.score,
        previous: null,
        delta: null,
      }
    : null;

  const sections: WeeklySection[] = [];

  // ── 1. WEEK AT A GLANCE ──────────────────────────────────────────────────
  {
    const lines: Line = [];
    const wr = pct(thisStats.winRate);
    const pf = round(thisStats.profitFactor, 2);
    const prevWr = prevWeek.length >= 3 ? pct(prevStats.winRate) : null;
    const prevPf = prevWeek.length >= 3 ? round(prevStats.profitFactor, 2) : null;
    lines.push(
      weakLine(
        `${thisWeek.length} trade(s), ${money(thisStats.totalPnl)}, win rate ${wr ?? "—"} %${prevWr != null ? ` (semaine précédente ${prevWr} %)` : ""}.`,
        `${thisWeek.length} trade(s), ${money(thisStats.totalPnl)}, win rate ${wr ?? "—"}%${prevWr != null ? ` (previous week ${prevWr}%)` : ""}.`,
      ),
      weakLine(
        `Profit factor ${pf}${prevPf != null ? ` vs ${prevPf} la semaine précédente` : ""}.`,
        `Profit factor ${pf}${prevPf != null ? ` vs ${prevPf} last week` : ""}.`,
      ),
    );
    if (input.edge?.score != null) {
      lines.push(
        weakLine(
          `Edge Score actuel : ${input.edge.score}${input.edge.weakest ? ` — point faible : ${input.edge.weakest}` : ""}.`,
          `Current Edge Score: ${input.edge.score}${input.edge.weakest ? ` — weakest: ${input.edge.weakest}` : ""}.`,
        ),
      );
    }
    sections.push({
      id: "glance",
      title: weakLine("En bref", "At a glance"),
      tone: "accent",
      lines,
    });
  }

  // ── 2 & 3. WHAT IMPROVED / WHAT GOT WORSE ───────────────────────────────
  {
    const metrics: { key: string; label: string; thisValue: number; prevValue: number }[] = [
      {
        key: "win_rate",
        label: "win rate",
        thisValue: thisStats.winRate * 100,
        prevValue: prevStats.winRate * 100,
      },
      {
        key: "profit_factor",
        label: "profit factor",
        thisValue: thisStats.profitFactor,
        prevValue: prevStats.profitFactor,
      },
      {
        key: "total_pnl",
        label: "P&L",
        thisValue: thisStats.totalPnl,
        prevValue: prevStats.totalPnl,
      },
      { key: "avg_rr", label: "avg R:R", thisValue: thisStats.avgRR, prevValue: prevStats.avgRR },
    ];

    const improved: WeeklyEvidence[] = [];
    const worse: WeeklyEvidence[] = [];
    for (const m of metrics) {
      const c = compareWeek(m.thisValue, m.prevValue, thisWeek.length, prevWeek.length);
      if (!c.sufficient) continue;
      const isImprovement =
        m.key === "total_pnl" ? m.thisValue > m.prevValue : m.thisValue >= m.prevValue;
      const target = isImprovement ? improved : worse;
      target.push(
        evid({
          claim: `${m.key}_${isImprovement ? "up" : "down"}`,
          metric: m.label,
          value: round(m.thisValue),
          sampleSize: thisWeek.length,
          period,
          compare: c,
          affectedTradeIds: idsOf(thisWeek),
          filter: { trades: idsOf(thisWeek) },
          page: "journal",
        }),
      );
    }

    if (improved.length > 0) {
      sections.push({
        id: "improved",
        title: weakLine("Ce qui s'est amélioré", "What improved"),
        tone: "success",
        lines: improved.map((e) =>
          weakLine(
            `${e.metric} : ${e.metric === "P&L" ? money(e.value) : e.value} (semaine précédente ${e.compare?.previous != null ? (e.metric === "P&L" ? money(e.compare.previous) : e.compare.previous) : "—"}).`,
            `${e.metric}: ${e.metric === "P&L" ? money(e.value) : e.value} (previous week ${e.compare?.previous != null ? (e.metric === "P&L" ? money(e.compare.previous) : e.compare.previous) : "—"}).`,
          ),
        ),
        evidence: improved,
      });
    }

    if (worse.length > 0) {
      sections.push({
        id: "worse",
        title: weakLine("Ce qui s'est dégradé", "What got worse"),
        tone: "warning",
        lines: worse.map((e) =>
          weakLine(
            `${e.metric} : ${e.metric === "P&L" ? money(e.value) : e.value} (semaine précédente ${e.compare?.previous != null ? (e.metric === "P&L" ? money(e.compare.previous) : e.compare.previous) : "—"}). Formulation prudente : selon les données disponibles, cela coïncide avec la semaine écoulée — pas une causalité.`,
            `${e.metric}: ${e.metric === "P&L" ? money(e.value) : e.value} (previous week ${e.compare?.previous != null ? (e.metric === "P&L" ? money(e.compare.previous) : e.compare.previous) : "—"}). Cautious wording: per the available data, this coincides with last week — not causation.`,
          ),
        ),
        evidence: worse,
      });
    }
  }

  // ── 4. BEST EDGE (cette semaine, par dimension déjà mesurée) ─────────────
  {
    // Dimension la plus actionnable : le setup (stratégie). Les buckets sont
    // produits par `computeBehaviorSignals` — aucune refonte de métrique.
    const buckets = weeklySignals.byStrategy;
    if (buckets && buckets.length > 0) {
      const best = [...buckets].sort((a, b) => b.pnl - a.pnl)[0];
      if (best && best.trades >= MIN_SAMPLE && best.pnl > 0) {
        const ids = thisWeek.filter((t) => t.strategy === best.key).map((t) => t.id);
        sections.push({
          id: "edge",
          title: weakLine("Votre meilleur setup", "Your best setup"),
          tone: "success",
          lines: [
            weakLine(
              `${best.key} : ${best.trades} trades, win rate ${best.winRatePct ?? "—"} %, ${money(best.pnl)}.`,
              `${best.key}: ${best.trades} trades, win rate ${best.winRatePct ?? "—"}%, ${money(best.pnl)}.`,
            ),
          ],
          evidence: [
            evid({
              claim: "best_strategy",
              metric: "setup_pnl",
              value: best.pnl,
              sampleSize: best.trades,
              period,
              compare: null,
              affectedTradeIds: ids,
              filter: { trades: ids },
              page: "journal",
            }),
          ],
        });
      }
    }
  }

  // ── 5. BIGGEST LEAK — fréquence vs coût ─────────────────────────────────
  {
    const mistakes = Object.entries(thisStats.mistakeStats).map(([name, v]) => ({ name, ...v }));
    const byCost = mistakes
      .filter((m) => m.totalPnl < 0)
      .sort((a, b) => a.totalPnl - b.totalPnl)[0];
    const byFrequency = mistakes.sort((a, b) => b.count - a.count)[0];
    if (byCost && byCost.totalPnl < 0) {
      const lines: Line = [
        weakLine(
          `Le plus coûteux : « ${byCost.name} » — ${byCost.count}×, ${money(byCost.totalPnl)}.`,
          `Costliest: "${byCost.name}" — ${byCost.count}×, ${money(byCost.totalPnl)}.`,
        ),
      ];
      if (byFrequency && byFrequency.name !== byCost.name && byFrequency.count > byCost.count) {
        lines.push(
          weakLine(
            `Le plus fréquent : « ${byFrequency.name} » — ${byFrequency.count}× sur la semaine. Le plus fréquent n'est pas forcément le plus coûteux.`,
            `Most frequent: "${byFrequency.name}" — ${byFrequency.count}× this week. Most frequent isn't necessarily most costly.`,
          ),
        );
      }
      const ids = thisWeek.filter((t) => t.mistakes.includes(byCost.name)).map((t) => t.id);
      sections.push({
        id: "leak",
        title: weakLine("Votre plus grosse fuite", "Your biggest leak"),
        tone: "danger",
        lines,
        evidence: [
          evid({
            claim: "biggest_leak",
            metric: "mistake_cost",
            value: byCost.totalPnl,
            sampleSize: byCost.count,
            period,
            compare: null,
            affectedTradeIds: ids,
            filter: { trades: ids, mistake: byCost.name },
            page: "journal",
          }),
        ],
      });
    }
  }

  // ── 6. INTENT → EXÉCUTION → RÉSULTAT ─────────────────────────────────────
  {
    const reflected = thisWeek.filter((t) => input.reflections?.[t.id]);
    const withIntent = thisWeek.filter((t) => input.intents?.[t.id]);
    const lines: Line = [];
    const lowSample = reflected.length + withIntent.length < MIN_SAMPLE;

    const planBroken = reflected.filter(
      (t) => input.reflections![t.id]!.planRespected === "no",
    ).length;
    const planRespected = reflected.filter(
      (t) => input.reflections![t.id]!.planRespected === "yes",
    ).length;
    if (reflected.length > 0) {
      lines.push(
        weakLine(
          `Plan respecté sur ${planRespected}/${reflected.length} trade(s) réfléchi(s) de la semaine.`,
          `Plan respected on ${planRespected}/${reflected.length} reflected trade(s) this week.`,
        ),
      );
      if (planBroken > 0) {
        lines.push(
          weakLine(
            `${planBroken} trade(s) entré(s) hors plan.`,
            `${planBroken} trade(s) taken off-plan.`,
          ),
        );
      }
    }
    const riskBreach = withIntent.filter((t) => {
      const i = input.intents![t.id]!;
      return i.plannedRisk != null && t.riskAmount > i.plannedRisk * 1.05;
    }).length;
    if (riskBreach > 0) {
      lines.push(
        weakLine(
          `${riskBreach} trade(s) où le risque réel a dépassé le risque prévu.`,
          `${riskBreach} trade(s) where actual risk exceeded planned risk.`,
        ),
      );
    }
    if (lines.length > 0) {
      sections.push({
        id: "intent",
        title: weakLine("Intention → Exécution → Résultat", "Intent → Execution → Result"),
        lines,
        tone: lowSample ? "warning" : undefined,
        evidence: [
          {
            claim: "intent_execution_week",
            metric: "plan_respected",
            value: planRespected,
            sampleSize: reflected.length,
            period,
            compare: null,
            affectedTradeIds: idsOf(thisWeek),
            filter: { trades: idsOf(thisWeek) },
            page: "journal",
            lowSample,
          },
        ],
      });
    }
  }

  // ── 7. MISSED SETUPS (faits uniquement, jamais le résultat d'un trade non pris)
  {
    const missedThisWeek = (input.missed ?? []).filter((m) => m.date >= thisStart);
    if (missedThisWeek.length > 0) {
      const estR = missedThisWeek.reduce((s, m) => s + m.estimatedR, 0);
      const topSymbols = missedThisWeek.reduce<Map<string, number>>((map, m) => {
        if (m.symbol) map.set(m.symbol, (map.get(m.symbol) ?? 0) + 1);
        return map;
      }, new Map());
      const top = [...topSymbols.entries()].sort((a, b) => b[1] - a[1])[0];
      sections.push({
        id: "missed",
        title: weakLine("Setups manqués", "Missed setups"),
        tone: "accent",
        lines: [
          weakLine(
            `${missedThisWeek.length} setup(s) manqué(s) cette semaine, environ ${round(estR, 0)} R estimés laissés sur la table.${top ? ` Le plus noté : ${top[0]} (${top[1]}×).` : ""}`,
            `${missedThisWeek.length} missed setup(s) this week, roughly ${round(estR, 0)} estimated R left on the table.${top ? ` Most noted: ${top[0]} (${top[1]}×).` : ""}`,
          ),
          weakLine(
            "Valeur estimée a priori, pas un résultat garanti — un setup manqué n'est pas un gain certain.",
            "Estimated value a priori, not a guaranteed outcome — a missed setup is not a certain win.",
          ),
        ],
      });
    }
  }

  // ── 8. GOALS — progression réelle vs objectif (aucune modification auto) ──
  {
    const goals = input.goals ?? [];
    if (goals.length > 0) {
      const lines: Line = goals
        .slice(0, 3)
        .map((g) =>
          weakLine(
            `${g.kind} : ${round(g.current)} / ${round(g.target)}.`,
            `${g.kind}: ${round(g.current)} / ${round(g.target)}.`,
          ),
        );
      sections.push({
        id: "goals",
        title: weakLine("Objectifs", "Goals"),
        lines,
        evidence: undefined,
      });
    }
  }

  // ── 9. DISCIPLINE — synthèse (jamais réduite au PnL) ─────────────────────
  {
    const lines: Line = [];
    const weakest = input.adherence[0];
    if (weakest) {
      lines.push(
        weakLine(
          `Règle la plus fragile : « ${weakest.text} » — tenue ${weakest.kept}/${weakest.applicable}.`,
          `Weakest rule: "${weakest.text}" — kept ${weakest.kept}/${weakest.applicable}.`,
        ),
      );
    }
    if (input.signals.disciplinePct !== undefined) {
      lines.push(
        weakLine(
          `${input.signals.disciplinePct} % de trades sans erreur cochée sur les derniers jours.`,
          `${input.signals.disciplinePct}% of trades logged with no mistake flagged lately.`,
        ),
      );
    }
    if (input.edge?.subs?.risk?.value != null) {
      lines.push(
        weakLine(
          `Respect du risque (Edge Score) : ${input.edge.subs.risk.value}${input.edge.subs.risk.detail ? ` (${input.edge.subs.risk.detail})` : ""}.`,
          `Risk respect (Edge Score): ${input.edge.subs.risk.value}${input.edge.subs.risk.detail ? ` (${input.edge.subs.risk.detail})` : ""}.`,
        ),
      );
    }
    if (lines.length > 0) {
      sections.push({
        id: "discipline",
        title: weakLine("Discipline", "Discipline"),
        lines,
      });
    }
  }

  // ── 10. NEXT WEEK — max 3 priorités avec preuve, converties en missions ──
  {
    const priorities: {
      text: { fr: string; en: string };
      mission: { fr: string; en: string };
      evidence: WeeklyEvidence;
    }[] = [];
    const leakSec = sections.find((s) => s.id === "leak");
    if (leakSec?.evidence?.[0]) {
      const e = leakSec.evidence[0];
      priorities.push({
        text: weakLine(
          `Réduire « ${e.metric === "mistake_cost" ? (leakSec.lines[0].fr.match(/"([^"]+)"/)?.[1] ?? e.metric) : e.metric} »`,
          `Cut "${leakSec.lines[0].en.match(/"([^"]+)"/)?.[1] ?? e.metric}"`,
        ),
        mission: weakLine(
          "Mission mesurable : 0 trade dans les 10 minutes après une perte, et noter chaque occurrence.",
          "Measurable mission: 0 trades within 10 minutes of a loss, and log every occurrence.",
        ),
        evidence: e,
      });
    }
    const intentSec = sections.find((s) => s.id === "intent");
    if (intentSec?.evidence?.[0] && priorities.length < 3) {
      priorities.push({
        text: weakLine(
          "Respecter le plan sur 100 % des entrées (zéro entrée hors plan).",
          "Follow the plan on 100% of entries (zero off-plan entries).",
        ),
        mission: weakLine(
          "Mission mesurable : plan respecté = 100 % la semaine prochaine (mesuré via tes réflexions).",
          "Measurable mission: plan respected on 100% of trades next week (measured via your reflections).",
        ),
        evidence: intentSec.evidence[0],
      });
    }
    const worseSec = sections.find((s) => s.id === "worse");
    if (worseSec?.evidence?.[0] && priorities.length < 3) {
      const e = worseSec.evidence[0];
      priorities.push({
        text: weakLine(
          `Travailler sur ${e.metric} (en recul cette semaine).`,
          `Work on ${e.metric} (down this week).`,
        ),
        mission: weakLine(
          "Mission mesurable : améliorer cette métrique la semaine prochaine (même définition, même fenêtre).",
          "Measurable mission: improve this metric next week (same definition, same window).",
        ),
        evidence: e,
      });
    }

    if (priorities.length > 0) {
      sections.push({
        id: "next",
        title: weakLine("La semaine prochaine", "Next week"),
        tone: "accent",
        lines: priorities.map((p) => weakLine(p.text.fr, p.text.en)),
        evidence: priorities.map((p) => p.evidence),
      });
    }
  }

  const concluded = sections.some((s) => s.evidence?.length);
  const status: WeeklyEvolution["status"] =
    thisWeek.length === 0 ? "empty" : concluded ? "ready" : "learning";

  return {
    status,
    period,
    previousPeriod,
    score,
    sections,
  };
}
