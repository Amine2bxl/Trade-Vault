/**
 * Chargement différé des pages — et PRÉCHARGEMENT à l'intention.
 *
 * POURQUOI CE MODULE. Chaque page est un chunk séparé (recharts et
 * react-markdown pèsent lourd, les charger toutes au démarrage retarderait le
 * tableau de bord). Mais un chunk chargé au moment du clic, c'est un aller-
 * retour réseau pendant lequel l'utilisateur regarde un squelette : la
 * navigation paraît lente alors que l'application ne fait qu'attendre un
 * fichier.
 *
 * La solution n'est pas de retirer le squelette, c'est de faire en sorte
 * qu'il n'ait plus lieu d'être : on démarre le téléchargement dès que
 * l'intention est visible — survol à la souris, focus au clavier, premier
 * contact du doigt — soit typiquement 100 à 300 ms avant le clic. Au clic, le
 * module est déjà là et le rendu est immédiat.
 *
 * Chaque chemin de module n'est écrit QU'UNE FOIS ici : les composants
 * différés et la table de préchargement sortent des mêmes fonctions. Ajouter
 * une page ailleurs sans la précharger est donc impossible par construction.
 */

import { lazyPage } from "@/shared/lazy-page";
import type { Page } from "./types";

// Un import dynamique par page. Le registre de modules ESM déduplique : appeler
// deux fois le même loader ne télécharge qu'une fois.
const loadJournal = () => import("./pages/Journal");
const loadChecklist = () => import("./features/checklist/Checklist");
const loadCalendar = () => import("./features/calendar/CalendarPage");
const loadAnalytics = () => import("./pages/Analytics");
const loadMistakes = () => import("./features/mistakes/Mistakes");
const loadJarvis = () => import("./pages/Jarvis");
const loadProfile = () => import("./pages/Profile");
const loadMissed = () => import("./features/missed/MissedOpportunities");
const loadNews = () => import("./features/news/EconomicNews");
const loadSeasonality = () => import("./features/seasonality/Seasonality");
const loadCalculator = () => import("./pages/LotSizeCalculator");
const loadSettings = () => import("./pages/Settings");
const loadReports = () => import("./features/reports/Reports");
const loadGoals = () => import("./features/goals/Goals");
const loadTradingPlan = () => import("./pages/TradingPlan");
const loadAppearance = () => import("./pages/Appearance");
const loadSubscription = () => import("./pages/Subscription");
const loadInbox = () => import("./pages/Inbox");
const loadMonteCarlo = () => import("./features/monte-carlo/MonteCarlo");

export const Journal = lazyPage(loadJournal);
export const Checklist = lazyPage(loadChecklist);
export const CalendarPage = lazyPage(loadCalendar);
export const Analytics = lazyPage(loadAnalytics);
export const Mistakes = lazyPage(loadMistakes);
export const Jarvis = lazyPage(loadJarvis);
export const Profile = lazyPage(loadProfile);
export const MissedOpportunities = lazyPage(loadMissed);
export const EconomicNews = lazyPage(loadNews);
export const Seasonality = lazyPage(loadSeasonality);
export const LotSizeCalculator = lazyPage(loadCalculator);
export const Settings = lazyPage(loadSettings);
export const Reports = lazyPage(loadReports);
export const Goals = lazyPage(loadGoals);
export const TradingPlan = lazyPage(loadTradingPlan);
export const Appearance = lazyPage(loadAppearance);
export const Subscription = lazyPage(loadSubscription);
export const Inbox = lazyPage(loadInbox);
export const MonteCarlo = lazyPage(loadMonteCarlo);

/** `dashboard` est absent : il vit dans le chunk principal, jamais différé. */
const LOADERS: Partial<Record<Page, () => Promise<unknown>>> = {
  journal: loadJournal,
  checklist: loadChecklist,
  calendar: loadCalendar,
  analytics: loadAnalytics,
  mistakes: loadMistakes,
  insights: loadJarvis,
  profile: loadProfile,
  missed: loadMissed,
  news: loadNews,
  seasonality: loadSeasonality,
  calculator: loadCalculator,
  settings: loadSettings,
  reports: loadReports,
  goals: loadGoals,
  tradingplan: loadTradingPlan,
  appearance: loadAppearance,
  subscription: loadSubscription,
  inbox: loadInbox,
  montecarlo: loadMonteCarlo,
};

const started = new Set<Page>();

/**
 * Démarre le téléchargement du chunk d'une page, au plus une fois.
 *
 * Sans effet de bord visible et volontairement silencieux : un préchargement
 * qui échoue (hors ligne, chunk périmé après déploiement) ne doit surtout pas
 * remonter d'erreur — le chargement normal au clic réessaiera et affichera,
 * lui, un vrai message.
 */
export function preloadPage(page: Page): void {
  if (started.has(page)) return;
  const loader = LOADERS[page];
  if (!loader) return;
  started.add(page);
  void loader().catch(() => started.delete(page));
}

/**
 * Pages préchargées après le premier rendu, quand le navigateur est libre.
 *
 * Les destinations les plus fréquentes depuis le tableau de bord. On ne
 * précharge PAS tout : cela remettrait au démarrage le coût qu'on vient d'en
 * retirer. Les autres pages restent couvertes par le préchargement au survol.
 */
export const LIKELY_NEXT_PAGES: Page[] = ["journal", "analytics", "inbox", "mistakes", "calendar"];
