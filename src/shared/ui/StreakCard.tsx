import * as React from "react";
import { CheckCircle2, ChevronDown, Flame, RefreshCcw } from "lucide-react";
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
}

const StreakCard = React.forwardRef<HTMLDivElement, StreakCardProps>(function StreakCard(
  {
    className,
    streak,
    currentStreak,
    longestStreak,
    total,
    title = "Streak",
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
      className={cn("stat-card rounded-2xl p-4 md:p-5", className)}
      {...props}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-300" aria-hidden="true" />
          <h3 className="tv-title">{title}</h3>
        </div>
        {onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="text-xs font-medium text-slate-500 transition-colors hover:text-cyan-300"
          >
            {actionLabel}
          </button>
        )}
      </header>

      <p className="mb-4 font-display text-4xl leading-none font-bold tracking-tight text-white">
        {currentStreak}
        <span className="ml-2 text-sm font-medium text-slate-500">{daysLabel}</span>
      </p>

      <StreakCalendar streak={streak} />

      <div
        className="mt-4 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4"
        aria-label="Streak stats"
      >
        <div>
          <p className="tv-prose text-slate-500">{longestLabel}</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-white">
            {longestStreak}
            <span className="ml-1 text-sm font-medium text-slate-500">{daysLabel}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="tv-prose text-slate-500">{totalLabel}</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-white">{total}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          <span className="text-[13px] font-semibold text-slate-300">{howItWorksTitle}</span>
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
