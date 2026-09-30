import type { JarvisHomeData } from "./types";

/**
 * Suggestions intelligentes (Phase 1, Étape 6).
 *
 * Pur et déterministe : données (signaux/stats) + page courante + langue →
 * suggestions pertinentes pour CETTE situation. Aucune UI, aucun hook.
 *
 * Chaque suggestion a un label localisé (fr/en, fallback en) et un prompt
 * (anglais) envoyé au coach via le canal `tv:ask-coach`.
 */

export interface Suggestion {
  id: string;
  prompt: string;
  label: string;
}

export type SuggestionLang = "fr" | "en";

const LABELS: Record<string, { fr: string; en: string }> = {
  page_dashboard: { fr: "Analyser mon Dashboard", en: "Analyze my dashboard" },
  page_journal: { fr: "Analyser mon dernier trade", en: "Analyze my last trade" },
  page_calendar: { fr: "Événements économiques de la semaine", en: "Economic events this week" },
  page_analytics: { fr: "Décortiquer mes analyses", en: "Break down my analytics" },
  worst_day: { fr: "Pourquoi je perds le {day}", en: "Why I lose on {day}" },
  costliest_mistake: { fr: "Ce que me coûte « {mistake} »", en: 'What "{mistake}" costs me' },
  size_after_loss: {
    fr: "Est-ce que j'augmente mon risque après une perte ?",
    en: "Do I increase size after a loss?",
  },
  overtrading: { fr: "Est-ce que je sur-trade ?", en: "Am I overtrading?" },
  focus_strategy: {
    fr: "Quel setup garder, quel setup arrêter ?",
    en: "Which setup should I keep?",
  },
  this_week: { fr: "Ma priorité de la semaine", en: "My priority this week" },
  fallback_winloss: { fr: "Analyse mes schémas gains/pertes", en: "Analyze my win/loss patterns" },
  fallback_days: { fr: "Mes meilleurs et pires jours", en: "My best and worst days" },
  fallback_improvements: {
    fr: "Mes 3 améliorations prioritaires",
    en: "My top 3 improvements",
  },
};

const PROMPTS: Record<string, string | ((k: string) => string)> = {
  page_dashboard:
    "Analyze my dashboard: my overall edge, recent performance, and the one thing to focus on today.",
  page_journal:
    "Analyze my last trade: what went right, what went wrong, and what to carry into the next one.",
  page_calendar: "Which economic events this week matter for my trading, and how should I prepare?",
  page_analytics: "Break down my analytics: what do the numbers say about my edge and my leaks?",
  worst_day: (k) =>
    `I lose money on ${k}. Diagnose exactly why, using my weekday numbers, and give me a rule to apply this ${k}.`,
  costliest_mistake: (m) =>
    `Break down what "${m}" costs me, when it happens, and the single change that stops it.`,
  size_after_loss:
    "Do I increase my position size after a losing trade? Use my risk-after-loss numbers and tell me what it has cost me.",
  overtrading:
    "Am I overtrading? Compare my busy days with my selective days and give me a daily trade cap.",
  focus_strategy:
    "Which of my setups actually makes money and which one should I drop? Decide with the numbers.",
  this_week:
    "Give me the single most important thing to fix this week, and how I will know on Friday whether I did it.",
  fallback_winloss:
    "Analyze my win/loss patterns. What separates my winning trades from my losing ones?",
  fallback_days: "Which days of the week are my best and worst performing? Why?",
  fallback_improvements:
    "What are my biggest weaknesses and the top 3 concrete improvements I should make?",
};

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const fill = (s: string, params?: Record<string, string>): string =>
  params ? s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`) : s;

function labelOf(id: string, lang: SuggestionLang, params?: Record<string, string>): string {
  const t = LABELS[id];
  return fill(t ? (t[lang] ?? t.en) : id, params);
}

function localizedDay(key: string, lang: SuggestionLang): string {
  const idx = DAY_INDEX[key];
  if (idx === undefined) return key;
  return new Date(2024, 0, 7 + idx).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
  });
}

export function buildSuggestions(
  data: JarvisHomeData,
  page: string | undefined,
  lang: SuggestionLang,
): Suggestion[] {
  const out: Suggestion[] = [];
  const push = (id: string, params?: Record<string, string>, promptArg?: string) => {
    const prompt = PROMPTS[id];
    if (!prompt) return;
    const p =
      typeof prompt === "function" ? (prompt as (k: string) => string)(promptArg ?? "") : prompt;
    out.push({ id, prompt: p, label: labelOf(id, lang, params) });
  };

  // 1. Contexte de la page active.
  if (page === "dashboard") push("page_dashboard");
  else if (page === "journal") push("page_journal");
  else if (page === "calendar" || page === "news") push("page_calendar");
  else if (page === "analytics" || page === "insights") push("page_analytics");

  // 2. Situation réelle (signaux déterministes).
  const worstDay = data.signals.byWeekday?.find((b) => b.pnl < 0);
  if (worstDay) push("worst_day", { day: localizedDay(worstDay.key, lang) }, worstDay.key);

  const worstMistake = Object.entries(data.stats.mistakeStats)
    .map(([name, v]) => ({ name, ...v }))
    .filter((m) => m.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl)[0];
  if (worstMistake) push("costliest_mistake", { mistake: worstMistake.name }, worstMistake.name);

  const ral = data.signals.riskAfterLoss;
  if (ral && ral.driftPct > 10) push("size_after_loss");

  const ot = data.signals.overtrading;
  if (ot && ot.avgPnlPerTradeBusy < ot.avgPnlPerTradeCalm) push("overtrading");

  if ((data.signals.byStrategy?.length ?? 0) >= 2) push("focus_strategy");

  // 3. Toujours une priorité de semaine.
  push("this_week");

  // 4. Journal mince → suggestions génériques pour ne jamais être vide.
  if (out.length < 4) {
    push("fallback_winloss");
    push("fallback_days");
    push("fallback_improvements");
  }

  return out.slice(0, 4);
}
