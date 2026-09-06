import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTradingRules } from "../hooks/useTradingRules";
import { useGoalProgress } from "../hooks/useGoalProgress";
import { computeRuleAdherence, ADHERENCE_WINDOW_DAYS } from "../utils/ruleAdherence";
import {
  TrendingDown,
  Lightbulb,
  CheckCircle2,
  Target,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { Trade } from "../types";
import { formatPnl } from "../utils/tradeCalcs";
import { computeBehavioral, Severity } from "../utils/behavioral";
import { cn } from "../utils/cn";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  CartesianGrid,
} from "recharts";
import { useT } from "../i18n/LanguageContext";
import {
  AXIS_TICK,
  BAR_RADIUS,
  CHART_ANIMATION,
  EQUITY_CURVE_TYPE,
  EQUITY_GRID,
  TREND_LINE,
  tooltipStyle,
  glowActiveDot,
} from "../utils/chartTheme";
import { EmptyState, Card } from "@/shared/ui";

interface MistakesProps {
  trades: Trade[];
  embedded?: boolean;
}

// Mistake names are stored data (fixed English presets); their coaching tips
// live in the i18n dicts so the advice follows the app language.
const MISTAKE_TIP_KEYS: Record<string, string> = {
  "No stop loss": "mistakes.tipNoStop",
  Overtrading: "mistakes.tipOvertrading",
  "Revenge trade": "mistakes.tipRevenge",
  "FOMO entry": "mistakes.tipFomo",
  "Premature exit": "mistakes.tipPrematureExit",
  "Holding too long": "mistakes.tipHolding",
  "Size too large": "mistakes.tipSize",
  "Ignored plan": "mistakes.tipIgnoredPlan",
  "Chased entry": "mistakes.tipChased",
  "Averaged down": "mistakes.tipAveraged",
  "Ignored market conditions": "mistakes.tipConditions",
  "Low liquidity": "mistakes.tipLiquidity",
};

const SEV_STYLE: Record<Severity, { text: string; bg: string; bar: string; dot: string }> = {
  high: {
    text: "text-red-400",
    bg: "bg-red-500/10 border-red-500/25",
    bar: "bg-red-400/70",
    dot: "bg-red-400",
  },
  medium: {
    text: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/25",
    bar: "bg-amber-500/60",
    dot: "bg-amber-400",
  },
  low: {
    text: "text-slate-300",
    bg: "bg-slate-500/10 border-slate-500/25",
    bar: "bg-slate-400/50",
    dot: "bg-slate-400",
  },
};

export default function Mistakes({ trades, embedded = false }: MistakesProps) {
  const { t, lang } = useT();
  const locale =
    (
      {
        en: "en-US",
        es: "es-ES",
        pt: "pt-PT",
        fr: "fr-FR",
        de: "de-DE",
        it: "it-IT",
        nl: "nl-NL",
        ru: "ru-RU",
        zh: "zh-CN",
        ja: "ja-JP",
        ar: "ar-SA",
        hi: "hi-IN",
      } as Record<string, string>
    )[lang] || "en-US";
  const DAY_NAMES = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, 1 + i)),
      ),
    [locale],
  );

  const b = useMemo(() => computeBehavioral(trades), [trades]);

  // ── Tenue des règles ────────────────────────────────────────────────────
  // Complément naturel des erreurs : cette page dit ce qui va mal, l'adhérence
  // dit ce que le trader TIENT. Sans elle, la page ne parle que d'échecs.
  // Le solde vient de `useGoalProgress`, qui le charge déjà — pas de second
  // chargement, pas de seconde définition de « solde du compte ».
  const { user } = useAuth();
  const rules = useTradingRules();
  const { ctx: measureCtx } = useGoalProgress(trades, user?.id);
  const adherence = useMemo(
    () =>
      computeRuleAdherence(trades, rules, measureCtx.startingBalance + measureCtx.stats.totalPnl),
    [trades, rules, measureCtx.startingBalance, measureCtx.stats.totalPnl],
  );
  /* La plus grosse fuite en valeur absolue — l'échelle des barres de part.
     Sans elle, chaque ligne aurait sa propre échelle et deux barres égales
     désigneraient deux montants différents. */
  const maxFuite = useMemo(
    () => b.rows.reduce((m, r) => Math.max(m, Math.abs(r.totalPnl)), 0),
    [b.rows],
  );

  const dayData = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => i + 1).map((d) => ({
        day: DAY_NAMES[d],
        count: b.byDay[d] || 0,
      })),
    [b.byDay, DAY_NAMES],
  );
  const sessionData = useMemo(
    () =>
      (["london", "newyork", "asia"] as const).map((s) => ({
        session: t(`session.${s}` as never),
        count: b.bySession[s],
      })),
    [b.bySession, t],
  );
  const maxSessionCount = Math.max(...sessionData.map((s) => s.count), 1);

  if (trades.length === 0) {
    if (embedded) return null;
    return (
      <div className="p-4 md:p-5">
        <EmptyState title={t("mistakes.noTrades")} />
      </div>
    );
  }

  /* Le score de discipline. Sa teinte et la géométrie de l'ancien disque
     (rayon, circonférence) vivaient encore ici alors que le disque a disparu
     du rendu : quatre valeurs calculées à chaque rendu pour personne. */
  const disc = b.cleanJournalScore;

  return (
    <div className={cn(embedded ? "pt-2" : "p-4 md:p-5 max-w-[1400px] mx-auto")}>
      <div className="space-y-4 md:space-y-6">
        {/* ══ LE VERDICT ══════════════════════════════════════════════════
            TROIS RANGÉES DE CHROME OUVRAIENT LA PAGE : un disque de score, une
            grille de quatre tuiles, puis une bande « tes trades propres
            gagnent X points de plus » — la seule phrase de la page qui dise
            quelque chose, posée en troisième, en petit, entre deux blocs de
            chiffres.

            Elle est maintenant la PREMIÈRE chose lue, avec le montant qu'elle
            chiffre. Le score et les compteurs restent, mais en appui, sur la
            même ligne : ils accompagnent le verdict, ils ne le précèdent
            plus. */}
        <section className="glass animate-fade-in-up rounded-3xl px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 max-w-xl">
              {/* « Coût total » avec un « +1 831,50 $ » en VERT se contredit
                  tout seul : la valeur n'est pas un coût, c'est le P&L des
                  trades où une erreur a été cochée. Le libellé dit maintenant
                  ce que le chiffre est, et la couleur suit son signe — quand
                  il est négatif, il se lit bien comme un coût. */}
              <div className="tv-label flex items-center gap-1.5 text-slate-500">
                <TrendingDown className="h-3.5 w-3.5" />
                {t("mistakes.flaggedPnl")}
              </div>
              <div
                className={cn(
                  "tv-figure mt-1 text-[34px] leading-none md:text-5xl",
                  b.totalCost < 0 ? "rp-neg" : "text-white",
                )}
              >
                {formatPnl(b.totalCost)}
              </div>
              <p className="tv-prose mt-2 text-slate-400">
                {b.cleanWinRate !== null && b.mistakeWinRate !== null ? (
                  <>
                    {t("mistakes.edgePrefix")}{" "}
                    <span className="font-bold text-[var(--tv-chart-green)]">
                      {((b.cleanWinRate - b.mistakeWinRate) * 100).toFixed(0)}{" "}
                      {t("mistakes.edgePoints")}
                    </span>{" "}
                    {t("mistakes.edgeSuffix")}
                  </>
                ) : (
                  t("mistakes.disciplineSub")
                )}
              </p>
            </div>

            <div className="mc-facts">
              <FaitErreur
                label={t("mistakes.discipline")}
                value={`${disc}`}
                hint="/ 100"
                tone={disc >= 60 ? "pos" : disc >= 40 ? "warn" : "neg"}
              />
              <FaitErreur
                label={t("mistakes.totalMistakes")}
                value={String(b.totalIncidents)}
                hint={`${b.tradesWithMistakes} ${t("mistakes.tradesSuffix")}`}
              />
              <FaitErreur
                label={t("mistakes.cleanWr")}
                value={b.cleanWinRate !== null ? `${(b.cleanWinRate * 100).toFixed(0)}%` : "—"}
                hint={t("mistakes.cleanSuffix")}
                tone="pos"
              />
              <FaitErreur
                label={t("mistakes.mistakeWr")}
                value={b.mistakeWinRate !== null ? `${(b.mistakeWinRate * 100).toFixed(0)}%` : "—"}
                hint={t("mistakes.mistakeSuffix")}
                tone="warn"
              />
            </div>
          </div>

          {/* La part de journal propre — une barre, à la place du disque. */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="tv-label text-slate-500">{t("mistakes.cleanSuffix")}</span>
              <span className="tv-figure text-xs text-slate-400">
                {b.cleanTrades}/{trades.length}
              </span>
            </div>
            <div className="rp-bartrack">
              <span
                className="rp-fill-pos"
                style={{ width: `${(b.cleanTrades / Math.max(1, trades.length)) * 100}%` }}
              />
            </div>
          </div>
        </section>

        {/* ══ LES FUITES, CLASSÉES ═════════════════════════════════════════
            Elles vivaient TOUT EN BAS de la page — après le disque, les quatre
            tuiles, la bande d'écart, une carte de sévérité dont deux barres sur
            trois étaient à zéro, un histogramme à barre unique qui redessinait
            ces mêmes lignes en moins lisible, la tenue des règles et trois
            graphes de calendrier. Ce que le trader vient chercher arrivait en
            neuvième position, et seulement pour les trois premières erreurs.

            C'est maintenant le deuxième bloc, et il les montre TOUTES : le nom,
            la gravité, la tendance (recule ou empire — la seule information de
            cette page qui dise s'il PROGRESSE, et elle était calculée sans être
            affichée hors du top 3), le nombre, le coût, sa part du total, et
            la consigne qui va avec. */}
        {b.rows.length > 0 ? (
          <section className="glass animate-fade-in-up stagger-1 overflow-hidden rounded-3xl">
            <header className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3 sm:px-5">
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <h2 className="tv-label text-slate-400">{t("mistakes.leaks")}</h2>
            </header>
            {/* ── LE GRAPHIQUE D'ABORD, LA LISTE ENSUITE ──────────────────
                Douze lignes de texte ouvraient ce bloc. Chacune était juste,
                et l'ensemble illisible : pour savoir laquelle coûte le plus,
                il fallait comparer douze montants à la lecture. « Il y en a
                beaucoup trop et on ne comprend pas » — c'est exactement ça.

                Un graphique répond à cette question SANS lecture : la barre la
                plus longue est la fuite la plus chère, on le voit avant
                d'avoir lu un mot. Les six premières suffisent — au-delà, les
                barres deviennent des traits et n'apprennent plus rien.

                Rien n'est perdu : la liste complète, avec les conseils et les
                tendances, vit juste en dessous, repliée. */}
            <div className="px-4 pb-1 pt-4 sm:px-5">
              <GrapheFuites rows={b.rows} />
            </div>

            <details className="group border-t border-white/[0.05]">
              <summary className="tv-row-toggle flex cursor-pointer list-none items-center gap-2 px-4 py-3 sm:px-5">
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                <span className="tv-label text-slate-400">
                  {t("mistakes.leaks")} · {b.rows.length}
                </span>
              </summary>
              <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                {b.rows.map((m, idx) => (
                  <LigneFuite
                    key={m.mistake}
                    m={m}
                    premiere={idx === 0}
                    part={Math.abs(m.totalPnl) / Math.max(1, maxFuite)}
                    tip={
                      MISTAKE_TIP_KEYS[m.mistake]
                        ? t(MISTAKE_TIP_KEYS[m.mistake] as never)
                        : t("mistakes.defaultTip")
                    }
                  />
                ))}
              </div>
            </details>
            {/* L'objectif de progression — il porte la première fuite. */}
            <div className="flex items-start gap-3 border-t border-white/[0.05] px-4 py-3.5 sm:px-5">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div className="text-xs leading-relaxed text-slate-300">
                <span className="font-bold text-cyan-300">{t("mistakes.goal")}: </span>
                {t("mistakes.goalIntro")}{" "}
                <span className="font-bold text-white">{b.rows[0].mistake}</span>{" "}
                {t("mistakes.goalMid")}{" "}
                <span className="font-bold text-[var(--tv-chart-green)]">
                  {Math.min(100, disc + 10)}/100
                </span>{" "}
                {t("mistakes.goalEnd")}
              </div>
            </div>
          </section>
        ) : (
          <section className="glass animate-fade-in-up stagger-1 rounded-3xl py-10 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
            <p className="text-sm text-slate-400">{t("mistakes.noMistakesGreat")}</p>
          </section>
        )}

        {/* ── Tenue des règles ──
            Le pendant POSITIF des erreurs : « tu l'as tenue 11 fois sur 12 ».
            Affiché seulement si des règles vérifiables ont réellement été
            éprouvées — une section vide vaudrait mieux qu'un 100 % inventé. */}
        {adherence.length > 0 && (
          <Card className="p-4 md:p-5">
            <h3 className="tv-title mb-1">{t("mistakes.adherence")}</h3>
            <p className="tv-row-label mb-3">
              {t("mistakes.adherenceSub").replace("{n}", String(ADHERENCE_WINDOW_DAYS))}
            </p>
            <div className="space-y-2.5">
              {adherence.map((a) => (
                <div key={a.ruleId} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 flex-1 min-w-0 truncate">
                    {a.text}
                  </span>
                  <div className="w-20 md:w-28 h-1.5 bg-white/[0.06] rounded-full overflow-hidden shrink-0">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-250",
                        a.ratePct >= 80
                          ? "bg-emerald-400"
                          : a.ratePct >= 50
                            ? "bg-amber-400"
                            : "bg-red-400",
                      )}
                      style={{ width: `${a.ratePct}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "tv-figure text-[11px] shrink-0 w-16 text-right",
                      a.ratePct >= 80
                        ? "text-emerald-400"
                        : a.ratePct >= 50
                          ? "text-amber-400"
                          : "text-red-400",
                    )}
                  >
                    {a.kept}/{a.applicable}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── When mistakes happen: weekly trend + session + day ── */}
        {b.totalIncidents > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly trend */}
            <Card hover className="p-4 md:p-5 animate-fade-in-up stagger-5">
              <h3 className="tv-title mb-1">{t("mistakes.weeklyTrend")}</h3>
              <p className="tv-hint mb-3">{t("mistakes.weeklyTrendSub")}</p>
              {b.weeklyTrend.length > 0 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={b.weeklyTrend}>
                      <CartesianGrid {...EQUITY_GRID} />
                      <XAxis dataKey="week" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={24}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any, name: any) => [
                          name === "count" ? `${value}` : `$${Number(value).toFixed(2)}`,
                          name === "count" ? t("mistakes.incidents") : t("mistakes.totalCost"),
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        radius={BAR_RADIUS}
                        fill="#f59e0b"
                        fillOpacity={0.5}
                        {...CHART_ANIMATION}
                      />
                      <Line
                        type={EQUITY_CURVE_TYPE}
                        dataKey="count"
                        stroke="#f59e0b"
                        {...TREND_LINE}
                        dot={false}
                        activeDot={glowActiveDot("#f59e0b")}
                        {...CHART_ANIMATION}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
                  —
                </div>
              )}
            </Card>

            {/* Session + day distribution */}
            <Card hover className="p-4 md:p-5 animate-fade-in-up stagger-6 space-y-4">
              <div>
                <h3 className="tv-title mb-2">{t("mistakes.bySession")}</h3>
                <div className="space-y-2">
                  {sessionData.map((s) => (
                    <div key={s.session} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 shrink-0">{s.session}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500/50"
                          style={{ width: `${(s.count / maxSessionCount) * 100}%` }}
                        />
                      </div>
                      <span className="tv-figure text-[10px] text-slate-400 w-6 text-right">
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="tv-title mb-2">{t("mistakes.byDay")}</h3>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData}>
                      <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any) => [`${value}`, t("mistakes.incidents")]}
                      />
                      <Bar
                        dataKey="count"
                        radius={BAR_RADIUS}
                        fill="#f59e0b"
                        fillOpacity={0.5}
                        {...CHART_ANIMATION}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CE QUI TE COÛTE LE PLUS — la question de la page, en une image.
 *
 * ── POURQUOI UN GRAPHIQUE ET PAS LA LISTE ───────────────────────────────────
 *
 * La liste disait tout et ne montrait rien. Douze montants alignés se
 * COMPARENT à la lecture : il faut les tenir en tête deux par deux pour savoir
 * lequel est le plus gros. Des barres répondent avant qu'on ait lu un mot —
 * c'est la seule chose qu'un graphique fait mieux qu'un tableau, et c'est
 * exactement ce qu'on vient chercher ici.
 *
 * ── LES CHOIX ───────────────────────────────────────────────────────────────
 *
 *   • HORIZONTAL. Les noms d'erreurs sont longs (« Ignored market
 *     conditions ») ; en vertical ils se chevauchent ou s'inclinent. En
 *     horizontal ils se lisent à plat, ce qui supprime le besoin de légende.
 *   • SIX AU PLUS. Au-delà, les barres du bas deviennent des traits : elles
 *     occupent de la place sans rien départager. La liste complète reste
 *     accessible juste en dessous.
 *   • VALEUR ABSOLUE, teinte par GRAVITÉ. La longueur dit combien, la couleur
 *     dit à quel point c'est grave — deux informations sur un seul objet, sans
 *     rien empiler.
 */
function GrapheFuites({
  rows,
}: {
  rows: { mistake: string; severity: Severity; count: number; totalPnl: number }[];
}) {
  const { t } = useT();
  const data = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl))
        .slice(0, 6)
        .map((r) => ({
          nom: r.mistake,
          cout: Math.abs(r.totalPnl),
          brut: r.totalPnl,
          count: r.count,
          severity: r.severity,
        })),
    [rows],
  );

  if (data.length === 0) return null;

  return (
    <div style={{ height: Math.max(140, data.length * 34 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nom"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={118}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: "rgba(148,163,184,.06)" }}
            formatter={(
              _v: number | string,
              _n: string,
              p: { payload?: (typeof data)[number] },
            ) => [
              `${formatPnl(p.payload?.brut ?? 0)} · ${p.payload?.count ?? 0}×`,
              t("mistakes.totalCost"),
            ]}
          />
          <Bar dataKey="cout" radius={BAR_RADIUS} {...CHART_ANIMATION}>
            {data.map((d) => (
              <Cell key={d.nom} fill={SEV_FILL[d.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** La teinte des barres — la même famille que les pastilles de gravité, en
 *  valeur pleine : une barre doit se lire à distance, pas une bordure. */
const SEV_FILL: Record<Severity, string> = {
  high: "#f87171",
  medium: "#f59e0b",
  low: "#94a3b8",
};

/**
 * UN FAIT DU VERDICT — filet vertical, jamais de cadre. Le disque de score de
 * 84px et les quatre tuiles encadrées faisaient trois rangées de chrome avant
 * la première information ; ces quatre chiffres tiennent sur une ligne, à côté
 * de la phrase qu'ils appuient.
 */
function FaitErreur({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg" | "warn";
}) {
  return (
    <div className="min-w-0">
      <div className="tv-label truncate text-slate-500">{label}</div>
      <div
        className={cn(
          "tv-figure mt-1 truncate text-base leading-none",
          tone === "pos"
            ? "rp-pos"
            : tone === "neg"
              ? "rp-neg"
              : tone === "warn"
                ? "rp-warn"
                : "text-white",
        )}
      >
        {value}
      </div>
      {hint && <div className="tv-row-label mt-1 truncate">{hint}</div>}
    </div>
  );
}

/**
 * UNE FUITE — tout ce que le produit sait d'elle, sur une ligne.
 *
 * Elle était dessinée deux fois et mal : une fois en histogramme horizontal
 * (le nom, le montant, rien d'autre) et une fois en carte de conseil, mais
 * seulement pour les trois premières. La TENDANCE — recule ou empire — était
 * calculée par `computeBehavioral` pour chaque erreur et n'apparaissait que
 * dans ces trois cartes : la seule information de la page qui dise au trader
 * s'il progresse restait invisible pour la quatrième erreur et les suivantes.
 */
function LigneFuite({
  m,
  premiere,
  part,
  tip,
}: {
  m: {
    mistake: string;
    severity: Severity;
    count: number;
    totalPnl: number;
    trend: { deltaPct: number } | null;
  };
  premiere: boolean;
  part: number;
  tip: string;
}) {
  const { t } = useT();
  /* LA CONSIGNE EST REPLIÉE, SAUF SUR LA PREMIÈRE FUITE.
     Elle s'affichait sous CHAQUE ligne : douze erreurs journalisées, douze
     paragraphes de deux lignes, et la liste passait de 12 lignes de 64px à
     douze blocs de 110px — la moitié de la page pour des conseils qu'on lit
     une fois. La priorité, elle, s'ouvre d'emblée : c'est la seule sur
     laquelle on demande d'agir maintenant. */
  const [ouvert, setOuvert] = useState(premiere);

  return (
    <article>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="tv-row-toggle block w-full px-4 py-3 sm:px-5"
      >
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            aria-hidden
            className={cn("h-2 w-2 shrink-0 self-center rounded-full", SEV_STYLE[m.severity].dot)}
          />
          <span className="text-sm font-semibold text-white">{m.mistake}</span>
          <span
            className={cn(
              "tv-label rounded px-1 py-0.5",
              SEV_STYLE[m.severity].bg,
              SEV_STYLE[m.severity].text,
            )}
          >
            {t(`mistakes.sev_${m.severity}` as never)}
          </span>
          {premiere && (
            <span className="tv-label rounded bg-red-500/20 px-1 py-0.5 text-red-400">
              {t("mistakes.priority")}
            </span>
          )}
          {/* La tendance, pour CHAQUE fuite — pas seulement les trois premières. */}
          {m.trend && m.trend.deltaPct !== 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-bold",
                m.trend.deltaPct < 0 ? "rp-pos" : "rp-neg",
              )}
              title={t("mistakes.trendWindow")}
            >
              {m.trend.deltaPct < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <TrendingUp className="h-3 w-3" />
              )}
              {m.trend.deltaPct > 0 ? "+" : ""}
              {m.trend.deltaPct}%
            </span>
          )}
          <span className="tv-figure ml-auto shrink-0 text-xs text-slate-500">{m.count}×</span>
          <span className={cn("tv-figure shrink-0 text-sm", m.totalPnl >= 0 ? "rp-pos" : "rp-neg")}>
            {formatPnl(m.totalPnl)}
          </span>
          {/* Le chevron — le seul signal qui dise « cette ligne répond au clic ». */}
          <ChevronDown
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 self-center text-slate-600 transition-transform",
              ouvert && "rotate-180",
            )}
          />
        </span>
        <span className="rp-bartrack mt-2 block">
          <span
            className={m.totalPnl >= 0 ? "rp-fill-pos" : "rp-fill-neg"}
            style={{ width: `${Math.max(2, part * 100)}%` }}
          />
        </span>
      </button>
      {ouvert && <p className="tv-prose animate-fade-in px-4 pb-3 text-slate-500 sm:px-5">{tip}</p>}
    </article>
  );
}
