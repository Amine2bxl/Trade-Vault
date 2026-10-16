import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * UN CHIFFRE QUI ROULE QUAND IL CHANGE — l'effet « compteur » de Lucid.
 *
 * Sur le tableau de bord Lucid, un solde ou un P&L qui se met à jour ne
 * remplace pas un nombre par un autre d'une frame à l'autre : la nouvelle
 * valeur glisse dans la case pendant que l'ancienne en sort, dans le SENS du
 * mouvement (un montant qui monte arrive par le bas, un montant qui baisse
 * tombe d'en haut). C'est ce geste, qui dit « ce chiffre vient de bouger »,
 * que reprend ce composant.
 *
 * Ce n'est pas un neuvième geste : c'est la mécanique déjà en place pour le
 * prix de la page d'abonnement (`PrixAnime`), généralisée à toute donnée
 * chiffrée — mêmes keyframes (`prix-entre` / `prix-sort`), `transform` et
 * `opacity` uniquement, sortie à 70 % de l'entrée, rien sous
 * `prefers-reduced-motion`.
 *
 * Le premier rendu ne roule PAS : une page qui s'ouvre n'a rien vu changer.
 */

/** Le premier nombre d'un montant formaté, séparateurs et signe compris. */
function figureValue(text: string): number {
  const negative = /[-−]/.test(text) || /^\(.*\)$/.test(text.trim());
  const digits = text.replace(/[^\d.,]/g, "");
  // « 1,234.56 » comme « 1.234,56 » : le DERNIER séparateur est la décimale
  // — sauf s'il est suivi de trois chiffres exactement, auquel cas c'est un
  // séparateur de milliers (« $54,936 » vaut cinquante-quatre mille).
  const lastSep = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  const isDecimal = lastSep !== -1 && digits.length - lastSep - 1 !== 3;
  const normalized = isDecimal
    ? digits.slice(0, lastSep).replace(/[.,]/g, "") + "." + digits.slice(lastSep + 1)
    : digits.replace(/[.,]/g, "");
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

export function RollingFigure({ value, className }: { value: string; className?: string }) {
  const [current, setCurrent] = useState(value);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [dir, setDir] = useState<"bas" | "haut">("haut");
  const previous = useRef(value);

  useEffect(() => {
    if (value === previous.current) return;
    setDir(figureValue(value) < figureValue(previous.current) ? "bas" : "haut");
    setLeaving(previous.current);
    setCurrent(value);
    previous.current = value;
  }, [value]);

  return (
    <span className={cn("prix-anime", className)} data-sens={dir}>
      {/* Tant que rien n'a changé, la valeur est posée sans animation : la clé
          ne change qu'au premier changement réel. */}
      <span key={current} className={leaving !== null ? "prix-anime-entre" : undefined}>
        {current}
      </span>
      {leaving !== null && (
        <span
          key={`out-${leaving}`}
          className="prix-anime-sort"
          aria-hidden
          // Retirée à la fin de SON animation, jamais sur une minuterie : les
          // deux durées finiraient par diverger (voir `PrixAnime`).
          onAnimationEnd={() => setLeaving(null)}
        >
          {leaving}
        </span>
      )}
    </span>
  );
}
