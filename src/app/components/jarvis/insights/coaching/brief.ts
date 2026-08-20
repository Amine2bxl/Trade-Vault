import type { Trade, TradeStats } from "../../../../types";
import type { BehaviorSignals } from "../../../../utils/behaviorSignals";
import type { DailyRule } from "../../../../utils/edgeScore";
import type { RuleAdherence } from "../../../../utils/ruleAdherence";
import { sampleVerdict, MIN_SAMPLE } from "@/modules/coaching";
import { formatMoney } from "../copy/templates";
import type { BriefEvidence, BriefSection, DailyBrief } from "./types";

/**
 * Daily Brief (Step 6A) — le résumé contextualisé que Jarvis affiche à
 * l'ouverture. PUR et déterministe : il ne fait que RELIER des calculs qui
 * existent déjà (`computeStats`, `computeBehaviorSignals`, `deriveDailyRule`,
 * `computeRuleAdherence`) — aucun calcul dupliqué, aucun chiffre inventé.
 *
 * Chaque claim porte son `sampleSize` ; sous `MIN_SAMPLE`, le champ `lowSample`
 * force `toBriefBlocks` à formuler « signal faible » au lieu d'affirmer.
 */

export interface DailyBriefInput {
  trades: Trade[];
  stats: TradeStats;
  signals: BehaviorSignals;
  rule: DailyRule | null;
  adherence: RuleAdherence[];
  goals?: { kind: string; target: number; current: number }[];
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const GOAL_LABELS: Record<string, { fr: string; en: string }> = {
  capital: { fr: "Capital", en: "Capital" },
  profit_factor: { fr: "Profit factor", en: "Profit factor" },
  max_drawdown: { fr: "Drawdown max", en: "Max drawdown" },
  win_rate: { fr: "Win rate", en: "Win rate" },
  avg_rr: { fr: "R moyen", en: "Avg R" },
  discipline: { fr: "Discipline", en: "Discipline" },
  custom: { fr: "Objectif", en: "Goal" },
};

const GOAL_UNIT: Record<string, string> = {
  capital: "$",
  win_rate: "%",
  max_drawdown: "%",
  discipline: "%",
  avg_rr: "R",
  profit_factor: "",
  custom: "",
};

const weekdayIndex = (name: string): number => WEEKDAYS.indexOf(name);
const weekdayFr = (name: string): string => WEEKDAYS_FR[weekdayIndex(name)] ?? name;

const signedMoney = (v: number, lang: "fr" | "en"): string =>
  `${v < 0 ? "-" : "+"}${formatMoney(Math.abs(v), lang)}`;

const round = (n: number, p = 1): number => {
  const f = 10 ** p;
  return Math.round(n * f) / f;
};

// ── Sections ─────────────────────────────────────────────────────────────────

function objectiveSection(input: DailyBriefInput): BriefSection | null {
  const lines: BriefSection["lines"] = [];
  const goal = input.goals?.[0];
  if (goal) {
    const label = GOAL_LABELS[goal.kind] ?? { fr: goal.kind, en: goal.kind };
    const unit = GOAL_UNIT[goal.kind] ?? "";
    lines.push({
      fr: `Objectif « ${label.fr} » : ${round(goal.current)}${unit} / ${round(goal.target)}${unit}.`,
      en: `Goal "${label.en}": ${round(goal.current)}${unit} / ${round(goal.target)}${unit}.`,
    });
  }
  if (input.rule?.leak) {
    lines.push({
      fr: `Mission du jour : ${input.rule.leak}.`,
      en: `Today's mission: ${input.rule.leak}.`,
    });
  }
  if (lines.length === 0) return null;
  return { id: "objective", title: { fr: "Objectif", en: "Objective" }, tone: "accent", lines };
}

function disciplineSection(input: DailyBriefInput): BriefSection | null {
  const lines: BriefSection["lines"] = [];
  const weakest = input.adherence[0];

  if (weakest) {
    const verdict = sampleVerdict(weakest.applicable);
    lines.push({
      fr: `Règle la plus fragile : « ${weakest.text} » — tenue ${weakest.kept}/${weakest.applicable}.`,
      en: `Weakest rule: "${weakest.text}" — kept ${weakest.kept}/${weakest.applicable}.`,
    });
    if (!verdict.sufficient) {
      lines.push({
        fr: `Signal faible (${weakest.applicable} occurrences) — trop tôt pour conclure.`,
        en: `Weak signal (${weakest.applicable} occurrences) — too early to conclude.`,
      });
    }
  } else {
    lines.push({
      fr: "Aucune règle vérifiable active — ajoute une règle de risque pour que Jarvis mesure ta tenue.",
      en: "No checkable rule active — add a risk rule so Jarvis can measure how well you hold it.",
    });
  }

  if (input.signals.disciplinePct !== undefined && input.trades.length >= 5) {
    lines.push({
      fr: `${input.signals.disciplinePct} % de trades sans erreur cochée.`,
      en: `${input.signals.disciplinePct}% of trades logged with no mistake flagged.`,
    });
  }

  if (lines.length === 0) return null;
  return {
    id: "discipline",
    title: { fr: "Discipline", en: "Discipline" },
    tone: weakest && weakest.ratePct < 60 ? "warning" : undefined,
    lines,
  };
}

function recentSection(input: DailyBriefInput): BriefSection | null {
  const lines: BriefSection["lines"] = [];
  let evidence: BriefEvidence | undefined;

  const worst = Object.entries(input.stats.mistakeStats)
    .filter(([, v]) => v.totalPnl < 0)
    .sort((a, b) => a[1].totalPnl - b[1].totalPnl)[0];

  if (worst) {
    const [name, s] = worst;
    const low = s.count < MIN_SAMPLE;
    lines.push({
      fr: `Erreur récurrente : « ${name} » — ${s.count}×, ${signedMoney(s.totalPnl, "fr")}.`,
      en: `Recurring mistake: "${name}" — ${s.count}×, ${signedMoney(s.totalPnl, "en")}.`,
    });
    evidence = {
      metric: "mistake_cost",
      sampleSize: s.count,
      metrics: [
        { label: { fr: "Erreur", en: "Mistake" }, value: name },
        { label: { fr: "Occurrences", en: "Occurrences" }, value: String(s.count) },
        {
          label: { fr: "Coût", en: "Cost" },
          value: signedMoney(s.totalPnl, "en"),
          tone: "down" as const,
        },
      ],
      filter: { mistake: name },
      page: "journal",
      lowSample: low ? { n: s.count, required: MIN_SAMPLE, unit: "trades" } : undefined,
    };
  }

  const strategies = input.signals.byStrategy;
  const best = strategies?.[strategies.length - 1];
  if (best && best.pnl > 0 && best.trades >= 3) {
    lines.push({
      fr: `Setup le plus rentable : ${best.key} — ${best.winRatePct ?? "—"} %, ${signedMoney(best.pnl, "fr")}.`,
      en: `Most profitable setup: ${best.key} — ${best.winRatePct ?? "—"}%, ${signedMoney(best.pnl, "en")}.`,
    });
  }

  if (lines.length === 0) return null;
  return {
    id: "recent",
    title: { fr: "Historique récent", en: "Recent history" },
    lines,
    evidence,
  };
}

function temporalSection(input: DailyBriefInput): BriefSection | null {
  const wd = input.signals.byWeekday;
  if (!wd || wd.length < 2) return null;

  const worst = wd[0];
  const best = wd[wd.length - 1];
  const lines: BriefSection["lines"] = [];

  if (best && best.pnl > 0) {
    const low = best.trades < MIN_SAMPLE;
    lines.push({
      fr: `Meilleur jour : ${weekdayFr(best.key)} — ${best.winRatePct ?? "—"} % sur ${best.trades} trades.`,
      en: `Best day: ${best.key} — ${best.winRatePct ?? "—"}% over ${best.trades} trades.`,
    });
    if (low) {
      lines.push({
        fr: `Signal faible (${best.trades} trades) — trop tôt pour conclure.`,
        en: `Weak signal (${best.trades} trades) — too early to conclude.`,
      });
    }
  }
  if (worst && worst.pnl < 0 && worst.key !== best?.key) {
    lines.push({
      fr: `Jour le plus coûteux : ${weekdayFr(worst.key)} — ${signedMoney(worst.pnl, "fr")} sur ${worst.trades} trades.`,
      en: `Costliest day: ${worst.key} — ${signedMoney(worst.pnl, "en")} over ${worst.trades} trades.`,
    });
  }

  if (lines.length === 0) return null;

  const idx = best ? weekdayIndex(best.key) : -1;
  const evidence: BriefEvidence | undefined =
    best && idx >= 0
      ? {
          metric: "weekday_win_rate",
          sampleSize: best.trades,
          metrics: [
            { label: { fr: "Meilleur jour", en: "Best day" }, value: best.key },
            {
              label: { fr: "Win rate", en: "Win rate" },
              value: best.winRatePct != null ? `${best.winRatePct} %` : "—",
              tone: "up" as const,
            },
          ],
          filter: { weekday: idx },
          page: "journal",
          lowSample:
            best.trades < MIN_SAMPLE
              ? { n: best.trades, required: MIN_SAMPLE, unit: "trades" }
              : undefined,
        }
      : undefined;

  return {
    id: "temporal",
    title: { fr: "Contexte temporel", en: "Temporal context" },
    lines,
    evidence,
  };
}

export function buildDailyBrief(input: DailyBriefInput): DailyBrief {
  const sections = [
    objectiveSection(input),
    disciplineSection(input),
    recentSection(input),
    temporalSection(input),
  ].filter((s): s is BriefSection => s !== null);

  if (input.trades.length === 0) {
    return { status: "learning", sections: [] };
  }

  return { status: sections.length > 0 ? "ready" : "learning", sections };
}
