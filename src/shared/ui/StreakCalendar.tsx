import { Flame } from "lucide-react";
import { cn } from "./cn";
import { localDateOf } from "@/shared/calendar-date";

/**
 * StreakCalendar — bande des 7 derniers jours, un jour = une cellule.
 *
 * Affiche d'un coup d'œil quels jours la routine a été tenue (flamme) et lesquels
 * ne l'ont pas été (point éteint). C'est une vue "semaine", suffisante pour la
 * carte de streak du dashboard ; pas de navigation de mois.
 */

export interface StreakPeriod {
  /** Date ISO `YYYY-MM-DD` (convention UTC, comme les clés `tv-chk-*`). */
  periodStart: string;
  periodEnd: string;
}

export function StreakCalendar({
  streak,
  days = 7,
  className,
}: {
  streak: StreakPeriod[];
  days?: number;
  className?: string;
}) {
  const completed = new Set(streak.map((s) => s.periodStart));

  // Les `days` derniers jours calendaires, du plus ancien au plus récent.
  const today = new Date();
  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const iso = localDateOf(d);
    const isToday = i === days - 1;
    const label = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
    return { iso, label, done: completed.has(iso), isToday };
  });

  return (
    <div
      className={cn("flex items-end justify-between gap-1", className)}
      aria-label="Streak calendar"
    >
      {cells.map((c) => (
        <div key={c.iso} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className={cn(
              "tv-label",
              c.isToday ? "text-amber-300 font-semibold" : "text-slate-500",
            )}
          >
            {c.label}
          </span>
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-lg border transition-colors",
              c.done
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-white/[0.06] bg-white/[0.02] text-slate-600",
              c.isToday && !c.done && "border-dashed",
            )}
          >
            {c.done ? (
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-600" aria-hidden="true" />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
