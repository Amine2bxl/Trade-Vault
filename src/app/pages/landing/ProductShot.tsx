import { shot } from "./shots";

/**
 * LE CADRE DES CAPTURES PRODUIT.
 *
 * La table des fichiers vit dans `shots.ts` : ce fichier n'exporte que des
 * composants, condition du rafraîchissement à chaud de Vite.
 */

/**
 * UNE CAPTURE, DANS SON CADRE.
 *
 * Le cadre suit `DESIGN.md` : plaque `surface-1`, liseré d'un pixel, rayon
 * 16px, et le mince trait clair sur l'arête haute qui donne aux panneaux leur
 * relief « rendu au pixel ». Aucune ombre portée — sur un fond quasi noir,
 * elles ne font que salir.
 *
 * `loading` est modulable parce que les deux emplacements n'ont pas le même
 * besoin : celle du héros est visible immédiatement et doit être demandée tout
 * de suite ; celles des sections basses attendent le défilement.
 */
export function ProductShot({
  nom,
  alt,
  legende,
  priorite = false,
  className,
}: {
  nom: string;
  alt: string;
  legende?: string;
  /** Vrai pour la capture du héros : elle est visible sans défiler. */
  priorite?: boolean;
  className?: string;
}) {
  const src = shot(nom);
  if (!src) return null;

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-1.5 sm:p-2">
        {/* L'arête claire du haut — le seul « effet » que la charte autorise. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/[0.09]"
        />
        <img
          src={src}
          alt={alt}
          loading={priorite ? "eager" : "lazy"}
          decoding="async"
          /* `block` : une image en `inline` laisse sous elle la place de la
             ligne de base, donc un liseré de fond sous le cadre. */
          className="block w-full rounded-xl"
        />
      </div>
      {legende && (
        <figcaption className="mt-2.5 text-center text-[12px] text-[#8a8f98]">{legende}</figcaption>
      )}
    </figure>
  );
}

/**
 * LA CAPTURE, OU LE DESSIN — jamais les deux, jamais rien.
 *
 * Le point unique où l'on choisit. Écrire ce ternaire sur chaque section
 * laisserait tôt ou tard un dessin en place à côté d'une capture disponible :
 * deux représentations du même écran, dont une inventée.
 */
export function ShotOuVisuel({
  nom,
  alt,
  legende,
  priorite,
  className,
  repli,
}: {
  nom: string;
  alt: string;
  legende?: string;
  priorite?: boolean;
  className?: string;
  /** L'illustration à montrer tant que la capture n'est pas déposée. */
  repli: React.ReactNode;
}) {
  if (!shot(nom)) return <>{repli}</>;
  return (
    <ProductShot nom={nom} alt={alt} legende={legende} priorite={priorite} className={className} />
  );
}
