import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  Crosshair,
  FileText,
  LayoutDashboard,
  Map,
  Newspaper,
  Palette,
  Calculator,
  Settings as SettingsIcon,
  Target,
  User,
  Shuffle,
} from "lucide-react";
import { PAGES, SECTIONS, type Page, type SectionId } from "./types";
import type { TKey } from "./i18n/translations";

/**
 * Navigation — la seule source de vérité de toutes les surfaces de navigation.
 *
 * Barre latérale (desktop), barre du bas + en-tête (mobile), barre d'onglets de
 * section et palette de commandes dérivent TOUTES d'ici, donc elles ne peuvent
 * pas diverger.
 *
 * Deux niveaux, deux tables :
 *
 * - `PAGE_META` — un libellé et une icône par page. Le clé/valeur couvre
 *   `PAGES` en entier (`Record<Page, …>` : oublier une page ne compile pas).
 * - `SECTION_META` — idem pour les six sections déclarées dans `types.ts`.
 *
 * Les LIBELLÉS DE SECTION réutilisent les clés i18n des anciens groupes
 * (`nav.groupPreparation`, `nav.groupJournal`, `nav.groupAnalysis`) : ce sont
 * exactement les mêmes mots, et dix locales sur douze sont à 26 % de
 * couverture (`GO-LIVE.md` §2.10) — inventer des clés neuves aurait ajouté du
 * texte non traduit là où du texte traduit existait déjà.
 */

export interface NavItem {
  id: Page;
  labelKey: TKey;
  icon: typeof LayoutDashboard;
}

/** Libellé + icône de CHAQUE page. `Record<Page, …>` = exhaustif à la compilation. */
export const PAGE_META: Record<Page, { labelKey: TKey; icon: typeof LayoutDashboard }> = {
  dashboard: { labelKey: "nav.dashboard", icon: LayoutDashboard },
  inbox: { labelKey: "nav.inbox", icon: Bell },
  journal: { labelKey: "nav.journal", icon: BookOpen },
  checklist: { labelKey: "nav.checklist", icon: ClipboardCheck },
  calendar: { labelKey: "nav.calendar", icon: CalendarDays },
  analytics: { labelKey: "nav.analytics", icon: BarChart3 },
  mistakes: { labelKey: "nav.mistakes", icon: AlertTriangle },
  missed: { labelKey: "nav.missed", icon: Crosshair },
  insights: { labelKey: "nav.jarvis", icon: Bot },
  profile: { labelKey: "nav.profile", icon: User },
  news: { labelKey: "nav.news", icon: Newspaper },
  seasonality: { labelKey: "nav.seasonality", icon: CalendarRange },
  calculator: { labelKey: "nav.calculator", icon: Calculator },
  settings: { labelKey: "nav.settings", icon: SettingsIcon },
  reports: { labelKey: "nav.reports", icon: FileText },
  goals: { labelKey: "nav.goals", icon: Target },
  tradingplan: { labelKey: "nav.tradingPlan", icon: Map },
  appearance: { labelKey: "nav.appearance", icon: Palette },
  subscription: { labelKey: "nav.subscription", icon: CreditCard },
  // Monte-Carlo portait `BarChart3`, la MÊME icône que « Analyse » et que la
  // section entière : trois entrées identiques dans une rangée de quatre. Le
  // tirage aléatoire de trajectoires se lit mieux en brassage.
  montecarlo: { labelKey: "nav.montecarlo", icon: Shuffle },
};

/** Libellé + icône de chaque section. */
export const SECTION_META: Record<SectionId, { labelKey: TKey; icon: typeof LayoutDashboard }> = {
  dashboard: { labelKey: "nav.dashboard", icon: LayoutDashboard },
  preparation: { labelKey: "nav.groupPreparation", icon: ClipboardCheck },
  journal: { labelKey: "nav.groupJournal", icon: BookOpen },
  analysis: { labelKey: "nav.groupAnalysis", icon: BarChart3 },
  coach: { labelKey: "nav.jarvis", icon: Bot },
  strategy: { labelKey: "nav.groupStrategy", icon: Map },
  settings: { labelKey: "nav.settings", icon: SettingsIcon },
};

/** Un item de navigation complet pour une page. */
export function navItem(id: Page): NavItem {
  return { id, ...PAGE_META[id] };
}

/** La section qui contient cette page — `null` pour `inbox`, qui n'en a pas. */
export function sectionForPage(page: Page): SectionId | null {
  const found = SECTIONS.find((s) => (s.pages as readonly Page[]).includes(page));
  return found ? found.id : null;
}

/** Les pages d'une section, dans l'ordre d'affichage des onglets. */
export function pagesOfSection(id: SectionId): readonly Page[] {
  return SECTIONS.find((s) => s.id === id)!.pages;
}

/** La page d'accueil d'une section — `pages[0]`, jamais un second champ. */
export function defaultPageOfSection(id: SectionId): Page {
  return pagesOfSection(id)[0];
}

/**
 * Sections promues dans la barre du bas mobile (ordre = gauche→droite autour
 * du bouton d'ajout). Quatre + le bouton = cinq colonnes : Jarvis, Réglages et
 * l'inbox vivent dans l'en-tête mobile, à portée de pouce eux aussi.
 */
export const MOBILE_SECTIONS: SectionId[] = ["dashboard", "preparation", "journal", "analysis"];

/** Liste plate (ordre produit) — utilisée par la palette de commandes. */
export const NAV_ITEMS: NavItem[] = PAGES.map(navItem);
