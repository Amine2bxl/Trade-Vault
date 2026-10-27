import { ChevronRight, X } from "@/shared/ui/icons";
import { Modal } from "@/shared/ui";
import { formatMoney } from "@/shared/currency";
import { isBreakEven, type Trade } from "@/app/types";
import type { GridDay } from "./calendarGrid";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";

/**
 * LA SEMAINE, OUVERTE.
 *
 * Le total de semaine était une case muette — et masquée sur téléphone. Il
 * s'ouvre maintenant sur ce qui l'a produit : les sept jours, leurs trades, le
 * résultat. Les jours d'un mois voisin restent affichés (c'est la vraie
 * semaine) mais à part, marqués, et JAMAIS dans les totaux : consulter
 * septembre ne doit pas faire compter un trade du 1er octobre.
 */

interface DayData {
  pnl: number;
  count: number;
  trades: Trade[];
}

export default function WeekDetailModal({
  days,
  weekIndex,
  monthLabel,
  byDate,
  locale,
  onClose,
  onOpenDay,
}: {
  days: GridDay[];
  weekIndex: number;
  monthLabel: string;
  byDate: Record<string, DayData | undefined>;
  locale: string;
  onClose: () => void;
  /** Ouvre le détail d'une journée (la modale de la journée). */
  onOpenDay: (date: string) => void;
}) {
  const { t } = useT();
  const inMonth = days.filter((d) => d.inMonth);
  const monthTrades = inMonth.flatMap((d) => byDate[d.date]?.trades ?? []);
  const pnl = monthTrades.reduce((s, x) => s + x.pnl, 0);
  const decided = monthTrades.filter((x) => !isBreakEven(x));
  const wins = decided.filter((x) => x.pnl > 0).length;
  const winRate = decided.length > 0 ? wins / decided.length : null;
  const tradedDays = inMonth.filter((d) => (byDate[d.date]?.count ?? 0) > 0).length;
  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const rangeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const at = (iso: string) => new Date(`${iso}T12:00:00`);
  const range = `${rangeFmt.format(at(days[0].date))} – ${rangeFmt...[truncated]