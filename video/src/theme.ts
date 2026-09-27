import { Easing } from "remotion";
import { loadFont } from "@remotion/fonts";
import inter500 from "@fontsource/inter/files/inter-latin-500-normal.woff2";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2";
import inter800 from "@fontsource/inter/files/inter-latin-800-normal.woff2";
import mono500 from "@fontsource/roboto-mono/files/roboto-mono-latin-500-normal.woff2";

/* Les jetons de la LANDING, recopiés de `.landing-root` (src/styles.css) et
   de `landing.css` : la pub doit être la vitrine en mouvement, pas une
   cousine. Changer une couleur de la LP → la changer ici aussi. */
export const C = {
  bg: "#07080a",
  plate: "#131416",
  text: "#f4f5f6",
  muted: "#94a3b8",
  accent: "#22e08a",
  accent2: "#12b981",
  highlight: "#5bf0ab",
  red: "#f87171",
};
/** Composantes RGB pour les `rgb(… / alpha)`. */
export const RGB = {
  accent: "34 224 138",
  green: "52 211 153",
  indigo: "86 96 210",
  red: "248 113 113",
};

/* Inter et Roboto Mono, comme la LP — mais EMBARQUÉES, pas chargées depuis
   Google Fonts : le rendu ne dépend d'aucun réseau et sort identique partout. */
Object.entries({ 500: inter500, 600: inter600, 700: inter700, 800: inter800 }).forEach(
  ([weight, url]) => loadFont({ family: "Inter", url, weight }),
);
loadFont({ family: "Roboto Mono", url: mono500, weight: "500" });
export const FONT = "Inter, sans-serif";
export const MONO = "'Roboto Mono', monospace";

/* Les courbes. `expo` est `--lp-expo`, la courbe de toute la vitrine. */
export const EASE = {
  expo: Easing.bezier(0.19, 1, 0.22, 1),
  expoIn: Easing.bezier(0.95, 0.05, 0.795, 0.035),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  back: Easing.out(Easing.back(1.7)),
  bounce: Easing.bounce,
  linear: Easing.linear,
};
export type EaseName = keyof typeof EASE;
