import MarkdownAnswer from "../MarkdownAnswer";
import type { JarvisBlock } from "./blocks";

/**
 * BlockRenderer — LA SEULE façon d'afficher du contenu produit par Jarvis.
 *
 * Aucun composant ne rend directement une réponse IA : tout passe par un bloc.
 * Les blocs sont rendus ici (markdown aujourd'hui ; stats, card, chart, table,
 * recommendation, checklist, tool… s'ajouteront sans toucher aux consommateurs).
 */

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
