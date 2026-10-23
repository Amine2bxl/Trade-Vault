import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { domToRichText, parseRichText, richTextToHtml } from "../richText";
import { cn } from "./cn";
import { FIELD_BASE } from "./Input";
import { Bold, Italic, Underline } from "./icons";

/**
 * LES NOTES MISES EN FORME — un vrai espace d'écriture, sans changer la forme.
 *
 * `RichTextarea` remplace une `Textarea` à l'identique : même peau de champ,
 * même interligne, même hauteur minimale, même croissance avec le contenu.
 * Seule différence visible : le gras, l'italique et le souligné se voient
 * pendant la frappe. On les pose par ⌘/Ctrl + B/I/U, ou par la mini-barre qui
 * apparaît sur le texte sélectionné (au-dessus à la souris ; en dessous au
 * doigt, pour laisser la place au menu natif du téléphone).
 *
 * La note reste du TEXTE (voir `shared/richText.ts`) : l'éditeur ne fait que
 * traduire le DOM en marques à chaque frappe. Aucun HTML collé n'entre — le
 * collage et le glisser-déposer passent en texte brut.
 */

// SSR : `useLayoutEffect` avertit côté serveur — on retombe sur `useEffect`.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Command = "bold" | "italic" | "underline";
const COMMANDS: readonly Command[] = ["bold", "italic", "underline"];
const SHORTCUT: Record<string, Command> = { b: "bold", i: "italic", u: "underline" };
const ICON = { bold: Bold, italic: Italic, underline: Underline } as const;

/** Taille de la mini-barre — pour la garder dans l'écran. Au doigt, chaque
 *  bouton garde sa cible de 44 px. */
const BAR = { fine: { w: 124, h: 44 }, coarse: { w: 148, h: 52 } } as const;
const GAP = 10;
const EDGE = 8;

export interface RichTextLabels {
  /** Nom de la mini-barre elle-même. */
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
}

export interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Noms de la mini-barre et des trois styles (lecteurs d'écran, infobulles). */
  labels: RichTextLabels;
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  className?: string;
  /** Hauteur maximale avant défilement, en px (comme `Textarea`). */
  maxGrowPx?: number;
}

interface Bar {
  left: number;
  top: number;
  w: number;
  h: number;
}

function execFormat(cmd: Command): void {
  // `execCommand` est marqué obsolète mais reste la seule voie qui garde
  // l'annulation native (⌘Z) dans un champ éditable, sur tous les navigateurs.
  document.execCommand(cmd);
}

export function RichTextarea({
  value,
  onChange,
  labels,
  placeholder,
  "aria-label": ariaLabel,
  id,
  className,
  maxGrowPx = 420,
}: RichTextareaProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Le dernier texte émis par l'éditeur : quand il revient par `value`, le
  // DOM est déjà à jour — le réécrire ferait sauter le curseur.
  const emitted = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [bar, setBar] = useState<Bar | null>(null);
  const [active, setActive] = useState<Record<Command, boolean>>({
    bold: false,
    italic: false,
    underline: false,
  });

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === emitted.current) return;
    el.innerHTML = richTextToHtml(value);
    emitted.current = value;
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = domToRichText(el);
    // Un champ vidé garde souvent un <br> : on le retire pour que l'indication
    // réapparaisse (`:empty`).
    if (!next && el.innerHTML) el.innerHTML = "";
    emitted.current = next;
    onChange(next);
  }, [onChange]);

  // La mini-barre suit la sélection — et seulement celle de CE champ.
  useEffect(() => {
    const update = () => {
      const el = ref.current;
      const sel = document.getSelection();
      if (
        !el ||
        !sel ||
        sel.rangeCount === 0 ||
        sel.isCollapsed ||
        !el.contains(sel.anchorNode) ||
        !el.contains(sel.focusNode)
      ) {
        setBar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setBar(null);
        return;
      }
      saved.current = range.cloneRange();
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const { w, h } = coarse ? BAR.coarse : BAR.fine;
      const below = coarse || r.top - GAP - h < EDGE;
      const left = Math.min(
        Math.max(EDGE, r.left + r.width / 2 - w / 2),
        window.innerWidth - w - EDGE,
      );
      const top = below ? Math.min(r.bottom + GAP, window.innerHeight - h - EDGE) : r.top - GAP - h;
      setBar({ left, top, w, h });
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  const apply = (cmd: Command) => {
    const el = ref.current;
    if (!el) return;
    // Au doigt, toucher la barre peut faire perdre la sélection : on la rend.
    const sel = document.getSelection();
    if (saved.current && sel && (sel.isCollapsed || !el.contains(sel.anchorNode))) {
      el.focus();
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
    execFormat(cmd);
    emit();
    setActive((a) => ({ ...a, [cmd]: document.queryCommandState(cmd) }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const cmd = SHORTCUT[e.key.toLowerCase()];
    if (!cmd) return;
    e.preventDefault();
    execFormat(cmd);
    emit();
  };

  const insertPlain = (text: string) => {
    if (text) document.execCommand("insertText", false, text);
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    insertPlain(e.clipboardData.getData("text/plain"));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.dataTransfer.getData("text/plain");
    const doc = document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    const sel = document.getSelection();
    let range: Range | null = null;
    if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    } else if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    }
    if (range && sel && ref.current?.contains(range.startContainer)) {
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    insertPlain(text);
  };

  return (
    <>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDrop={onDrop}
        onBlur={() => setBar(null)}
        style={maxGrowPx > 0 ? { maxHeight: maxGrowPx } : undefined}
        className={cn(
          FIELD_BASE,
          "tv-control-textarea tv-rich-editor tv-rich py-2.5 leading-relaxed overflow-y-auto",
          className,
        )}
      />
      {bar &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="toolbar"
            aria-label={labels.toolbar}
            style={{ left: bar.left, top: bar.top, width: bar.w, height: bar.h }}
            className="animate-fade-in fixed z-[var(--tv-z-modal-top)] flex items-center justify-center gap-0.5 rounded-xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-2)] p-1 shadow-[var(--tv-elev-2)]"
            // La sélection doit survivre au clic sur la barre.
            onMouseDown={(e) => e.preventDefault()}
          >
            {COMMANDS.map((cmd) => {
              const Icon = ICON[cmd];
              return (
                <button
                  key={cmd}
                  type="button"
                  aria-label={labels[cmd]}
                  aria-pressed={active[cmd]}
                  title={labels[cmd]}
                  onClick={() => apply(cmd)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg pointer-coarse:h-11 pointer-coarse:w-11 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white",
                    active[cmd] &&
                      "bg-white/[0.08] text-[var(--tv-highlight)] hover:text-[var(--tv-highlight)]",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * L'affichage d'une note : des éléments React, jamais de HTML injecté. Les
 * retours à la ligne sont gardés par `whitespace-pre-wrap` côté appelant.
 */
export function RichTextView({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn("tv-rich", className)}>
      {parseRichText(value).map((r, i) => {
        let node: ReactNode = r.text;
        if (r.italic) node = <em>{node}</em>;
        if (r.bold) node = <strong>{node}</strong>;
        if (r.underline) node = <u>{node}</u>;
        return <span key={i}>{node}</span>;
      })}
    </div>
  );
}
