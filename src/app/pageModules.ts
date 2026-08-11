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

import { lazy } from "react";
import type { Page } from "./types";

// Un import dynamique par page. Le registre de modules ESM déduplique : appeler
// deux fois le même loader ne télécharge qu'une fois.
const loadJournal = () => import("./pages/Journal");
const loadChecklist = () => import("./pages/Checklist");
const loadCalendar = () => import("./pages/CalendarPage");
const loadAnalytics = () => import("./pages/Analytics");
const loadMistakes = () => import("./pages/Mistakes");
const loadJarvis = () => import("./pages/Jarvis");
const loadProfile = () => import("./pages/Profile");
const loadMissed = () => import("./pages/MissedOpportunities");
const loadNews = () => import("./pages/EconomicNews");
const loadSeasonality = () => import("./pages/Seasonality");
const loadCalculator = () => import("./pages/LotSizeCalculator");
const loadSettings = () => import("./pages/Settings");
const loadReports = () => import("./pages/Reports");
const loadGoals = () => import("./pages/Goals");
const loadSimulator = () => import("./pages/Simulator");
const loadTradingPlan = () => import("./pages/TradingPlan");
const loadAppearance = () => import("./pages/Appearance");
const loadSubscription = () => import("./pages/Subscription");
const loadInbox = () => import("./pages/Inbox");
const loadMonteCarlo = () => import("./pages/MonteCarlo");

export const Journal = lazy(loadJournal);
export const Checklist = lazy(loadChecklist);
export const CalendarPage = lazy(loadCalendar);
export const Analytics = lazy(loadAnalytics);
export const Mistakes = lazy(loadMistakes);
export const Jarvis = lazy(loadJarvis);
export const Profile = lazy(loadProfile);
export const MissedOpportunities = lazy(loadMissed);
export const EconomicNews = lazy(loadNews);
export const Seasonality = lazy(loadSeasonality);
export const LotSizeCalculator = lazy(loadCalculator);
export const Settings = lazy(loadSettings);
export const Reports = lazy(loadReports);
export const Goals = lazy(loadGoals);
export const Simulator = lazy(loadSimulator);
export const TradingPlan = lazy(loadTradingPlan);
export const Appearance = lazy(loadAppearance);
export const Subscription = lazy(loadSubscription);
export const Inbox = lazy(loadInbox);
export const MonteCarlo = lazy(loadMonteCarlo);

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
  simulator: loadSimulator,
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
