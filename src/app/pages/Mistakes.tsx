import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTradingRules } from "../hooks/useTradingRules";
import { useGoalProgress } from "../hooks/useGoalProgress";
import { computeRuleAdherence, ADHERENCE_WINDOW_DAYS } from "../utils/ruleAdherence";
import { TrendingDown, CheckCircle2, Ban, Wrench, TrendingUp, ChevronDown } from "lucide-react";
import { Trade } from "../types";
import { computeBehavioral } from "../utils/behavioral";
import {
  buildMistakePlan,
  computeCleanStreak,
  computeIncidentRate,
  type PlanItem,
} from "../utils/mistakePlan";
import { cn } from "../utils/cn";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useT } from "../i18n/LanguageContext";
import { AXIS_TICK, BAR_RADIUS, CHART_ANIMATION, tooltipStyle } from "../utils/chartTheme";
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
  /* ── LE PLAN, LA SÉRIE, LE RYTHME ───────────────────────────────────────
     Les trois calculs vivent dans `mistakePlan.ts`, pas ici : ce sont eux qui
     décident ce que la page affirme, et une règle de classement écrite dans du
     JSX ne se teste pas. Voir `tests/mistakePlan.test.ts`. */
  const plan = useMemo(() => buildMistakePlan(trades), [trades]);
  const streak = useMemo(() => computeCleanStreak(trades), [trades]);
  const rate = useMemo(() => computeIncidentRate(trades), [trades]);

  /* La consigne d'une erreur — la seule chose de cette page qui dise quoi
     FAIRE. Elle vivait repliée en douzième position d'une liste. */
  const tipDe = useCallback(
    (mistake: string) =>
      MISTAKE_TIP_KEYS[mistake] ? t(MISTAKE_TIP_KEYS[mistake] as never) : t("mistakes.defaultTip"),
    [t],
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

  return (
    <div className={cn(embedded ? "pt-2" : "p-4 md:p-5 max-w-[1400px] mx-auto")}>
      <div className="space-y-4 md:space-y-6">
        {/* ══ 1 · LE PLAN DE CORRECTION ═══════════════════════════════════
            CE BLOC REMPLACE LE COUPLE « MONTANT PERDU + BARRES DE COÛT ».

            La page ouvrait sur le P&L des trades marqués, puis classait les
            erreurs par ce qu'elles avaient coûté. Deux réponses à la même
            question — COMBIEN ÇA M'A COÛTÉ — et la bonne objection est venue
            telle quelle : « ce n'est pas ça qu'un trader veut voir ».

            Le coût d'une erreur passée n'est pas actionnable. Il ne dit ni quoi
            faire demain, ni si l'on progresse ; le tableau de bord chiffre déjà
            les pertes, et mieux.

            Trois voies, reprises mot pour mot de ce qu'on attend de cette page
            — « les choses qu'on ne fait pas bien, les choses qu'on peut
            améliorer, les choses à ne plus reproduire du tout » :

              • À NE PLUS REPRODUIRE — grave, et encore commise.
              • À TRAVAILLER — encore présente, réparable.
              • ARRÊTÉES — présente avant, absente depuis. La seule colonne qui
                récompense, et la seule preuve que la page serve à quelque
                chose.

            Aucune erreur journalisée ne peut tomber hors des trois voies :
            `tests/mistakePlan.test.ts` en fait un invariant, parce qu'une
            erreur oubliée par un filtre disparaîtrait de l'écran sans que rien
            ne l'indique. */}
        <section className="glass animate-fade-in-up overflow-hidden rounded-3xl">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
            <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-white">
              {t("mistakes.planTitle")}
            </h2>
            {/* CE QUE LA FENÊTRE PERMET DE DIRE.
                Sans fenêtre précédente, aucune des flèches de tendance n'est
                calculable et la colonne « arrêtées » est vide par
                construction. Le dire évite qu'on lise ce vide comme un
                sans-faute. */}
            <p className="tv-row-label">
              {plan.hasPrevious
                ? t("mistakes.planSub").replace("{n}", String(plan.windowDays))
                : t("mistakes.rateNoBase")}
            </p>
          </header>

          {/* Trois colonnes séparées par un filet, empilées sous 768px. Chacune
              se lit seule : son titre dit ce qu'elle demande, et son vide dit
              qu'il n'y a rien — jamais un espace blanc muet. */}
          <div className="grid divide-y divide-white/[0.05] md:grid-cols-3 md:divide-x md:divide-y-0">
            <Voie
              ton="banish"
              titre={t("mistakes.laneBanish")}
              sous={t("mistakes.laneBanishSub")}
              items={plan.banish}
              vide={t("mistakes.laneEmptyBanish")}
              tipDe={tipDe}
              /* La première consigne de la voie la plus grave est OUVERTE :
                 c'est la seule action qu'on demande maintenant. */
              ouvrirPremier
            />
            <Voie
              ton="work"
              titre={t("mistakes.laneWork")}
              sous={t("mistakes.laneWorkSub")}
              items={plan.work}
              vide={t("mistakes.laneEmptyWork")}
              tipDe={tipDe}
              ouvrirPremier={plan.banish.length === 0}
            />
            <Voie
              ton="stopped"
              titre={t("mistakes.laneStopped")}
              sous={t("mistakes.laneStoppedSub").replace("{n}", String(plan.windowDays))}
              items={plan.stopped}
              vide={t("mistakes.laneEmptyStopped")}
              tipDe={tipDe}
            />
          </div>
        </section>

        {/* ══ 2 · EST-CE QUE TU PROGRESSES ? ══════════════════════════════
            L'ancien deuxième bloc classait les fuites par coût. Celui-ci
            répond à la seule question qui fasse revenir sur cette page.

            Trois mesures, et pas une de plus :

              • LA SÉRIE PROPRE. Un score sur 100 dit où l'on en est ; il ne
                donne aucune raison d'ouvrir la page demain. « Quatorze trades
                sans une erreur » en donne une — le quinzième compte.
              • LE RYTHME, PAR TRADE. En valeur absolue, augmenter son activité
                suffirait à faire croire qu'on régresse.
              • LES HUIT DERNIÈRES SEMAINES. Ce graphe existait plus bas, dans
                sa propre carte, à côté d'une courbe qui redessinait sa propre
                barre. Il appartient ici : c'est la progression. */}
        <section className="glass animate-fade-in-up stagger-1 rounded-3xl px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-white">
              {t("mistakes.progressTitle")}
            </h2>
            {/* CE QUE LA MESURE VAUT, écrit à côté d'elle. Ces chiffres portent
                sur ce que le trader a bien voulu COCHER, pas sur sa discipline
                réelle — et la page ne doit pas laisser croire l'inverse. */}
            <p className="tv-row-label">{t("mistakes.declared")}</p>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(0,1fr)] lg:gap-8">
            <div className="min-w-0">
              <div className="tv-label text-slate-500">{t("mistakes.streak")}</div>
              <div
                className={cn(
                  "tv-figure mt-1.5 text-[40px] leading-none",
                  streak.current > 0 ? "rp-pos" : "text-slate-500",
                )}
              >
                {streak.current}
              </div>
              <p className="tv-row-label mt-1.5 max-w-[190px]">{t("mistakes.streakUnit")}</p>
              <p className="tv-row-label mt-0.5">
                {t("mistakes.streakBest").replace("{n}", String(streak.best))}
              </p>
            </div>

            <div className="min-w-0">
              <div className="tv-label text-slate-500">{t("mistakes.ratePerTrade")}</div>
              {rate.recent ? (
                <>
                  <div className="tv-figure mt-1.5 text-[40px] leading-none text-white">
                    {(rate.recent.incidents / rate.recent.trades).toFixed(2)}
                  </div>
                  {rate.deltaPct === null ? (
                    <p className="tv-row-label mt-1.5 max-w-[190px]">{t("mistakes.rateNoBase")}</p>
                  ) : (
                    <p
                      className={cn(
                        "mt-1.5 flex max-w-[190px] items-baseline gap-1.5 text-xs font-bold",
                        rate.deltaPct < 0
                          ? "rp-pos"
                          : rate.deltaPct > 0
                            ? "rp-neg"
                            : "text-slate-400",
                      )}
                    >
                      <span className="tv-figure">
                        {rate.deltaPct > 0 ? "+" : ""}
                        {rate.deltaPct}%
                      </span>
                      <span className="font-normal text-slate-500">
                        {rate.deltaPct < 0
                          ? t("mistakes.rateImproving")
                          : rate.deltaPct > 0
                            ? t("mistakes.rateWorsening")
                            : t("mistakes.rateStable")}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="tv-row-label mt-1.5 max-w-[190px]">{t("mistakes.rateNoBase")}</p>
              )}
            </div>

            {/* LES HUIT DERNIÈRES SEMAINES — des barres, sans axe ni légende.
                Une hauteur en pixels, pas une chaîne flex : un
                `ResponsiveContainer` en hauteur 100 % ne dessine rien quand son
                parent n'a pas de hauteur définie, et cette panne-là est
                muette. */}
            {b.weeklyTrend.length > 1 && (
              <div className="col-span-full min-w-0 lg:col-span-1">
                <div className="tv-label mb-1.5 text-slate-500">{t("mistakes.weeklyTrend")}</div>
                <div className="h-[104px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={b.weeklyTrend}
                      margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                    >
                      <XAxis dataKey="week" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        {...tooltipStyle}
                        cursor={{ fill: "rgba(148,163,184,.06)" }}
                        formatter={(value: number | string) => [
                          `${value}`,
                          t("mistakes.incidents"),
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        radius={BAR_RADIUS}
                        fill="#f59e0b"
                        fillOpacity={0.55}
                        {...CHART_ANIMATION}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>

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

        {/* ── QUAND LES ERREURS ARRIVENT ──────────────────────────────────
            La tendance hebdomadaire a quitté cette rangée : elle appartient au
            bloc « Est-ce que tu progresses ? », qui EST la question qu'elle
            pose. Elle traçait par ailleurs la même série DEUX FOIS (une barre
            et une courbe, même ambre, superposées).
            Restent les deux répartitions qui disent OÙ se concentrent les
            erreurs — la séance et le jour. */}
        {b.totalIncidents > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

/* ────────────────────────────────────────────────────────────────────────────
   UNE VOIE DU PLAN
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * LE TON D'UNE VOIE — sa couleur, son icône, et ce que la colonne demande.
 *
 * Trois voies, trois registres : on INTERDIT, on TRAVAILLE, on FÉLICITE. La
 * couleur porte cette différence avant que le titre ne soit lu — c'est tout ce
 * qu'on lui demande, et c'est la raison pour laquelle « arrêtées » est en vert
 * plein alors que rien d'autre sur cette page ne l'est.
 */
const TON_VOIE = {
  banish: { Icone: Ban, texte: "text-red-400", pastille: "bg-red-400" },
  work: { Icone: Wrench, texte: "text-amber-400", pastille: "bg-amber-400" },
  stopped: { Icone: CheckCircle2, texte: "text-emerald-400", pastille: "bg-emerald-400" },
} as const;

/**
 * UNE COLONNE DU PLAN.
 *
 * Elle affiche TOUJOURS quelque chose. Une colonne vide qui disparaîtrait
 * laisserait croire que la page n'a rien mesuré, alors qu'elle a mesuré et n'a
 * rien trouvé — deux choses différentes, et la seconde est une bonne nouvelle
 * dans deux colonnes sur trois.
 */
function Voie({
  ton,
  titre,
  sous,
  items,
  vide,
  tipDe,
  ouvrirPremier = false,
}: {
  ton: keyof typeof TON_VOIE;
  titre: string;
  sous: string;
  items: PlanItem[];
  vide: string;
  tipDe: (mistake: string) => string;
  ouvrirPremier?: boolean;
}) {
  const { Icone, texte, pastille } = TON_VOIE[ton];
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2">
        <Icone className={cn("h-4 w-4 shrink-0", texte)} />
        <h3 className={cn("text-sm font-bold", texte)}>{titre}</h3>
        {items.length > 0 && (
          <span className="tv-figure ml-auto shrink-0 text-xs text-slate-500">{items.length}</span>
        )}
      </div>
      <p className="tv-row-label mt-0.5">{sous}</p>

      {items.length === 0 ? (
        <p className="tv-prose mt-3 text-slate-500">{vide}</p>
      ) : (
        <div className="mt-3 space-y-1">
          {items.map((item, i) => (
            <ItemPlan
              key={item.mistake}
              item={item}
              pastille={pastille}
              tip={tipDe(item.mistake)}
              /* La consigne ne s'affiche pas partout : douze erreurs × deux
                 lignes de conseil rendraient la colonne illisible, ce qui est
                 exactement le reproche fait à la version précédente. Une seule
                 est ouverte — celle sur laquelle on demande d'agir. */
              ouvert={ouvrirPremier && i === 0}
              /* Rien à corriger sur une erreur arrêtée : elle porte son nom et
                 sa preuve, pas une consigne. */
              consigne={ton !== "stopped"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * UNE ERREUR DANS SA VOIE.
 *
 * Trois faits, jamais plus : combien de fois SUR LA FENÊTRE (pas depuis
 * toujours — une habitude morte n'a rien à corriger), dans quel sens elle va,
 * et la consigne pour l'arrêter.
 *
 * Le COÛT n'y figure plus. Il était le héros de cette page, et c'est la seule
 * chose qu'on ne peut pas changer : il décrit un passé. Il reste lisible dans
 * le journal, où il qualifie des trades.
 */
function ItemPlan({
  item,
  pastille,
  tip,
  ouvert: ouvertParDefaut,
  consigne,
}: {
  item: PlanItem;
  pastille: string;
  tip: string;
  ouvert: boolean;
  consigne: boolean;
}) {
  const { t } = useT();
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  /* Une erreur arrêtée n'est pas cliquable : il n'y a rien à déplier. Un
     bouton qui ne fait rien coûte plus qu'il ne rapporte. */
  const cliquable = consigne;
  const compte = consigne ? item.recent : item.previous;

  const corps = (
    <span className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-1">
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 self-center rounded-full", pastille)} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
        {item.mistake}
      </span>
      <span className="tv-figure shrink-0 text-xs text-slate-500">{compte}×</span>
      {/* LA TENDANCE — la seule information de cette page qui dise si l'on
          progresse. Elle était calculée pour chaque erreur et affichée pour
          trois. */}
      {item.deltaPct !== null && item.deltaPct !== 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold",
            item.deltaPct < 0 ? "rp-pos" : "rp-neg",
          )}
          title={t("mistakes.trendWindow")}
        >
          {item.deltaPct < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <TrendingUp className="h-3 w-3" />
          )}
          {item.deltaPct > 0 ? "+" : ""}
          {item.deltaPct}%
        </span>
      )}
      {cliquable && (
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0 self-center text-slate-600 transition-transform",
            ouvert && "rotate-180",
          )}
        />
      )}
    </span>
  );

  return (
    <article>
      {cliquable ? (
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          className="tv-row-toggle -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left"
        >
          {corps}
        </button>
      ) : (
        <div className="px-2 py-1.5">{corps}</div>
      )}
      {cliquable && ouvert && (
        <p className="tv-prose animate-fade-in mt-1 border-l-2 border-[rgb(var(--tv-accent-rgb)/0.5)] py-0.5 pl-3 text-slate-400">
          {tip}
        </p>
      )}
    </article>
  );
}
