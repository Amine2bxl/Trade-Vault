import { memo } from "react";
import { Sparkles, ClipboardCheck, Check, ChevronRight, Target, Flag, Bot } from "lucide-react";
import { cn } from "../../utils/cn";
import { useT } from "../../i18n/LanguageContext";
import type { EdgeResult, DailyRule } from "../../utils/edgeScore";

export interface CopilotChecklist {
  locked: boolean;
  n: number;
  total: number;
}

export interface CopilotObjective {
  /** Current month PnL as a fraction of baseline equity (e.g. 0.042). */
  currentPct: number;
  /** Monthly target in %, from the profile (e.g. 8). Null when unset. */
  targetPct: number | null;
}

interface CopilotBlockProps {
  edge: EdgeResult;
  /** Day-over-day change of the score, when a prior snapshot exists. */
  edgeDelta: number | null;
  /**
   * Trajectoire du score sur la fenêtre récente. `null` tant qu'il n'y a pas
   * au moins deux mesures : le produit n'affirme jamais une tendance qu'il ne
   * peut pas justifier.
   */
  edgeTrend?: { delta: number; from: number; to: number; points: number } | null;
  /** Points du score, du plus ancien au plus récent, pour la sparkline. */
  edgeScores?: number[];
  rule: DailyRule | null;
  checklist: CopilotChecklist | null;
  objective: CopilotObjective;
  onOpenChecklist?: () => void;
}

function scoreTone(score: number): { ring: string; text: string; glow: string } {
  if (score >= 75)
    return { ring: "#10b981", text: "text-emerald-400", glow: "rgba(16,185,129,0.35)" };
  if (score >= 50) return { ring: "#22d3ee", text: "text-cyan-300", glow: "rgba(34,211,238,0.30)" };
  if (score >= 25)
    return { ring: "#f59e0b", text: "text-amber-400", glow: "rgba(245,158,11,0.30)" };
  return { ring: "#ef4444", text: "text-red-400", glow: "rgba(239,68,68,0.30)" };
}

/** Circular 0–100 dial with a subtle glow. Pure SVG, no chart lib. */
function EdgeDial({ score }: { score: number }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = scoreTone(score);
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={tone.ring}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{
            filter: `drop-shadow(0 0 6px ${tone.glow})`,
            transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display text-4xl font-extrabold tabular-nums leading-none",
            tone.text,
          )}
        >
          {score}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
          / 100
        </span>
      </div>
    </div>
  );
}

/**
 * Sparkline de la trajectoire de discipline. SVG pur, comme `EdgeDial` — aucune
 * bibliothèque de graphiques n'est chargée pour 30 points.
 *
 * Décorative au sens de l'accessibilité : la valeur chiffrée et la tendance
 * sont déjà annoncées en texte juste à côté, donc la répéter ici créerait du
 * bruit pour un lecteur d'écran.
 */
function EdgeSparkline({ scores, positive }: { scores: number[]; positive: boolean }) {
  const W = 64;
  const H = 20;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const step = scores.length > 1 ? W / (scores.length - 1) : 0;
  const d = scores
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(H - ((s - min) / span) * H).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke={positive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle
        cx={(scores.length - 1) * step}
        cy={H - ((scores[scores.length - 1] - min) / span) * H}
        r="2"
        fill={positive ? "#10b981" : "#ef4444"}
      />
    </svg>
  );
}

function CopilotBlock({
  edge,
  edgeDelta,
  edgeTrend,
  edgeScores,
  rule,
  checklist,
  objective,
  onOpenChecklist,
}: CopilotBlockProps) {
  const { t } = useT();
  const hasScore = edge.score !== null;

  // Deterministic Jarvis line: 1 observation (driven by the weakest measured
  // component) + 1 action tied to today's rule. No AI call, no invented number.
  const jarvisLine = (() => {
    if (!hasScore) return t("copilot.jarvisBuilding");
    const clean = edge.subs.cleanDays.detail
      ? `${edge.subs.cleanDays.detail} ${t("copilot.cleanDaysWord")}`
      : "";
    const obs =
      edge.weakest === "cleanTrades"
        ? t("copilot.obsCleanTrades")
        : edge.weakest === "risk"
          ? t("copilot.obsRisk")
          : edge.weakest === "routine"
            ? t("copilot.obsRoutine")
            : t("copilot.obsClean").replace("{clean}", clean);
    const action = rule
      ? t("copilot.actionRule").replace("{rule}", rule.text)
      : t("copilot.actionGeneric");
    return `${obs} ${action}`;
  })();

  const deltaEl =
    edgeDelta !== null && edgeDelta !== 0 ? (
      <span
        className={cn(
          "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md",
          edgeDelta > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
        )}
      >
        {edgeDelta > 0 ? "▲" : "▼"}
        {Math.abs(edgeDelta)}
      </span>
    ) : null;

  // Trajectoire : ce que le delta jour/jour ne peut pas dire. Affichée seulement
  // quand elle repose sur au moins deux mesures réelles.
  const trendEl =
    edgeTrend && edgeScores && edgeScores.length >= 2 ? (
      <span className="flex items-center gap-1.5" title={t("copilot.trendTitle")}>
        <EdgeSparkline scores={edgeScores} positive={edgeTrend.delta >= 0} />
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            edgeTrend.delta >= 0 ? "text-emerald-400/90" : "text-red-400/90",
          )}
        >
          {edgeTrend.delta >= 0 ? "+" : ""}
          {edgeTrend.delta}
        </span>
      </span>
    ) : null;

  const cleanPct = edge.tradedDays > 0 ? Math.round((edge.cleanDays / edge.tradedDays) * 100) : 0;

  const objPct =
    objective.targetPct && objective.targetPct > 0
      ? Math.max(0, Math.min(1, objective.currentPct / (objective.targetPct / 100)))
      : null;

  return (
    <div className="relative glass rounded-3xl p-4 md:p-5 card-premium animate-fade-in-up stagger-1 overflow-hidden mb-4 md:mb-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-cyan-400/80 font-semibold mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        <span>{t("copilot.title")}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 md:gap-7 items-center">
        {/* Left — Edge dial + clean-days bar */}
        <div className="flex flex-col items-center gap-3">
          {hasScore ? (
            <EdgeDial score={edge.score!} />
          ) : (
            <div className="w-[132px] h-[132px] rounded-full border border-dashed border-white/10 flex items-center justify-center text-center text-[11px] text-slate-500 px-4">
              {t("copilot.scoreBuilding")}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {t("copilot.edgeLabel")}
            </span>
            {deltaEl}
          </div>
          {trendEl && <div className="flex items-center justify-center">{trendEl}</div>}
          {edge.tradedDays > 0 && (
            <div className="w-full max-w-[160px]">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>{t("copilot.cleanDays")}</span>
                <span className="tabular-nums text-slate-400 font-semibold">
                  {edge.cleanDays}/{edge.tradedDays}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition duration-250"
                  style={{ width: `${cleanPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right — Jarvis line, rule, checklist, objective */}
        <div className="space-y-3 min-w-0">
          {/* Jarvis coaching line */}
          {/* Jarvis coaching line — signée Jarvis */}
          <div className="relative rounded-2xl bg-cyan-500/[0.05] border border-cyan-500/15 px-3.5 py-3 overflow-hidden">
            <div className="flex gap-2.5 items-start">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-teal-600">
                <Bot className="w-3 h-3 text-white" />
              </span>
              <p className="text-[13px] leading-relaxed text-slate-200 min-w-0">
                <span className="font-semibold text-cyan-300">Jarvis</span>{" "}
                <span className="text-slate-500">·</span> {jarvisLine}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Rule of the day */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1.5">
                <Flag className="w-3 h-3" /> {t("copilot.ruleTitle")}
              </div>
              <div className="text-sm font-semibold text-white truncate">
                {rule ? rule.text : t("copilot.ruleNone")}
              </div>
              <div className="text-[10px] text-slate-600 truncate mt-0.5">
                {rule ? t("copilot.ruleFrom") : t("copilot.ruleNoneHint")}
              </div>
            </div>

            {/* Monthly objective */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-cyan-400/80 font-semibold mb-1.5">
                <Target className="w-3 h-3" /> {t("copilot.objTitle")}
              </div>
              {objective.targetPct && objective.targetPct > 0 ? (
                <>
                  <div className="text-sm font-semibold text-white tabular-nums">
                    {objective.currentPct >= 0 ? "+" : ""}
                    {(objective.currentPct * 100).toFixed(1)}%{" "}
                    <span className="text-slate-600 text-xs">/ {objective.targetPct}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition duration-250"
                        style={{ width: `${Math.round((objPct ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-cyan-300 shrink-0">
                      {Math.round((objPct ?? 0) * 100)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-slate-500 mt-1">{t("copilot.objNone")}</div>
              )}
            </div>
          </div>

          {/* Checklist — folded into the copilot */}
          {onOpenChecklist && checklist && (
            <button
              onClick={onOpenChecklist}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border text-left transition hover:-translate-y-0.5",
                checklist.locked
                  ? "bg-emerald-500/[0.06] border-emerald-500/20 hover:bg-emerald-500/10"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0",
                  checklist.locked
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
                )}
              >
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{t("chk.dashTitle")}</span>
                  {checklist.locked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                      <Check className="w-2.5 h-2.5" /> {t("chk.ready")}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {checklist.locked
                    ? t("chk.dashLocked")
                    : checklist.total > 0
                      ? `${checklist.n}/${checklist.total} ${t("chk.dashChecked")}`
                      : t("chk.dashStart")}
                </div>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-cyan-400 shrink-0">
                {t("chk.dashCta")} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CopilotBlock);
