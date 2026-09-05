import type { Lang } from "./translations";

/**
 * LA LOCALE D'AFFICHAGE — une seule définition.
 *
 * La même table `Lang → BCP-47` était recopiée dans sept fichiers (calendrier,
 * analytics, rapports, détail de trade, actualités…). Sept copies d'un même
 * fait, c'est six occasions de diverger : il a suffi qu'une seule oublie une
 * langue pour que la moitié du produit date en anglais et l'autre non.
 *
 * `Intl` sait se rabattre tout seul sur une locale voisine ; ce que la table
 * apporte, c'est le PAYS — « pt-PT » et non « pt-BR », « en-US » et non
 * « en-GB » —, qui décide de l'ordre jour/mois et du premier jour de semaine.
 */
const TABLE: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-PT",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
  ar: "ar-SA",
  hi: "hi-IN",
};

export function intlLocale(lang: Lang | string | undefined): string {
  return (lang && TABLE[lang]) || "en-US";
}
