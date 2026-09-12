/**
 * Replay — le terminal historique. Point d'entrée du module.
 *
 * Réunit le moteur (horloge canonique), la simulation d'exécution (ordres,
 * brackets, positions, P&L) et la persistance de session. Aucun de ces fichiers
 * ne dépend de React ni de Supabase : ils sont testés en isolation et réutilisés
 * par l'interface du terminal.
 */

export * from "./types";
export * from "./timeframes";
export * from "./instruments";
export * from "./calendar";
export * from "./synthetic-data";
export * from "./market-data";
export * from "./engine";
export * from "./orders";
export * from "./session";
