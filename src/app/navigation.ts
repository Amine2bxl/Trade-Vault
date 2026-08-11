import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarRange,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Map,
  Newspaper,
  Calculator,
  Settings as SettingsIcon,
  Target,
  User,
  Dices,
} from "lucide-react";
import type { Page } from "./types";
import type { TKey } from "./i18n/translations";

/**
 * Navigation — the single source of truth for every nav surface.
 *
 * Sidebar (desktop), MobileNav (bottom bar + "More" sheet) and the
 * CommandPalette all derive from NAV_GROUPS, so adding/removing/reordering a
 * page is a one-file change and the three surfaces can never drift apart.
 *
 * Groups follow the natural flow of a trading session:
 * home → prepare → trade & journal → analyse → AI coach → account.
 */

export interface NavItem {
  id: Page;
  labelKey: TKey;
  icon: typeof LayoutDashboard;
}

export interface NavGroup {
  labelKey: TKey;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.groupHome",
    items: [{ id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.groupPreparation",
    items: [
      { id: "tradingplan", labelKey: "nav.tradingPlan", icon: Map },
      { id: "goals", labelKey: "nav.goals", icon: Target },
      { id: "simulator", labelKey: "nav.simulator", icon: Dices },
      { id: "news", labelKey: "nav.news", icon: Newspaper },
      { id: "calculator", labelKey: "nav.calculator", icon: Calculator },
      { id: "checklist", labelKey: "nav.checklist", icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "nav.groupJournal",
    items: [
      { id: "journal", labelKey: "nav.journal", icon: BookOpen },
    ],
  },
  {
    labelKey: "nav.groupAnalysis",
    items: [
      { id: "analytics", labelKey: "nav.analytics", icon: BarChart3 },
      { id: "mistakes", labelKey: "nav.mistakes", icon: AlertTriangle },
      { id: "reports", labelKey: "nav.reports", icon: FileText },
      { id: "seasonality", labelKey: "nav.seasonality", icon: CalendarRange },
    ],
  },
  {
    labelKey: "nav.groupJarvis",
    items: [
      { id: "insights", labelKey: "nav.jarvis", icon: Bot },
      { id: "montecarlo", labelKey: "nav.montecarlo", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.groupAccount",
    items: [
      { id: "settings", labelKey: "nav.settings", icon: SettingsIcon },
      { id: "inbox", labelKey: "nav.inbox", icon: Bell },
    ],
  },
];

/** Pages promoted to the mobile bottom bar (order = left→right around the FAB). */
export const MOBILE_BAR: Page[] = ["dashboard", "journal", "analytics"];

/** Flat list (workflow order) — used by the CommandPalette. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The "More" sheet on mobile: every group minus the promoted bar items. */
export const MOBILE_MORE_GROUPS: NavGroup[] = NAV_GROUPS.map((g) => ({
  ...g,
  items: g.items.filter((i) => !MOBILE_BAR.includes(i.id)),
})).filter((g) => g.items.length > 0);
