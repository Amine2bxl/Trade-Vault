import * as React from "react";
import { CheckCircle2, ChevronDown, Flame, RefreshCcw } from "@/shared/ui/icons";
import { cn } from "./cn";
import { StreakCalendar, type StreakPeriod } from "./StreakCalendar";

/**
 * StreakCard — la carte de série du dashboard.
 *
 * Adaptée au design system TradeVault : surface `stat-card`, flamme ambre
 * (même code couleur que l'indicateur de série de la checklist), aucune
 * dépendance shadcn. Les textes sont passés en props (le composant vit dans
 * `shared/ui`, qui n'importe jamais depuis `app/` — donc pas de i18n direct).
 */

interface StreakCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Jours complétés, passés au calendrier (semaine). */
  streak: StreakPeriod[];
  /** Série courante, en jours. */
  currentStreak: number;
  /** Plus longue série, en jours. */
  longestStreak: number;
  /** Total de jours complétés. */
  total: number;
  /** Titre de la carte. */
  title?: string;
  /** Ce que la carte mesure, en une ligne (ex. « les jours où ta checklist
   *  est verrouillée »). */
  subtitle?: string;
  /** Libellé de l'unité ("jours"). */
  daysLabel?: string;
  /** Libellé du record. */
  longestLabel?: string;
  /** Libellé du total. */
  totalLabel?: string;
  /** Libellé de l'action. */
  actionLabel?: string;
  /** Callback de l'action. */
  onActionClick?: () => void;
  /** Titre de la section "Comment ça marche". */
  howItWorksTitle?: string;
  /** Lignes affichées quand la section est ouverte. */
  howItWorksItems?: string[];
  /** État initial de la section. */
  defaultHowItWorksOpen?: boolean;
  /** La routine du jour est-elle faite ? Affichée à côté du chiffre : c'est
   *  la seule information de la carte sur laquelle on peut encore agir. */
  todayDone?: boolean;
  /** Libellés de l'état du jour (fait / à faire). */
  todayDoneLabel?: string;
  todayTodoLabel?: string;
}

const StreakCard = React.forwardRef<HTMLDivElement, StreakCardProps>(function StreakCard(
  {
    className,
    streak,
    currentStreak,
    longestStreak,
    total,
    title = "Streak",
    /* IL MANQUAIT ICI, ET CELA CASSAIT LE TABLEAU DE BORD.
       `subtitle` était déclaré dans les props et utilisé dans le JSX, mais
       jamais SORTI de l'objet : il partait dans `...props`, étalé sur la
       `<section>`, pendant que l'identifiant nu du JSX ne référençait plus
       rien. Au rendu, `ReferenceError: subtitle is not defined` — la carte
       lève, la frontière d'erreur attrape, et toute la page se remplace par
       l'écran « 500 ». C'est-à-dire : plus de tableau de bord du tout, pour
       une variable oubliée lors d'une résolution de conflit.
       (`tsc` le signalait : deux erreurs TS2304 sur ce fichier.) */
    subtitle,
    daysLabel = "days",
    longestLabel = "Longest streak",
    totalLabel = "Total",
    actionLabel = "View details",
    onActionClick,
    howItWorksTitle = "How do streaks work?",
    howItWorksItems = [
      "Complete your pre-market checklist each trading day.",
      "Each completed day grows your streak.",
      "Weekends don't break your streak — markets are closed.",
    ],
    defaultHowItWorksOpen = false,
    todayDone,
    todayDoneLabel,
    todayTodoLabel,
    ...props
  },
  ref,
) {
  const [open, setOpen] = React.useState(defaultHowItWorksOpen);
  const contentId = React.useId();

  return (
    <section
      ref={ref}
      aria-label="Streak summary card"
      /* `flex-col` porté par la carte elle-même : l'appelant ne décide que de
         l'AFFICHAGE (`hidden lg:flex`). Sans lui, `lg:flex` rangeait en-tête,
         chiffre, calendrier et stats CÔTE À CÔTE, et la largeur min-content de
         cette rangée (≈ 600px) écrasait la colonne voisine du tableau de bord. */
      className={cn("stat-card flex min-w-0 flex-col rounded-2xl p-4 md:p-5", className)}
      {...props}
    >
      <header className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-300" aria-hidden="true" />
            <h3 className="tv-title">{title}</h3>
          </div>
          {onActionClick && (
            <button
              type="button"
              onClick={onActionClick}
              className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-[var(--tv-highlight)]"
            >
              {actionLabel}
            </button>
          )}
        </div>
        {subtitle && <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{subtitle}</p>}
      </header>

      <div className="mb-4 flex items-end justify-between gap-3">
        <p className="tv-figure text-4xl leading-none font-bold tracking-tight text-white">
          {currentStreak}
          <span className="ml-2 text-sm font-medium text-slate-500">{daysLabel}</span>
        </p>
        {todayDone !== undefined && (todayDone ? todayDoneLabel : todayTodoLabel) && (
          <span
            className={cn(
              "tv-label inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1",
              todayDone
                ? "border-amber-500/30 text-amber-300"
                : "border-dashed border-[var(--tv-border-strong)] text-slate-400",
            )}
          >
            {todayDone ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            )}
            {todayDone ? todayDoneLabel : todayTodoLabel}
          </span>
        )}
      </div>

      <StreakCalendar streak={streak} />

      {/* Record et total : deux repères, pas deux chiffres héros — une ligne. */}
      <dl
        className="mt-4 mb-3 flex items-center justify-between gap-4 border-t border-[var(--tv-border)] pt-3 text-[12px]"
        aria-label="Streak stats"
      >
        <div className="flex items-baseline gap-1.5">
          <dt className="text-slate-500">{longestLabel}</dt>
          <dd className="tv-figure font-bold text-white">
            {longestStreak}
            <span className="ml-1 font-medium text-slate-500">{daysLabel}</span>
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-slate-500">{totalLabel}</dt>
          <dd className="tv-figure font-bold text-white">{total}</dd>
        </div>
      </dl>

      <div className="mt-auto">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-[var(--tv-border)] px-3.5 py-2 text-left transition-colors hover:border-[var(--tv-border-strong)]"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          <span className="text-[12px] font-semibold text-slate-400">{howItWorksTitle}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div id={contentId} className="space-y-3 px-1 pt-3">
            {howItWorksItems.map((item, index) => {
              const Icon = index === 0 ? CheckCircle2 : index === 1 ? Flame : RefreshCcw;
              return (
                <div key={`${item}-${index}`} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                  <p className="text-[13px] leading-snug text-slate-400">{item}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});

StreakCard.displayName = "StreakCard";

export { StreakCard };
export type { StreakCardProps };
