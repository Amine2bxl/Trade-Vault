import { useEffect, useRef, useState } from "react";
import MarkdownAnswer from "@/app/components/MarkdownAnswer";

/**
 * TypedAnswer — la réponse de Jarvis S'ÉCRIT sous les yeux du trader.
 *
 * Le serveur rend la réponse d'un bloc, une fois la réflexion terminée. La
 * poser d'un coup donnait un échange « question → pavé » : un formulaire, pas
 * une conversation. Ici le texte se dévoile mot à mot, au rythme d'une
 * écriture rapide, et le Markdown se met en forme au fil de l'eau.
 *
 * Trois garde-fous :
 *  • la durée est BORNÉE (≈ 1,2 s à 7 s selon la longueur) — un long rapport
 *    ne doit pas faire attendre dix secondes ce qui est déjà là ;
 *  • un clic sur la réponse l'affiche en entier, tout de suite ;
 *  • `prefers-reduced-motion` : aucune animation, le texte arrive entier.
 */

const TICK_MS = 33;

/** Découpe en jetons « mot + espaces » : le texte avance par mots entiers,
 *  jamais au milieu d'un mot ni d'une balise Markdown ouverte à moitié. */
function tokensOf(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

/** Ferme un gras resté ouvert pendant l'écriture : `**Win r` s'afficherait
 *  sinon avec ses astérisques bruts. */
function balance(partial: string): string {
  const bold = (partial.match(/\*\*/g) ?? []).length;
  return bold % 2 === 1 ? `${partial}**` : partial;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function TypedAnswer({
  content,
  onProgress,
  onDone,
}: {
  content: string;
  /** Appelé à chaque avancée — sert à garder le fil collé en bas. */
  onProgress?: () => void;
  onDone?: () => void;
}) {
  const tokens = useRef(tokensOf(content));
  const [shown, setShown] = useState(() => (reducedMotion() ? tokens.current.length : 0));
  const doneRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const all = tokens.current;
    if (shown >= all.length) return;
    // Durée cible bornée → nombre de jetons par tic.
    const target = Math.min(7000, Math.max(1200, all.length * 45));
    const perTick = Math.max(1, Math.ceil(all.length / (target / TICK_MS)));
    timerRef.current = window.setInterval(() => {
      setShown((n) => Math.min(all.length, n + perTick));
    }, TICK_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onProgress?.();
    if (shown >= tokens.current.length && !doneRef.current) {
      doneRef.current = true;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const typing = shown < tokens.current.length;
  const text = typing ? balance(tokens.current.slice(0, shown).join("")) : content;

  return (
    <div
      className={typing ? "jarvis-typing" : undefined}
      onClick={() => typing && setShown(tokens.current.length)}
    >
      <MarkdownAnswer content={text} />
    </div>
  );
}
