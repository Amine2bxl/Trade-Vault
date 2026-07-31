import MarkdownAnswer from "../MarkdownAnswer";
import type {
  JarvisBlock,
  JarvisHeroBlock,
  JarvisInsightBlock,
  JarvisMissionBlock,
} from "./blocks";

/**
 * BlockRenderer — LA SEULE façon d'afficher du contenu produit par Jarvis.
 *
 * Aucun composant ne rend directement une réponse IA : tout passe par un bloc.
 * Les rendus `hero`, `insight`, `mission` (Phase 1, Étape 4) sont des
 * sous-composants purs et SANS TEXTE codé en dur : toutes les chaînes viennent
 * du bloc (déjà localisées par le Copy Layer / toBlocks).
 */

/* ── Hero : la voix de Jarvis (≤ 5 phrases structurées) ── */
function HeroView({ block }: { block: JarvisHeroBlock }) {
  return (
    <div className="space-y-2.5">
      {block.lines.map((line, i) => {
        switch (line.kind) {
          case "context":
            return (
              <p key={i} className="text-sm text-slate-300 leading-relaxed">
                {line.text}
              </p>
            );
          case "observation":
            return (
              <p key={i} className="text-sm text-white font-semibold leading-relaxed">
                {line.text}
              </p>
            );
          case "impact":
            return (
              <p key={i} className="text-sm text-red-300/90 font-medium leading-relaxed">
                {line.text}
              </p>
            );
          case "action":
            return (
              <div
                key={i}
                className="mt-1 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] px-3.5 py-2.5 text-sm text-cyan-100 font-medium leading-relaxed"
              >
                {line.text}
              </div>
            );
        }
      })}
    </div>
  );
}

/* ── Insight : la preuve chiffrée du pattern ── */
function InsightView({ block }: { block: JarvisInsightBlock }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400/80">
        {block.patternLabel}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {block.metrics.map((m, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <div className="text-[10px] text-slate-500 font-semibold truncate">{m.label}</div>
            <div
              className={
                "text-sm font-bold tabular-nums " +
                (m.tone === "up"
                  ? "text-emerald-400"
                  : m.tone === "down"
                    ? "text-red-400"
                    : "text-white")
              }
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
      {block.impact && (
        <p className="text-xs text-slate-300 font-semibold leading-relaxed">{block.impact}</p>
      )}
    </div>
  );
}

/* ── Mission : l'action du jour ── */
function MissionView({ block }: { block: JarvisMissionBlock }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3.5 space-y-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">
        {block.title}
      </div>
      <ul className="space-y-1.5">
        {block.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-200 leading-snug">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
      {block.cta && (
        <button
          type="button"
          className="w-full h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-bold mt-1"
        >
          {block.cta.label}
        </button>
      )}
    </div>
  );
}

function PendingBlock({ block }: { block: JarvisBlock }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-xs text-slate-500">
      {`[${block.type}]`} — bientôt disponible
    </div>
  );
}

export function BlockRenderer({ block }: { block: JarvisBlock }) {
  switch (block.type) {
    case "markdown":
      return <MarkdownAnswer content={block.content} />;
    case "hero":
      return <HeroView block={block} />;
    case "insight":
      return <InsightView block={block} />;
    case "mission":
      return <MissionView block={block} />;
    default:
      // Bloc structuré non encore rendu (stats, card, tool…) — affichage
      // gracieux, jamais de crash. Les rendus arrivent dans leurs phases.
      return <PendingBlock block={block} />;
  }
}

export function BlockList({ blocks }: { blocks: JarvisBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}
