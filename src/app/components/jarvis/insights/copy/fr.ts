import type { JarvisInsight } from "../types";
import { actionLine, formatMoney, num, type HeroLineSpec, type JarvisVoiceMode } from "./templates";

/**
 * La voix française de Jarvis.
 * Chaque ligne provient strictement des champs de l'insight — aucune donnée
 * inventée, aucune cause ajoutée, aucune phrase motivationnelle générique.
 */

export function frHeroLines(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  switch (insight.pattern) {
    case "risk_after_loss":
      return frRiskAfterLoss(insight, mode);
    case "overtrading":
      return frOvertrading(insight, mode);
    case "costliest_mistake":
      return frCostliestMistake(insight, mode);
    case "discipline_streak":
      return frDisciplineStreak(insight, mode);
    default:
      return [{ kind: "context", text: `J'ai analysé tes ${insight.sampleSize} derniers trades.` }];
  }
}

export function frLearning(sampleSize: number, _mode: JarvisVoiceMode): string {
  if (sampleSize < 5) {
    return "Je n'ai pas encore assez de données pour lire ton edge. Enregistre tes trades — je prendrai le relais dès qu'il y en aura assez.";
  }
  return "Je commence à détecter une tendance, mais le signal n'est pas encore assez fiable pour conclure. Continue à enregistrer tes trades — je te confirme dès que c'est solide.";
}

function frRiskAfterLoss(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const drift = num(insight.evidence.driftPct);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `J'ai analysé tes ${insight.sampleSize} derniers trades.` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `J'observe que tu engages ${drift}% de risque en plus sur le trade qui suit une perte. Le risque, c'est la taille que tu mets en jeu sur chaque trade.`,
    });
  } else if (mode === "advanced") {
    lines.push({ kind: "observation", text: `Pattern : +${drift}% de risque après une perte.` });
  } else {
    lines.push({
      kind: "observation",
      text: `J'observe que tu augmentes ton risque de ${drift}% après une perte.`,
    });
  }
  if (insight.impact) {
    lines.push({
      kind: "impact",
      text: `Ce comportement t'a coûté ${formatMoney(insight.impact.amount, "fr")} sur ces ${insight.sampleSize} trades.`,
    });
  }
  lines.push({ kind: "action", text: `Aujourd'hui : ${actionLine(insight, "fr")}.` });
  return lines;
}

function frOvertrading(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const busy = num(insight.evidence.avgPnlPerTradeBusy);
  const calm = num(insight.evidence.avgPnlPerTradeCalm);
  const lines: HeroLineSpec[] = [
    {
      kind: "context",
      text: `J'ai analysé tes ${insight.sampleSize} trades répartis sur tes journées.`,
    },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `Sur tes journées chargées, tu perds ${formatMoney(Math.abs(busy), "fr")} par trade, contre ${calm >= 0 ? "+" : ""}${Math.round(calm)}$ les jours calmes. Une journée chargée, c'est une journée où tu prends beaucoup de trades.`,
    });
  } else if (mode === "advanced") {
    lines.push({
      kind: "observation",
      text: `Journées chargées : ${busy}$/trade vs ${calm >= 0 ? "+" : ""}${Math.round(calm)}$ les jours calmes.`,
    });
  } else {
    lines.push({
      kind: "observation",
      text: `Sur les journées chargées, tu perds ${formatMoney(Math.abs(busy), "fr")} par trade, contre ${calm >= 0 ? "+" : ""}${Math.round(calm)}$ les jours calmes.`,
    });
  }
  if (insight.impact) {
    lines.push({
      kind: "impact",
      text: `Tes journées chargées représentent ${formatMoney(insight.impact.amount, "fr")} de perte.`,
    });
  }
  lines.push({ kind: "action", text: `Aujourd'hui : ${actionLine(insight, "fr")}.` });
  return lines;
}

function frCostliestMistake(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const mistake = String(insight.evidence.mistake ?? "");
  const count = num(insight.evidence.count);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `J'ai analysé ${count} trades marqués « ${mistake} ».` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `L'erreur « ${mistake} » est ton plus gros trou de process : elle apparaît ${count} fois.`,
    });
  } else if (mode === "advanced") {
    lines.push({ kind: "observation", text: `Erreur dominante : « ${mistake} » (${count}×).` });
  } else {
    lines.push({
      kind: "observation",
      text: `L'erreur « ${mistake} » apparaît ${count} fois dans ton journal.`,
    });
  }
  if (insight.impact) {
    lines.push({
      kind: "impact",
      text: `Elle représente ${formatMoney(insight.impact.amount, "fr")} de perte cumulée.`,
    });
  }
  lines.push({ kind: "action", text: `Aujourd'hui : ${actionLine(insight, "fr")}.` });
  return lines;
}

function frDisciplineStreak(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const streak = num(insight.evidence.currentStreak);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `J'ai analysé tes ${insight.sampleSize} derniers trades.` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `Tu es sur une série de ${streak} victoires. Un résultat, pas encore une preuve : c'est la tenue de tes règles qui dira si le process suit.`,
    });
  } else if (mode === "advanced") {
    lines.push({ kind: "observation", text: `Série en cours : ${streak} victoires.` });
  } else {
    lines.push({
      kind: "observation",
      text: `Tu es sur une série de ${streak} victoires consécutives.`,
    });
  }
  lines.push({ kind: "action", text: `Aujourd'hui : ${actionLine(insight, "fr")}.` });
  return lines;
}
