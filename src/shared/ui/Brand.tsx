import { cn } from "./cn";

/**
 * Le MOT de la marque — « TradeVault » écrit.
 *
 * Le sigle, lui, est resté l'image d'origine (`assets/tradevault-logo.webp`) :
 * c'est l'identité de la marque, elle ne se redessine pas à la faveur d'une
 * refonte. Seule la manière de composer le nom est ici.
 *
 * UN SEUL MOT, UNE SEULE GRAISSE. « Trade » en medium à 65 % et « Vault » en
 * 800 donnaient deux tailles apparentes au même nom, à côté d'un sigle qui,
 * lui, est d'un bloc. Le nom s'écrit maintenant d'un trait, en gras plein.
 */
export function BrandWord({ className }: { className?: string }) {
  return (
    <span className={cn("leading-none tracking-[-0.035em] whitespace-nowrap", className)}>
      <span className="font-bold">TradeVault</span>
    </span>
  );
}
