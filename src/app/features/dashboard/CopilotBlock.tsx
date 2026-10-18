import { memo } from "react";
import { CHART_GREEN, CHART_RED } from "@/app/trading/chartTheme";
import { Sparkles, ClipboardCheck, Check, ChevronRight, Target, Flag } from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import { InfoTip } from "@/shared/ui/InfoTip";
import { JarvisOrb } from "@/shared/ui/JarvisOrb";
import { formatPnl } from "@/domain/tradeCalcs";
import { useT } from "@/app/i18n/LanguageContext";
import type { EdgeResult, DailyRule } from "@/domain/edgeScore";

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

/**
 * La rampe du cadran, en TOKENS — et les seuils ne bougent pas.
 *
 * Trois défauts se cumulaient ici, dont deux invisibles en lecture du code :
 *
 * 1. `#10b981` et `#ef4444` sont emerald-500 et red-500 — PAS les couleurs de
 *    la donnée du produit (`#34d399` / `#f87171`). L'anneau était donc d'un
 *    vert franchement différent du chiffre qu'il entoure, sur la première
 *    page que le trader voit.
 * 2. La bande 50–74 rendait un anneau `--tv-highlight` avec un texte cyan.
 *    Depuis le passage au langage Lucid, `--tv-highlight` est le vert menthe
 *    CLAIR — c'est-à-dire la couleur de l'ACTION. Un cadran de score la
 *    portait donc pour dire « moyen », pendant que son propre libellé était
 *    cyan : deux couleurs qui ne se parlent pas, dont l'une ment sur la
 *    nature de l'objet. Un score moyen n'est ni un gain ni un bouton : il est
 *    NEUTRE, et c'est déjà la règle du primitif `Metric`.
 * 3. `glow` était calculé dans les quatre branches et lu NULLE PART. Du halo
 *    mort — interdit par `docs/DESIGN_SYSTEM.md` (« rien ne
 *    rayonne »), et dont le commentaire du cadran promettait encore l'effet.
 */
function scoreTone(score: number): { ring: string; text: string } {
  if (score >= 75) return { ring: CHART_GREEN, text: "text-emerald-400" };
  if (score >= 50)
    return { ring: "var(--tv-text-secondary)", text: "text-[var(--tv-text-primary)]" };
  if (score >= 25) return { ring: "var(--tv-warning)", text: "text-amber-400" };
  return { ring: CHART_RED, text: "text-red-400" };
}

/** Circular 0–100 dial. Pure SVG, no chart lib — et rien ne rayonne. */
function EdgeDial({ score }: { score: number }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = scoreTone(score);
  return (
    <div className="relative h-[96px] w-[96px] shrink-0 md:h-[112px] md:w-[112px]">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--tv-plate-0)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={tone.ring}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("tv-figure text-[30px] leading-none md:text-[34px]", tone.text)}>
          {score}
        </span>
        <span className="tv-label mt-1 text-slate-500">/ 100</span>
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
        stroke={positive ? CHART_GREEN : CHART_RED}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle
        cx={(scores.length - 1) * step}
        cy={H - ((scores[scores.length - 1] - min) / span) * H}
        r="2"
        fill={positive ? CHART_GREEN : CHART_RED}
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
          "tv-figure tv-figure-secondary text-xs px-1.5 py-0.5 rounded-md",
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
            "tv-figure tv-figure-secondary text-xs",
            edgeTrend.delta >= 0 ? "text-emerald-400/90" : "text-red-400/90",
          )}
        >
          {edgeTrend.delta >= 0 ? "+" : ""}
          {edgeTrend.delta}
        </span>
      </span>
    ) : null;

  /* LA RÈGLE DU JOUR ÉTAIT UNE ÉTIQUETTE, PAS UNE RÈGLE.
     `deriveDailyRule` désigne la fuite la plus coûteuse et renvoie son NOM —
     « FOMO entry ». La carte l'affichait tel quel sous le titre « règle du
     jour » : un substantif là où on attend une consigne, et le trader devait
     faire lui-même la traduction en action.

     La logique ne bouge pas (c'est elle qui sait quelle fuite coûte le plus) ;
     c'est l'affichage qui construit la phrase, et qui pose SOUS elle la preuve
     que le produit a déjà calculée : combien de fois, pour combien.

     `leak` a la forme « nom · N× · montant » — on ne garde que ce qui suit le
     nom, sinon la preuve répète la consigne. */
  const consigne = rule ? t("copilot.ruleImperative").replace("{leak}", rule.text) : null;
  const preuve = (() => {
    if (!rule?.leak) return null;
    // « nom · N× · montant » — le montant est un nombre brut côté logique ;
    // c'est ici qu'il devient une somme d'argent, comme partout ailleurs.
    const parts = rule.leak.split(" · ");
    if (parts.length < 3) return parts.slice(1).join(" · ") || null;
    const n = Number(parts[2]);
    return `${parts[1]} · ${Number.isFinite(n) ? formatPnl(n) : parts[2]}`;
  })();

  const cleanPct = edge.tradedDays > 0 ? Math.round((edge.cleanDays / edge.tradedDays) * 100) : 0;

  const objPct =
    objective.targetPct && objective.targetPct > 0
      ? Math.max(0, Math.min(1, objective.currentPct / (objective.targetPct / 100)))
      : null;

  const chkPct =
    checklist && checklist.total > 0 ? Math.round((checklist.n / checklist.total) * 100) : 0;

  /* UNE CARTE, TROIS ÉTAGES, AUCUNE PHRASE DE TROP.
     Avant : un paragraphe d'introduction qui redisait le titre, une légende de
     quatre lignes sous le cadran, un cyan codé en dur qui ignorait le thème,
     un dégradé dans la barre des jours propres. Le copilote se lit maintenant
     en trois secondes : le score (et ce qu'il mesure, dans l'infobulle), ce
     que Jarvis en tire, puis ce qu'il y a à faire aujourd'hui. Toutes les
     couleurs viennent des tokens — l'accent du thème pour ce qui agit, les
     verts/rouges de la donnée pour ce qui se mesure. */
  return (
    <div className="relative glass flex min-w-0 flex-col rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-1 overflow-hidden">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="tv-label flex items-center gap-2 text-[var(--tv-highlight)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t("copilot.title")}</span>
        </div>
        {hasScore && <InfoTip text={t("copilot.explain")} />}
      </div>

      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-6">
        {/* Le score — en ligne sur téléphone, en colonne à partir de md. */}
        <div className="flex items-center gap-4 md:flex-col md:gap-2.5">
          {hasScore ? (
            <EdgeDial score={edge.score!} />
          ) : (
            <div className="grid h-[96px] w-[96px] shrink-0 place-items-center rounded-full border border-dashed border-[var(--tv-border-strong)] px-3 text-center text-[10px] leading-snug text-slate-500 md:h-[112px] md:w-[112px]">
              {t("copilot.scoreBuilding")}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:w-full md:max-w-[150px] md:items-center">
            <div className="flex items-center gap-2">
              <span className="tv-label text-slate-500">{t("copilot.edgeLabel")}</span>
              {deltaEl}
            </div>
            {trendEl}
            {edge.tradedDays > 0 && (
              <div className="w-full max-w-[180px] md:max-w-none">
                <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{t("copilot.cleanDays")}</span>
                  <span className="tv-figure text-slate-400">
                    {edge.cleanDays}/{edge.tradedDays}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[var(--tv-plate-0)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${cleanPct}%`,
                      background: cleanPct >= 50 ? CHART_GREEN : CHART_RED,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ce que Jarvis en tire, puis ce qu'il y a à faire aujourd'hui. */}
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--tv-border-accent)] bg-[var(--tv-plate-2)] px-3.5 py-3">
            <JarvisOrb size={20} className="mt-px shrink-0" />
            <p className="min-w-0 text-[13px] leading-relaxed text-slate-200">
              <span className="font-semibold text-[var(--tv-highlight)]">Jarvis</span>{" "}
              <span className="text-slate-600">·</span> {jarvisLine}
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[var(--tv-border)] overflow-hidden rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)]">
            <div className="min-w-0 px-3.5 py-3">
              <div className="tv-label mb-1.5 flex items-center gap-1.5 text-amber-400/85">
                <Flag className="h-3 w-3" /> {t("copilot.ruleTitle")}
              </div>
              <div className="text-[13px] font-semibold leading-snug text-white">
                {consigne ?? t("copilot.ruleNone")}
              </div>
              <div className="tv-figure tv-figure-secondary mt-1 truncate text-[10px] text-slate-500">
                {preuve ?? (rule ? t("copilot.ruleFrom") : t("copilot.ruleNoneHint"))}
              </div>
            </div>

            <div className="min-w-0 px-3.5 py-3">
              <div className="tv-label mb-1.5 flex items-center gap-1.5 text-slate-400">
                <Target className="h-3 w-3" /> {t("copilot.objTitle")}
              </div>
              {objective.targetPct && objective.targetPct > 0 ? (
                <>
                  <div className="tv-figure text-[13px] text-white">
                    {objective.currentPct >= 0 ? "+" : ""}
                    {(objective.currentPct * 100).toFixed(1)}%{" "}
                    <span className="text-[11px] text-slate-500">/ {objective.targetPct}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--tv-plate-0)]">
                      <div
                        className="h-full rounded-full bg-[var(--tv-accent)] transition-[width] duration-300"
                        style={{ width: `${Math.round((objPct ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="tv-figure tv-figure-secondary shrink-0 text-[10px] text-slate-400">
                      {Math.round((objPct ?? 0) * 100)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[11px] leading-snug text-slate-500">
                  {t("copilot.objNone")}
                </div>
              )}
            </div>
          </div>

          {/* La checklist du jour : son état se LIT (barre n/total), on n'a pas
              à ouvrir la page pour savoir où on en est. */}
          {onOpenChecklist && checklist && (
            <button
              type="button"
              onClick={onOpenChecklist}
              className="flex w-full items-center gap-3 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--tv-border-strong)]"
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                  checklist.locked
                    ? "tv-accent-fill"
                    : "border border-[var(--tv-border)] bg-[var(--tv-plate-0)] text-[var(--tv-highlight)]",
                )}
              >
                {checklist.locked ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-white">
                    {t("chk.dashTitle")}
                  </span>
                  {checklist.locked && (
                    <span className="tv-label shrink-0 text-[var(--tv-highlight)]">
                      {t("chk.ready")}
                    </span>
                  )}
                </span>
                {checklist.locked ? (
                  <span className="block truncate text-[11px] text-slate-500">
                    {t("chk.dashLocked")}
                  </span>
                ) : checklist.total > 0 ? (
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--tv-plate-0)]">
                      <span
                        className="block h-full rounded-full bg-[var(--tv-accent)]"
                        style={{ width: `${chkPct}%` }}
                      />
                    </span>
                    <span className="tv-figure tv-figure-secondary shrink-0 text-[10px] text-slate-500">
                      {checklist.n}/{checklist.total}
                    </span>
                  </span>
                ) : (
                  <span className="block truncate text-[11px] text-slate-500">
                    {t("chk.dashStart")}
                  </span>
                )}
              </span>
              <span className="tv-label flex shrink-0 items-center gap-0.5 text-[var(--tv-highlight)]">
                {t("chk.dashCta")} <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CopilotBlock);
