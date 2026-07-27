/**
 * Deterministic coach — the zero-cost safety net behind Jarvis.
 *
 * When no AI provider is configured (beta with no key set) or the provider call
 * fails, the trader must still get a useful, grounded answer instead of an error
 * bubble. This module answers **from the exact same payload** the AI would have
 * received: precomputed stats, the recurring-mistake breakdown and recent trades.
 *
 * Guarantees, identical to the AI path:
 *   • never invents a number — every figure comes from the payload
 *   • says plainly when the data isn't there
 *   • never predicts the market, never gives financial advice
 *   • costs nothing (pure function, no IO, no model call)
 */

export interface FallbackPayload {
  question: string;
  language?: string;
  stats?: Record<string, number | string | null>;
  mistakes?: { name: string; count: number; totalPnl: number }[];
  trades?: { date: string; symbol: string; pnl: number; rMultiple: number; strategy: string }[];
}

const FR = (lang?: string) => (lang ?? "en").toLowerCase().startsWith("fr");

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function money(v: number): string {
  const s = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2);
  return `${v < 0 ? "-" : ""}$${s.replace("-", "")}`;
}

/**
 * Build a grounded Markdown answer. Sections mirror the AI format so the two
 * paths look like the same coach.
 */
export function fallbackCoachAnswer(p: FallbackPayload): string {
  const fr = FR(p.language);
  const s = p.stats ?? {};
  const total = num(s.totalTrades);

  // No data at all → say so, don't fabricate coaching.
  if (!total || total === 0) {
    return fr
      ? "## 🎯 L'essentiel\n\nJe n'ai pas encore de trades à lire. Enregistre tes premières opérations et je te dirai, chiffres à l'appui, ce qui marche et ce qui te coûte.\n\n## 🧭 Prochaine étape\n\n1. Logge tes 10 derniers trades (symbole, R, erreurs éventuelles).\n2. Reviens me voir : je lirai ton edge dans les données."
      : "## 🎯 Key Takeaways\n\nI have no trades to read yet. Log your first trades and I'll tell you — with real numbers — what works and what costs you.\n\n## 🧭 Action Plan\n\n1. Log your last 10 trades (symbol, R, any mistakes).\n2. Come back: I'll read your edge from the data.";
  }

  const pnl = num(s.totalPnl);
  const wr = num(s.winRatePct);
  const pf = num(s.profitFactor);
  const avgWin = num(s.avgWin);
  const avgLoss = num(s.avgLoss);
  const avgRR = num(s.avgRR);
  const dd = num(s.maxDrawdown);
  const streak = num(s.currentStreak);
  const streakType = typeof s.currentStreakType === "string" ? s.currentStreakType : null;

  // The costliest recurring leak — the single most actionable fact we hold.
  const leak = (p.mistakes ?? []).filter((m) => m.totalPnl < 0).sort((a, b) => a.totalPnl - b.totalPnl)[0];

  const lines: string[] = [];

  lines.push(fr ? "## 🎯 L'essentiel" : "## 🎯 Key Takeaways");
  const takeaways: string[] = [];
  if (pnl !== null)
    takeaways.push(
      fr
        ? `Résultat cumulé : **${money(pnl)}** sur **${total}** trades.`
        : `Cumulative result: **${money(pnl)}** across **${total}** trades.`,
    );
  if (wr !== null && pf !== null)
    takeaways.push(
      fr
        ? `Win rate **${wr.toFixed(1)}%**, profit factor **${pf.toFixed(2)}** ${pf >= 1.5 ? "(solide)" : pf >= 1 ? "(à consolider)" : "(sous 1 — les pertes dominent)"}.`
        : `Win rate **${wr.toFixed(1)}%**, profit factor **${pf.toFixed(2)}** ${pf >= 1.5 ? "(solid)" : pf >= 1 ? "(needs consolidating)" : "(below 1 — losses dominate)"}.`,
    );
  if (avgWin !== null && avgLoss !== null && avgLoss !== 0)
    takeaways.push(
      fr
        ? `Gain moyen **${money(avgWin)}** contre perte moyenne **${money(avgLoss)}**.`
        : `Average win **${money(avgWin)}** vs average loss **${money(avgLoss)}**.`,
    );
  if (leak)
    takeaways.push(
      fr
        ? `Ta fuite n°1 : **${leak.name}** — **${money(leak.totalPnl)}** sur **${leak.count}** trades.`
        : `Your #1 leak: **${leak.name}** — **${money(leak.totalPnl)}** across **${leak.count}** trades.`,
    );
  lines.push(takeaways.map((x) => `- ${x}`).join("\n"));

  // Compact stats table — the numbers the answer is allowed to cite.
  lines.push("");
  lines.push(fr ? "## 📊 Tes chiffres" : "## 📊 Stats Snapshot");
  const rows: [string, string][] = [];
  if (wr !== null) rows.push([fr ? "Win rate" : "Win rate", `${wr.toFixed(1)}%`]);
  if (pf !== null) rows.push(["Profit factor", pf.toFixed(2)]);
  if (avgRR !== null) rows.push([fr ? "R:R moyen" : "Avg R:R", avgRR.toFixed(2)]);
  if (dd !== null) rows.push([fr ? "Drawdown max" : "Max drawdown", money(-Math.abs(dd))]);
  if (streak !== null && streakType)
    rows.push([fr ? "Série en cours" : "Current streak", `${streak}${streakType === "win" ? "W" : streakType === "loss" ? "L" : ""}`]);
  if (rows.length) {
    lines.push(`| ${fr ? "Métrique" : "Metric"} | ${fr ? "Valeur" : "Value"} |`);
    lines.push("| --- | --- |");
    rows.forEach(([k, v]) => lines.push(`| ${k} | ${v} |`));
  }

  // Strength / weakness read, strictly from the numbers above.
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (pf !== null && pf >= 1.5) strengths.push(fr ? "Ton profit factor tient la route." : "Your profit factor holds up.");
  if (wr !== null && wr >= 50) strengths.push(fr ? "Tu gagnes plus d'un trade sur deux." : "You win more than half your trades.");
  if (avgWin !== null && avgLoss !== null && Math.abs(avgWin) > Math.abs(avgLoss))
    strengths.push(fr ? "Tes gains moyens dépassent tes pertes moyennes." : "Your average win beats your average loss.");
  if (pf !== null && pf < 1) weaknesses.push(fr ? "Profit factor sous 1 : les pertes l'emportent." : "Profit factor below 1: losses win.");
  if (avgWin !== null && avgLoss !== null && Math.abs(avgLoss) > Math.abs(avgWin))
    weaknesses.push(fr ? "Tes pertes moyennes dépassent tes gains — sizing ou sorties à revoir." : "Average loss exceeds average win — review sizing or exits.");
  if (leak) weaknesses.push(fr ? `« ${leak.name} » revient ${leak.count} fois.` : `"${leak.name}" shows up ${leak.count} times.`);
  if (streakType === "loss" && streak && streak >= 3)
    weaknesses.push(fr ? `Série de ${streak} pertes en cours — réduis la taille.` : `${streak}-loss streak running — cut size.`);

  if (strengths.length) {
    lines.push("");
    lines.push(fr ? "## ✅ Points forts" : "## ✅ Strengths");
    lines.push(strengths.map((x) => `- ${x}`).join("\n"));
  }
  if (weaknesses.length) {
    lines.push("");
    lines.push(fr ? "## ⚠️ Points faibles" : "## ⚠️ Weaknesses");
    lines.push(weaknesses.map((x) => `- ${x}`).join("\n"));
  }

  // Concrete, measurable next steps.
  lines.push("");
  lines.push(fr ? "## 🧭 Plan d'action" : "## 🧭 Action Plan");
  const plan: string[] = [];
  if (leak)
    plan.push(
      fr
        ? `Cible **${leak.name}** : avant chaque entrée, vérifie explicitement ce point. Objectif : 0 occurrence sur tes 10 prochains trades.`
        : `Target **${leak.name}**: check for it explicitly before every entry. Goal: zero occurrences over your next 10 trades.`,
    );
  if (pf !== null && pf < 1.5)
    plan.push(
      fr
        ? "Ne prends que les setups à R:R ≥ 2 pendant 2 semaines, puis recompare ton profit factor."
        : "Take only setups with R:R ≥ 2 for two weeks, then re-check your profit factor.",
    );
  plan.push(
    fr
      ? "Logge chaque trade dans l'heure qui suit la sortie — sans données propres, aucun diagnostic n'est fiable."
      : "Log every trade within an hour of exiting — no clean data, no reliable diagnosis.",
  );
  lines.push(plan.map((x, i) => `${i + 1}. ${x}`).join("\n"));

  lines.push("");
  lines.push(fr ? "## 💡 En une phrase" : "## 💡 Bottom Line");
  lines.push(
    leak
      ? fr
        ? `Supprime « ${leak.name} » et tu récupères ${money(Math.abs(leak.totalPnl))} de performance déjà perdue.`
        : `Cut "${leak.name}" and you reclaim ${money(Math.abs(leak.totalPnl))} of performance you've already lost.`
      : fr
        ? "Aucune erreur récurrente coûteuse détectée — protège ce processus, c'est lui ton edge."
        : "No costly recurring mistake detected — protect this process, it *is* your edge.",
  );

  return lines.join("\n");
}
