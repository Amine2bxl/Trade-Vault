import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calculator,
  Calendar,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  Map,
  Newspaper,
  Palette,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  User,
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
 * Groups follow the trader's workflow: prepare → trade → review → understand,
 * with account plumbing last.
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
    // Before trading — the pre-session ritual and preparation tools.
    labelKey: "nav.groupBefore",
    items: [
      { id: "checklist", labelKey: "nav.checklist", icon: ClipboardCheck },
      { id: "tradingplan", labelKey: "nav.tradingPlan", icon: Map },
      { id: "goals", labelKey: "nav.goals", icon: Target },
      { id: "news", labelKey: "nav.news", icon: Newspaper },
      { id: "calculator", labelKey: "nav.calculator", icon: Calculator },
    ],
  },
  {
    // During trading — live cockpit and capture.
    labelKey: "nav.groupDuring",
    items: [
      { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { id: "journal", labelKey: "nav.journal", icon: BookOpen },
      { id: "missed", labelKey: "nav.missed", icon: Target },
    ],
  },
  {
    // After trading — review what happened.
    labelKey: "nav.groupAfter",
    items: [
      { id: "calendar", labelKey: "nav.calendar", icon: Calendar },
      { id: "mistakes", labelKey: "nav.mistakes", icon: AlertTriangle },
      { id: "reports", labelKey: "nav.reports", icon: FileText },
    ],
  },
  {
    // AI & analysis — understand the edge.
    labelKey: "nav.groupAi",
    items: [
      { id: "insights", labelKey: "nav.insights", icon: Sparkles },
      { id: "analytics", labelKey: "nav.analytics", icon: BarChart3 },
      { id: "seasonality", labelKey: "nav.seasonality", icon: CalendarRange },
    ],
  },
  {
    // Account — settings, identity, personalization, billing.
    labelKey: "nav.groupAccount",
    items: [
      { id: "settings", labelKey: "nav.settings", icon: SettingsIcon },
      { id: "profile", labelKey: "nav.profile", icon: User },
      { id: "appearance", labelKey: "nav.appearance", icon: Palette },
      { id: "subscription", labelKey: "nav.subscription", icon: CreditCard },
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
