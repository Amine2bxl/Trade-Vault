import { cn } from "@/shared/ui";
import { symbolLogoFor, type LogoKey } from "./symbolCatalog";

/**
 * LE LOGO D'UN INSTRUMENT — Nasdaq pour NQ/MNQ, drapeaux croisés pour une
 * paire, pièce orange pour le bitcoin. La table vit dans `symbolCatalog.ts` ;
 * les images dans `src/assets/symbols/` (origines et licences : son README).
 *
 * Un symbole inconnu affiche ses initiales sur une plaque sourde : mieux vaut
 * aucun logo qu'un logo approchant.
 */
const FILES = import.meta.glob<string>("@/assets/symbols/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const URLS: Partial<Record<LogoKey, string>> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4), url]),
);

const SIZE = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[10px]",
  lg: "h-10 w-10 text-xs",
} as const;

export function SymbolLogo({
  symbol,
  size = "md",
  className,
}: {
  symbol: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const logo = symbolLogoFor(symbol);
  const box = cn("relative inline-block shrink-0", SIZE[size], className);

  if (logo?.kind === "single" && URLS[logo.key]) {
    return (
      <span aria-hidden className={box}>
        <img src={URLS[logo.key]} alt="" draggable={false} className="h-full w-full rounded-full" />
      </span>
    );
  }
  if (logo?.kind === "pair" && URLS[logo.keys[0]] && URLS[logo.keys[1]]) {
    // Devise de base devant, en haut à gauche ; cotée derrière, en bas à droite.
    return (
      <span aria-hidden className={box}>
        <img
          src={URLS[logo.keys[1]]}
          alt=""
          draggable={false}
          className="absolute bottom-0 right-0 h-[68%] w-[68%] rounded-full"
        />
        <img
          src={URLS[logo.keys[0]]}
          alt=""
          draggable={false}
          className="absolute ring-2 ring-[var(--tv-plate-1)] left-0 top-0 h-[68%] w-[68%] rounded-full"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "inline-flex items-center justify-center rounded-full border border-[var(--tv-border)] bg-[var(--tv-plate-2)] font-bold text-slate-300",
      )}
    >
      {symbol.trim().toUpperCase().slice(0, 3)}
    </span>
  );
}
