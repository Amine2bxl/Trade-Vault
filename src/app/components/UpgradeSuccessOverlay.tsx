import { useMemo } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";

/**
 * Confirmation d'abonnement — une arrivée digne d'un trade gagné.
 *
 * Affiché à l'ARRIVÉE sur le dashboard après un checkout Stripe ou l'octroi
 * d'un code 100 % (`/?billing=success`). Deux couches : une pluie de
 * confettis (DOM, 100% transform/opacity — le GPU, zéro canvas) et une carte
 * « Pro activé » qui se pose au centre. L'URL est nettoyée après coup pour ne
 * rejouer qu'une fois.
 */

const CONFETTI_COLORS = ["#22d3ee", "#2dd4bf", "#f59e0b", "#a78bfa", "#f472b6", "#34d399"];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  round: boolean;
  rotate: number;
}

export default function UpgradeSuccessOverlay({
  onClose,
  onExplore,
}: {
  onClose: () => void;
  onExplore: () => void;
}) {
  const { lang } = useT();
  const fr = lang === "fr";

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        left: (i * 61) % 100,
        delay: (i % 12) * 0.12,
        duration: 2.8 + ((i * 7) % 20) / 10,
        size: 6 + ((i * 13) % 8),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
        rotate: (i * 47) % 360,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-[var(--tv-z-overlay)] flex items-center justify-center p-4">
      {/* Pluie de confettis — pointer-events none, ne gêne jamais le geste. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * (p.round ? 1 : 0.45),
              background: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--tw-rotate" as string]: `${p.rotate}deg`,
            }}
          />
        ))}
      </div>

      {/* Carte de confirmation. */}
      <div className="relative w-full max-w-sm rounded-3xl border border-white/[0.12] bg-[#08111e]/95 p-6 text-center shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)] backdrop-blur-xl animate-scale-in">
        <button
          onClick={onClose}
          aria-label={fr ? "Fermer" : "Close"}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_0_40px_-8px_rgba(16,185,129,.7)]">
          <CheckCircle2 className="h-8 w-8 text-[#04101a]" strokeWidth={2.5} />
        </span>

        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white">
          {fr ? "Bienvenue dans Pro" : "Welcome to Pro"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-[260px] text-[13px] leading-snug text-slate-400">
          {fr
            ? "Toutes les analyses sont débloquées : tes erreurs chiffrées, Monte-Carlo, la saisonnalité."
            : "Everything is unlocked: your mistakes priced, Monte Carlo, seasonality."}
        </p>

        <button
          onClick={onExplore}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-3 text-[15px] font-bold text-[#04101a] shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
        >
          <Sparkles className="h-4 w-4" />
          {fr ? "Voir mes analyses" : "See my analytics"}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl px-4 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-300 transition"
        >
          {fr ? "Explorer l'app" : "Browse the app"}
        </button>
      </div>
    </div>
  );
}
