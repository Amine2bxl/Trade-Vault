import { useState } from "react";
import { Check, Plus, Loader2 } from "lucide-react";
import MarkdownAnswer from "../MarkdownAnswer";
import type {
  JarvisBlock,
  JarvisHeroBlock,
  JarvisInsightBlock,
  JarvisMissionBlock,
  JarvisToolBlock,
} from "./blocks";

/**
 * Handler d'action Jarvis → TradeVault. Optionnel : sans lui, un ToolBlock est
 * rendu désactivé (la Home l'affiche sans câbler d'action). La Conversation le
 * fournit pour exécuter « Ajouter cette règle à ma checklist ».
 */
export type BlockToolHandler = (block: JarvisToolBlock) => void | Promise<void>;

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
function MissionView({ block, onTool }: { block: JarvisMissionBlock; onTool?: BlockToolHandler }) {
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
      {/* Le CTA d'une mission est une VRAIE action : il passe par le même
          handler que les ToolBlock, donc par la même exécution auditée. Sans
          handler fourni, on ne rend pas un bouton mort. */}
      {block.cta && onTool && (
        <ToolView
          block={{
            type: "tool",
            tool: block.cta.tool ?? "createChecklist",
            label: block.cta.label,
            payload: block.cta.payload,
            targetPage: block.cta.targetPage,
          }}
          onTool={onTool}
        />
      )}
    </div>
  );
}

/** Libellé « fait » : fourni par le bloc (`payload.doneLabel`) ou un check. */
function doneLabelOf(block: JarvisToolBlock): string {
  const d = block.payload?.doneLabel;
  return typeof d === "string" ? d : "✓";
}

/* ── Tool : une action exécutable (ex. « Ajouter cette règle à ma checklist ») ── */
function ToolView({ block, onTool }: { block: JarvisToolBlock; onTool?: BlockToolHandler }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const disabled = !onTool || state !== "idle";

  const run = async () => {
    if (!onTool || state !== "idle") return;
    setState("running");
    try {
      await onTool(block);
      setState("done");
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled}
      aria-label={block.label}
      className={
        "w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all " +
        (state === "done"
          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
          : "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-60 active:scale-[0.99]")
      }
    >
      {state === "running" ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : state === "done" ? (
        <Check className="w-4 h-4" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      {state === "done" ? doneLabelOf(block) : block.label}
    </button>
  );
}

/* ── Alert : un signal court et net ── */
function AlertView({ block }: { block: Extract<JarvisBlock, { type: "alert" }> }) {
  const tone =
    block.level === "danger"
      ? "border-red-500/25 bg-red-500/[0.07] text-red-200"
      : block.level === "warning"
        ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-200"
        : block.level === "success"
          ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200"
          : "border-cyan-500/25 bg-cyan-500/[0.07] text-cyan-100";
  return (
    <div className={"rounded-xl border px-3.5 py-2.5 text-sm font-medium " + tone}>
      {block.message}
    </div>
  );
}

/* ── Stats : une rangée de métriques ── */
function StatsView({ block }: { block: Extract<JarvisBlock, { type: "stats" }> }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-3">
      {block.title && (
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400/80">
          {block.title}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {block.metrics.map((m, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <div className="text-[10px] text-slate-500 font-semibold truncate">{m.label}</div>
            <div
              className={
                "text-sm font-bold tabular-nums " +
                (m.trend === "up"
                  ? "text-emerald-400"
                  : m.trend === "down"
                    ? "text-red-400"
                    : "text-white")
              }
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Card : un encart titré ── */
function CardView({ block }: { block: Extract<JarvisBlock, { type: "card" }> }) {
  const tone =
    block.tone === "danger"
      ? "border-red-500/20"
      : block.tone === "warning"
        ? "border-amber-500/20"
        : block.tone === "success"
          ? "border-emerald-500/20"
          : block.tone === "accent"
            ? "border-cyan-500/25"
            : "border-white/[0.08]";
  return (
    <div className={"rounded-2xl border bg-white/[0.02] p-3.5 space-y-1 " + tone}>
      <div className="text-sm font-bold text-white">{block.title}</div>
      <p className="text-sm text-slate-300 leading-relaxed">{block.body}</p>
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

export function BlockRenderer({
  block,
  onTool,
}: {
  block: JarvisBlock;
  onTool?: BlockToolHandler;
}) {
  switch (block.type) {
    case "markdown":
      return <MarkdownAnswer content={block.content} />;
    case "hero":
      return <HeroView block={block} />;
    case "insight":
      return <InsightView block={block} />;
    case "mission":
      return <MissionView block={block} onTool={onTool} />;
    case "tool":
      return <ToolView block={block} onTool={onTool} />;
    case "alert":
      return <AlertView block={block} />;
    case "stats":
      return <StatsView block={block} />;
    case "card":
      return <CardView block={block} />;
    default:
      // Bloc structuré non encore rendu (stats, card, tool…) — affichage
      // gracieux, jamais de crash. Les rendus arrivent dans leurs phases.
      return <PendingBlock block={block} />;
  }
}

export function BlockList({
  blocks,
  onTool,
}: {
  blocks: JarvisBlock[];
  onTool?: BlockToolHandler;
}) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} onTool={onTool} />
      ))}
    </div>
  );
}
