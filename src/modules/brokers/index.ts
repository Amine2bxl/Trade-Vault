// Point d'entrée du module de synchronisation broker. Moteur PUR : aucune
// I/O, aucun React — le client HTTP vit dans `backend/tradovate.server.ts`.
// Ajouter un broker = un adaptateur pur à côté de `tradovate.ts`, son client
// serveur, et son identifiant dans `BrokerId`. Rien d'autre ne bouge.

export * from "./types";
export { buildRoundTrips, positionKey, type RoundTripOptions } from "./roundTrips";
export { roundTripToTrade, initialRisk, localDateTime, type TradeContext } from "./toTrade";
export * as tradovate from "./tradovate";

/** Les brokers proposés à la connexion, dans l'ordre d'affichage. */
export const BROKERS = [{ id: "tradovate", name: "Tradovate" }] as const;
