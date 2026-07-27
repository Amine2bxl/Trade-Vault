import { Sparkles, ClipboardCheck, Check, ChevronRight, Target, Flag } from "lucide-react";
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
  rule: DailyRule | null;
  checklist: CopilotChecklist | null;
  objective: CopilotObjective;
  onOpenChecklist?: () => void;
}

function scoreTone(score: number): { ring: string; text: string; glow: string } {
  if (score >= 75) return { ring: "#10b981", text: "text-emerald-400", glow: "rgba(16,185,129,0.35)" };
  if (score >= 50) return { ring: "#22d3ee", text: "text-cyan-300", glow: "rgba(34,211,238,0.30)" };
  if (score >= 25) return { ring: "#f59e0b", text: "text-amber-400", glow: "rgba(245,158,11,0.30)" };
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
          style={{ filter: `drop-shadow(0 0 6px ${tone.glow})`, transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display text-4xl font-extrabold tabular-nums leading-none", tone.text)}>
          {score}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mt-1">/ 100</span>
      </div>
    </div>
  );
}

export default function CopilotBlock({
  edge,
  edgeDelta,
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
    const clean = edge.subs.cleanDays.detail ? `${edge.subs.cleanDays.detail} ${t("copilot.cleanDaysWord")}` : "";
    const obs =
      edge.weakest === "plan"
        ? t("copilot.obsPlan")
        : edge.weakest === "risk"
          ? t("copilot.obsRisk")
          : edge.weakest === "routine"
            ? t("copilot.obsRoutine")
            : t("copilot.obsClean").replace("{clean}", clean);
    const action = rule ? t("copilot.actionRule").replace("{rule}", rule.text) : t("copilot.actionGeneric");
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

  const cleanPct =
    edge.tradedDays > 0 ? Math.round((edge.cleanDays / edge.tradedDays) * 100) : 0;

  const objPct = objective.targetPct && objective.targetPct > 0
    ? Math.max(0, Math.min(1, objective.currentPct / (objective.targetPct / 100)))
    : null;

  return (
    <div className="relative glass rounded-3xl p-3.5 md:p-4 card-premium animate-fade-in-up stagger-1 overflow-hidden mb-4 md:mb-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
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
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700"
                  style={{ width: `${cleanPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right — Jarvis line, rule, checklist, objective */}
        <div className="space-y-3 min-w-0">
          {/* Jarvis coaching line */}
          <div className="flex gap-2.5 rounded-2xl bg-cyan-500/[0.05] border border-cyan-500/15 px-3.5 py-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <p className="text-[13px] leading-relaxed text-slate-200 min-w-0">
              <span className="font-semibold text-cyan-300">Jarvis</span>{" "}
              <span className="text-slate-500">·</span> {jarvisLine}
            </p>
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
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-700"
                      style={{ width: `${Math.round((objPct ?? 0) * 100)}%` }}
                    />
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
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border text-left transition-all hover:-translate-y-0.5",
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
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
