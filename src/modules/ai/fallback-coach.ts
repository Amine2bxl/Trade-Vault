/**
 * Deterministic coach — the zero-cost safety net behind Jarvis.
 *
 * When no AI provider answers (down, quota, timeout, empty response), the
 * trader must still get a useful, GROUNDED answer — not an error, and not a
 * stats dump. This module answers the QUESTION conversationally: a diagnosis
 * driven by the question's intent, the numbers as evidence, a short plan, and
 * a closing question. Same guarantees as the AI path:
 *   • never invents a number — every figure comes from the payload
 *   • says plainly when the data isn't there
 *   • never predicts the market, never gives financial advice
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

/** Coûteuse fuite récurrente — le fait le plus actionnable. */
function worstLeak(p: FallbackPayload) {
  return (p.mistakes ?? [])
    .filter((m) => m.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl)[0];
}

type Intent = "mistake" | "plan" | "improve" | "winloss" | "week" | "generic";

function detectIntent(q: string): Intent {
  if (/erreur|mistake|perd|pourquoi|why|fuite|leak|fomo/i.test(q)) return "mistake";
  if (/plan|prépar|prepare|session|règle|rule|discipline/i.test(q)) return "plan";
  if (/amélior|improve|progress|avancer|better/i.test(q)) return "improve";
  if (/gain|perte|win|loss|winrate|taux/i.test(q)) return "winloss";
  if (/semaine|week|mois|month|bilan/i.test(q)) return "week";
  return "generic";
}

export function fallbackCoachAnswer(p: FallbackPayload): string {
  const fr = FR(p.language);
  const s = p.stats ?? {};
  const total = num(s.totalTrades);

  if (!total || total === 0) {
    return fr
      ? "Je n'ai pas encore de trades à lire. Enregistre tes premières opérations, et je te dirai — chiffres à l'appui — ce qui marche et ce qui te coûte. Tu peux commencer par tes 10 derniers trades."
      : "I have no trades to read yet. Log your first trades and I'll tell you — with real numbers — what works and what costs you. Start with your last 10 trades.";
  }

  const pnl = num(s.totalPnl);
  const wr = num(s.winRatePct);
  const pf = num(s.profitFactor);
  const avgWin = num(s.avgWin);
  const avgLoss = num(s.avgLoss);
  const leak = worstLeak(p);
  const streak = num(s.currentStreak);
  const streakType = typeof s.currentStreakType === "string" ? s.currentStreakType : null;
  const q = (p.question ?? "").toLowerCase();
  const intent = detectIntent(q);

  const pct = (n: number | null) => (n != null ? `${n.toFixed(1)}%` : "n/a");
  const ratio = (n: number | null) => (n != null ? n.toFixed(2) : "n/a");
  /** Chiffres disponibles, cités comme preuve (jamais de $0.00 inventé). */
  const metrics: string[] = [];
  if (pnl !== null) metrics.push(fr ? `P&L **${money(pnl)}**` : `P&L **${money(pnl)}**`);
  if (wr !== null) metrics.push(`win rate **${pct(wr)}**`);
  if (pf !== null) metrics.push(`profit factor **${ratio(pf)}**`);
  const ctx = metrics.length ? ` ${metrics.join(", ")}.` : "";
  const leakLine = leak
    ? fr
      ? `la plus coûteuse est **${leak.name}**, qui représente **${money(leak.totalPnl)}** sur **${leak.count}** trades.`
      : `the most expensive is **${leak.name}**, worth **${money(leak.totalPnl)}** across **${leak.count}** trades.`
    : null;

  const lines: string[] = [];

  // 1. Diagnostic — répond à la question, chiffres à l'appui.
  switch (intent) {
    case "mistake":
      lines.push(
        leak
          ? fr
            ? `Oui, je vois précisément ce qui te coûte : ${leakLine}${ctx} C'est ta première erreur à éliminer.`
            : `Yes — I can see exactly what costs you: ${leakLine}${ctx} That's the first mistake to eliminate.`
          : fr
            ? `Je ne détecte pas d'erreur récurrente coûteuse.${ctx} Le problème est peut-être plus structurel (sizing, sélection).`
            : `I don't see a costly recurring mistake.${ctx} The problem may be more structural (sizing, selection).`,
      );
      break;
    case "plan":
      lines.push(
        fr
          ? `Voici ta priorité : ${leak ? `supprimer **${leak.name}**` : "protéger ton process actuel"}.${ctx} La discipline est ton levier n°1.`
          : `Here's your priority: ${leak ? `cut **${leak.name}**` : "protect your current process"}.${ctx} Discipline is your #1 lever.`,
      );
      break;
    case "improve":
      lines.push(
        fr
          ? `Pour progresser : ${leak ? `éliminer **${leak.name}** (${money(leak.totalPnl)} perdus)` : "renforcer ce qui marche déjà"}.${ctx}`
          : `To improve: ${leak ? `eliminate **${leak.name}** (${money(leak.totalPnl)} lost)` : "reinforce what already works"}.${ctx}`,
      );
      break;
    case "winloss":
      lines.push(
        fr
          ? `Ton win rate est de **${pct(wr)}** : tu gagnes **${money(avgWin ?? 0)}** par trade gagnant mais perds **${money(Math.abs(avgLoss ?? 0))}** par perdant. ${(avgWin ?? 0) > Math.abs(avgLoss ?? 0) ? "Tes gains dépassent tes pertes — c'est ta force." : "Tes pertes dépassent tes gains — regarde tes sorties et ton sizing."}`
          : `Your win rate is **${pct(wr)}**: you make **${money(avgWin ?? 0)}** per winning trade but lose **${money(Math.abs(avgLoss ?? 0))}** per loser. ${(avgWin ?? 0) > Math.abs(avgLoss ?? 0) ? "Your wins beat your losses — that's your strength." : "Your losses beat your wins — review exits and sizing."}`,
      );
      break;
    case "week":
      lines.push(
        fr
          ? `Sur **${total}** trades${ctx} ${leak ? `Le point noir : **${leak.name}** (${leak.count} fois, ${money(leak.totalPnl)}).` : "Pas d'erreur récurrente dominante — bon process."}`
          : `Across **${total}** trades${ctx} ${leak ? `The dark spot: **${leak.name}** (${leak.count} times, ${money(leak.totalPnl)}).` : "No dominant recurring mistake — solid process."}`,
      );
      break;
    default:
      lines.push(
        leak
          ? fr
            ? `En clair : ${leakLine}${ctx} C'est le levier le plus rentable à actionner.`
            : `Plainly: ${leakLine}${ctx} That's the most profitable lever to pull.`
          : fr
            ? `Ton trading est sain sur le plan des erreurs.${ctx}`
            : `Your error discipline is clean.${ctx}`,
      );
  }

  // 2. Plan concret — 1 à 3 actions mesurables.
  lines.push(fr ? "**Plan**" : "**Plan**");
  const plan: string[] = [];
  if (leak)
    plan.push(
      fr
        ? `Dès maintenant : écris « ${leak.name} » sur un post-it et vérifie-le avant chaque entrée. Objectif : 0 occurrence sur les 10 prochains trades.`
        : `Right now: write "${leak.name}" on a sticky note and check it before every entry. Goal: zero occurrences in your next 10 trades.`,
    );
  if ((pf ?? 0) < 1.5)
    plan.push(
      fr
        ? "Ne prends que les setups à R:R ≥ 2 pendant 2 semaines, puis recompare ton profit factor."
        : "Take only setups with R:R ≥ 2 for two weeks, then re-check your profit factor.",
    );
  if (streakType === "loss" && streak && streak >= 3)
    plan.push(
      fr
        ? `Série de **${streak}** pertes — réduis ta taille de moitié jusqu'à la prochaine victoire.`
        : `**${streak}**-loss streak — cut your size in half until your next win.`,
    );
  plan.push(
    fr
      ? "Logge chaque trade dans l'heure qui suit la sortie — sans données propres, aucun diagnostic n'est fiable."
      : "Log every trade within an hour of exiting — no clean data, no reliable diagnosis.",
  );
  lines.push(plan.map((x, i) => `${i + 1}. ${x}`).join("\n"));

  // 3. Relance — pour garder la conversation.
  lines.push(
    leak
      ? fr
        ? `Quand reviens-tu sur le marché ? Je veux qu'on mesure l'impact de « ${leak.name} » sur tes 10 prochains trades.`
        : `When are you back in the market? I want us to measure the impact of "${leak.name}" on your next 10 trades.`
      : fr
        ? "Quel est ton objectif pour cette semaine — et comment saurai-je si tu l'as atteint vendredi ?"
        : "What's your goal for this week — and how will I know on Friday that you reached it?",
  );

  return lines.join("\n\n");
}
