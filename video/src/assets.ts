/* LES CAPTURES — les vraies, celles de la landing. Pour en changer : remplacer
   le fichier, ou pointer l'import vers une capture 2x. Le cadrage de chaque
   plan est en fractions (0..1) de l'image dans `scenes.ts` : une nouvelle
   capture de même mise en page garde le même cadrage.
   `montecarlo` a quitté `src/assets/product/` (la vitrine ne la montait
   plus) : son plan est devenu celui du calendrier. */
import dashboard from "../../src/assets/product/dashboard.webp";
import journal from "../../src/assets/product/journal.webp";
import checklist from "../../src/assets/product/checklist.webp";
import mistakes from "../../src/assets/product/mistakes.webp";
import analytics from "../../src/assets/product/analytics.webp";
import calendar from "../../src/assets/product/calendar.webp";
import jarvis from "../../src/assets/product/jarvis.webp";
import logo from "../../src/assets/tradevault-logo.webp";

export const SHOTS = { dashboard, journal, checklist, mistakes, analytics, calendar, jarvis };
export type ShotId = keyof typeof SHOTS;
export { logo };

/* Les variantes TÉLÉPHONE (`<nom>-m`, 390 px de large en 2x = 780×1800) : le
   format vertical (TikTok, Reels, Shorts) les pose dans un téléphone. */
import dashboardM from "../../src/assets/product/dashboard-m.webp";
import journalM from "../../src/assets/product/journal-m.webp";
import checklistM from "../../src/assets/product/checklist-m.webp";
import mistakesM from "../../src/assets/product/mistakes-m.webp";
import analyticsM from "../../src/assets/product/analytics-m.webp";
import calendarM from "../../src/assets/product/calendar-m.webp";
import jarvisM from "../../src/assets/product/jarvis-m.webp";

export const SHOTS_M: Record<ShotId, string> = {
  dashboard: dashboardM,
  journal: journalM,
  checklist: checklistM,
  mistakes: mistakesM,
  analytics: analyticsM,
  calendar: calendarM,
  jarvis: jarvisM,
};
