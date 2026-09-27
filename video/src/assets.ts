/* LES CAPTURES — les vraies, celles de la landing. Pour en changer : remplacer
   le fichier, ou pointer l'import vers une capture 2x. Le cadrage de chaque
   plan est en fractions (0..1) de l'image dans `scenes.ts` : une nouvelle
   capture de même mise en page garde le même cadrage. */
import dashboard from "../../src/assets/product/dashboard.webp";
import journal from "../../src/assets/product/journal.webp";
import checklist from "../../src/assets/product/checklist.webp";
import mistakes from "../../src/assets/product/mistakes.webp";
import analytics from "../../src/assets/product/analytics.webp";
import montecarlo from "../../src/assets/product/montecarlo.webp";
import jarvis from "../../src/assets/product/jarvis.webp";
import logo from "../../src/assets/tradevault-logo.webp";

export const SHOTS = { dashboard, journal, checklist, mistakes, analytics, montecarlo, jarvis };
export type ShotId = keyof typeof SHOTS;
export { logo };
