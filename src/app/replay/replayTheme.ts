/**
 * replayTheme — l'identité visuelle du MODE REJEU.
 *
 * Entrer dans Backtest change l'identité du produit : un thème dédié (ambre sur
 * noir chaud, P&L inchangé) marque immédiatement qu'on n'est plus dans le
 * journal réel. Sortir restaure le thème choisi par l'utilisateur. Aucune
 * persistance : ce changement est propre à la session de navigation.
 */

import type { ThemeDef } from "../utils/themes";
import { applyThemeVars, computeThemeVars } from "../utils/themes";

/** L'apparence du terminal de rejeu — chaude, terminale, distincte du journal. */
export const REPLAY_THEME: ThemeDef = {
  id: "replay",
  name: "Replay",
  primary: "#e8a33d",
  secondary: "#c77f2a",
  highlight: "#f3c46a",
  background: "#0c0a07",
  text: "#efe9dd",
};

/** Applique le thème du rejeu et le balise côté DOM. */
export function applyReplayTheme(): void {
  if (typeof document === "undefined") return;
  applyThemeVars(computeThemeVars(REPLAY_THEME));
  document.documentElement.dataset.mode = "replay";
}

/** Restaure le thème réel de l'utilisateur et retire le balisage. */
export function restoreUserTheme(theme: ThemeDef | null | undefined): void {
  if (typeof document === "undefined") return;
  if (theme) applyThemeVars(computeThemeVars(theme));
  delete document.documentElement.dataset.mode;
}
