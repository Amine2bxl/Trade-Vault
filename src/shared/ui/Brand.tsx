import { cn } from "./cn";

/**
 * Le MOT de la marque — « TradeVault » écrit.
 *
 * Le sigle, lui, est resté l'image d'origine (`assets/tradevault-logo.webp`) :
 * c'est l'identité de la marque, elle ne se redessine pas à la faveur d'une
 * refonte. Seule la manière de composer le nom est ici.
 *
 * « Trade » en graisse moyenne et sourd, « Vault » en 800 et plein : le nom se
 * lit en deux temps au lieu d'un bloc uniforme, et c'est la moitié qui compte
 * — le coffre — qui reste dans l'œil.
 */
export function BrandWord({ className }: { className?: string }) {
  return (
    <span className={cn("leading-none tracking-[-0.035em] whitespace-nowrap", className)}>
      <span className="font-medium opacity-65">Trade</span>
      <span className="font-extrabold">Vault</span>
    </span>
  );
}
