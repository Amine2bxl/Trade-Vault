import { cn } from "./cn";

/**
 * LE LISERÉ QUI SE TRACE — le geste de l'onboarding, partout où l'on choisit.
 *
 * Dans l'onboarding, chaque réponse retenue se fait entourer d'un trait menthe
 * qui se dessine (`onb-lock-sweep`). Le propriétaire a demandé que ce geste
 * revienne dans tout TradeVault, en clin d'œil (2026-11-15) : le même trait
 * entoure maintenant un choix dans l'app (la formule de la carte d'achat…),
 * plus vif — 280 ms, la loi du mouvement de l'app — et la cinématique de
 * l'onboarding garde son rythme long (`pace="onboarding"`).
 *
 * Monté avec le choix (`{actif && <TraceRing />}`), il rejoue à chaque
 * nouvelle sélection. Sous `prefers-reduced-motion`, le trait est posé
 * d'emblée, sans tracé. Décoratif : `aria-hidden`.
 */
export function TraceRing({
  radius = 16,
  pace = "app",
  className,
}: {
  radius?: number;
  pace?: "app" | "onboarding";
  className?: string;
}) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
        className,
      )}
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        fill="none"
        stroke="var(--tv-accent)"
        strokeWidth="1.5"
        pathLength={1}
        className={pace === "onboarding" ? "onb-lock-sweep" : "tv-trace"}
      />
    </svg>
  );
}
