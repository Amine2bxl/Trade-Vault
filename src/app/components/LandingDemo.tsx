import { useEffect, useState, type ReactNode } from "react";
import { Bot, X, ArrowRight, ArrowLeft, Play, CheckCircle2 } from "lucide-react";
import { cn } from "../utils/cn";
import logoSrc from "@/assets/tradevault-logo.webp";

/**
 * LandingDemo — la démo « voir l'app en action ».
 *
 * Deux modes, un seul composant, ZÉRO personnalisation (aucune donnée user) :
 *   - mode "video"  : lecture automatique qui boucle comme un GIF, chaque
 *                     écran un mockup animé d'une feature.
 *   - mode "guide"  : tour guidé — l'utilisateur avance écran par écran avec
 *                     « Suivant », dans l'ordre des features, et ne peut rien
 *                     modifier.
 * Entièrement local : mockups statiques animés, aucune dépendance externe.
 */

type Mode = "video" | "guide";

interface Slide {
  id: string;
  title: string;
  desc: string;
  /** Clé de ton d'accroche court en haut du mockup. */
  tagline: string;
  body: ReactNode;
}

const SLIDES: Slide[] = [
  {
    id: "dashboard",
    title: "Ton tableau de bord",
    desc: "Toute ta session en un coup d'œil : P&L, win rate, objectif mensuel.",
    tagline: "Ta journée en direct",
    body: <DashboardMock />,
  },
  {
    id: "journal",
    title: "Journalise chaque trade",
    desc: "Setup, R-multiple, erreurs — chaque trade est enregistré en 45 secondes.",
    tagline: "Chaque trade compte",
    body: <JournalMock />,
  },
  {
    id: "analytics",
    title: "Des stats qui parlent",
    desc: "Analytics quantitatives : edge par setup, jours de la semaine, drawdown.",
    tagline: "Tes patterns, noir sur blanc",
    body: <AnalyticsMock />,
  },
  {
    id: "jarvis",
    title: "Ton coach IA 24h/24",
    desc: "Jarvis analyse ton historique, nomme tes erreurs et te donne un plan.",
    tagline: "Ton coach personnel",
    body: <JarvisMock />,
  },
  {
    id: "checklist",
    title: "Ta discipline pré-market",
    desc: "Checklist quotidienne pour ne plus jamais trader à l'impulsion.",
    tagline: "La discipline d'abord",
    body: <ChecklistMock />,
  },
];

export function LandingDemo({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(mode === "video");
  const total = SLIDES.length;
  const slide = SLIDES[idx];

  // Auto-play (mode vidéo) : avance toutes les ~4s, boucle indéfiniment.
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setIdx((i) => (i + 1) % total), idx === 0 ? 500 : 4200);
    return () => window.clearTimeout(id);
  }, [playing, idx, total]);

  const next = () => setIdx((i) => Math.min(i + 1, total - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (mode === "guide") {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, idx]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop flouté */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute -top-28 right-0 w-[420px] h-[420px] rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />

      {/* Panneau */}
      <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0a0f1e] shadow-[0_30px_80px_rgba(0,0,0,0.6)] animate-slide-in flex flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="relative">
              <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
              <img
                src={logoSrc}
                alt="TradeVault"
                width={28}
                height={28}
                className="relative w-7 h-7 rounded-lg"
              />
            </span>
            <div className="leading-none">
              <div className="text-sm font-bold text-white tracking-tight">TradeVault</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {mode === "video" ? "Démo · vue d'ensemble" : "Découverte guidée"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "video" && (
              <button
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? "Pause" : "Lecture"}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                {playing ? (
                  <span className="w-3 h-3.5 rounded-[2px] bg-current" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progression (mode vidéo = barre auto) */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {SLIDES.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              {i === idx && playing && (
                <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 animate-[demoProgress_4.2s_linear_forwards]" />
              )}
              {i === idx && !playing && <div className="h-full bg-cyan-500/70" />}
              {i < idx && <div className="h-full bg-cyan-500/40" />}
            </div>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
          <div key={slide.id} className="animate-fade-in-up">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400/80 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              {slide.tagline}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {slide.title}
            </h2>
            <p className="text-[13px] text-slate-400 leading-relaxed mt-1.5 mb-5">{slide.desc}</p>
            {slide.body}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.06]">
          <div className="text-[11px] text-slate-600 tabular-nums">
            {idx + 1} / {total}
          </div>
          {mode === "guide" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                disabled={idx === 0}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-40 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={idx === total - 1 ? onClose : next}
                className="h-10 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:brightness-110 shadow-lg shadow-cyan-500/20 transition-all inline-flex items-center gap-1.5"
              >
                {idx === total - 1 ? "Terminer" : "Suivant"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:brightness-110 shadow-lg shadow-cyan-500/20 transition-all"
            >
              Essayer TradeVault
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ Mockups animés (aucune donnée réelle) ═══════════ */

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className={cn("font-display text-base font-extrabold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="P&L du jour" value="+$1,240" color="text-emerald-400" />
        <StatCard label="Win rate" value="64%" color="text-cyan-300" />
        <StatCard label="Trades" value="12" color="text-white" />
      </div>
      {/* Sparkline */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-end justify-between gap-1 h-20">
          {[35, 48, 30, 55, 42, 62, 50, 72, 58, 80, 66, 92].map((h, i) => (
            <div
              key={i}
              className="w-full rounded-t bg-gradient-to-t from-cyan-600/40 to-teal-400/80"
              style={{ height: `${h}%`, animation: `demoBar 0.6s ${i * 0.05}s both` }}
            />
          ))}
        </div>
      </div>
      {/* Objectif mensuel */}
      <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.05] p-3.5">
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="text-slate-400">Objectif mensuel</span>
          <span className="text-cyan-300 font-bold">+6.2% / +8%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-cyan-500 to-teal-400" />
        </div>
      </div>
    </div>
  );
}

function JournalMock() {
  const rows = [
    { s: "FVG + Retest", r: "+2.4R", p: "+$480", win: true },
    { s: "Breakout NY", r: "+1.1R", p: "+$220", win: true },
    { s: "Revenge entry", r: "−1.8R", p: "−$360", win: false },
    { s: "Liquidity sweep", r: "+3.0R", p: "+$600", win: true },
  ];
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.04] last:border-0 bg-white/[0.02] animate-[demoBar_0.4s_linear_both]"
          style={{ animationDelay: `${i * 0.12}s` }}
        >
          <div>
            <div className="text-xs font-semibold text-white">{r.s}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Setup · {r.win ? "bien exécuté" : "erreur notée"}
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "text-xs font-bold tabular-nums",
                r.win ? "text-emerald-400" : "text-red-400",
              )}
            >
              {r.r}
            </div>
            <div
              className={cn(
                "text-[10px] tabular-nums",
                r.win ? "text-emerald-300/80" : "text-red-300/80",
              )}
            >
              {r.p}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsMock() {
  const days = [
    { d: "L", v: 58, w: true },
    { d: "M", v: 34, w: false },
    { d: "M", v: 72, w: true },
    { d: "J", v: 46, w: false },
    { d: "V", v: 88, w: true },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-3">
          Edge par jour de la semaine
        </div>
        <div className="flex items-end justify-between gap-2 h-20">
          {days.map((x, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  "w-full rounded-t",
                  x.w
                    ? "bg-gradient-to-t from-emerald-600/40 to-emerald-400/80"
                    : "bg-gradient-to-t from-red-600/40 to-red-400/80",
                )}
                style={{ height: `${x.v}%`, animation: `demoBar 0.6s ${i * 0.08}s both` }}
              />
              <span className="text-[9px] text-slate-500">{x.d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Profit factor" value="1.84" color="text-emerald-400" />
        <StatCard label="R-multiple moyen" value="+1.6R" color="text-cyan-300" />
      </div>
    </div>
  );
}

function JarvisMock() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-end gap-2 justify-start">
        <div className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 text-[12px] text-slate-200 leading-relaxed">
          <b className="text-white">Série de pertes</b> : 3 pertes consécutives après une victoire.
          Ton risque après perte augmente de 42 % — c'est le pattern qui te coûte le plus.
        </div>
      </div>
      <div className="flex items-end gap-2 justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-md bg-gradient-to-r from-cyan-500 to-teal-500 px-3.5 py-2.5 text-[12px] text-white font-medium">
          Comment je stoppe ça demain ?
        </div>
      </div>
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] px-3.5 py-3">
        <div className="text-[9px] uppercase tracking-wider text-cyan-400/80 font-bold mb-1">
          Mission du jour
        </div>
        <div className="text-[12px] text-slate-200 leading-relaxed">
          Max 2 trades · taille fixe · stop après 1 perte. À revérifier ce soir.
        </div>
      </div>
    </div>
  );
}

function ChecklistMock() {
  const items = [
    { t: "Vérifier le biais de marché", on: true },
    { t: "Setup validé + stop écrit", on: true },
    { t: "Risque fixé (1%)", on: true },
    { t: "Mental : aucune impulsion", on: false },
  ];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-3.5 py-3 animate-[demoBar_0.4s_linear_both]"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <span
            className={cn(
              "grid h-5 w-5 place-items-center rounded-md border shrink-0",
              it.on
                ? "bg-gradient-to-br from-cyan-500 to-teal-500 border-transparent"
                : "border-white/15",
            )}
          >
            {it.on && <CheckCircle2 className="w-3 h-3 text-white" />}
          </span>
          <span className={cn("text-xs", it.on ? "text-white font-medium" : "text-slate-500")}>
            {it.t}
          </span>
        </div>
      ))}
    </div>
  );
}
