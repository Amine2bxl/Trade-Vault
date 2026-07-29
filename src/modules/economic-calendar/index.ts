// Point d'entrée du module. Changer de fournisseur de données = changer la
// ligne `activeProvider` ci-dessous, rien d'autre dans l'application ne bouge.

export * from "./types";
export { parseForexFactoryFeed, forexFactoryProvider, FOREX_FACTORY_SOURCE } from "./forex-factory";

import { forexFactoryProvider } from "./forex-factory";
import type { CalendarProvider } from "./types";

export const activeProvider: CalendarProvider = forexFactoryProvider;
