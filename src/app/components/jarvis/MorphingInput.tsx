import { useState, useCallback } from "react";
import { Sparkles, TrendingUp, Brain, Send, ChevronsUpDown } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * MorphingInput — champ de discussion Jarvis avec placeholder animé.
 *
 * Le placeholder tourne entre plusieurs suggestions (une lettre à la fois,
 * effet de rotation/blur), l'icône de gauche cycle aussi. Pure CSS + lucide,
 * zéro dépendance — cohérent avec l'exigence de fluidité de TradeVault.
 */

interface PlaceholderOption {
  id: number;
  placeholder: string;
  icon: typeof Sparkles;
}

const OPTIONS: PlaceholderOption[] = [
  { id: 1, placeholder: "Ask about your performance…", icon: TrendingUp },
  { id: 2, placeholder: "Analyze my last trades…", icon: Brain },
  { id: 3, placeholder: "What's my biggest mistake?", icon: Sparkles },
];

export default function MorphingInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = OPTIONS[activeIndex];
  const Icon = current.icon;

  const cycle = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % OPTIONS.length);
  }, []);

  return (
    <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-1.5 py-1 transition-colors focus-within:border-cyan-500/40 focus-within:ring-1 focus-within:ring-cyan-500/20">
      {/* Icon cycle */}
      <button
        type="button"
        onClick={cycle}
        aria-label="Cycle suggestion"
        className="shrink-0 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center gap-1 transition-colors"
      >
        <span key={current.id} className="morph-icon">
          <Icon className="w-4 h-4 text-cyan-400" />
        </span>
        <ChevronsUpDown className="w-3 h-3 text-slate-500" />
      </button>

      {/* Input + animated placeholder */}
      <div className="flex-1 min-w-0 relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          disabled={disabled}
          className="w-full bg-transparent border-0 outline-none px-1.5 py-2 text-sm text-white placeholder-transparent focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
        />
        {!value && !disabled && (
          <div className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap">
            <span key={current.id} className="morph-placeholder text-sm text-slate-500">
              {current.placeholder.split("").map((letter, i) => (
                <span
                  key={i}
                  className="morph-letter inline-block"
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Send */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="shrink-0 p-2 rounded-xl tv-accent-fill disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <Send className="w-4 h-4" />
      </button>

      <style>{`
        @keyframes morphLetterIn {
          from { opacity: 0; transform: translateY(8px) rotateX(80deg); filter: blur(3px); }
          to   { opacity: 1; transform: translateY(0) rotateX(0deg); filter: blur(0); }
        }
        .morph-letter {
          animation: morphLetterIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes morphIconIn {
          from { opacity: 0; filter: blur(4px); }
          to   { opacity: 1; filter: blur(0); }
        }
        .morph-icon {
          display: inline-flex;
          animation: morphIconIn 0.3s ease both;
        }
      `}</style>
    </div>
  );
}
