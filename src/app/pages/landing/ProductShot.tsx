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
 * ── CE QUI A CHANGÉ, ET POURQUOI LA CHARTE LE PERMET ICI ──────────────────
 *
 * Le cadre était une plaque plate, sans ombre, au nom de « rien ne rayonne ».
 * Cette règle vaut pour le PRODUIT CONNECTÉ, où un halo attire l'œil sur du
 * décor pendant qu'un chiffre attend d'être lu. La vitrine a un autre métier :
 * elle est vue une fois, en défilant, par quelqu'un qui ne sait pas encore ce
 * qu'est le produit.
 *
 * Or une capture sombre posée à plat sur un fond sombre n'a pas de bord — elle
 * bave, et se lit comme une pièce jointe. La même capture posée dans la
 * lumière se lit comme un écran allumé. C'est très exactement la différence
 * entre « voici une image du produit » et « le terminal tourne déjà ».
 *
 * Tout l'habillage vit donc dans `.shot-frame`, sous `.landing-root` : aucune
 * de ces règles ne peut atteindre l'application.
 *
 * `priorite` distingue les deux emplacements : celle du héros est visible sans
 * défiler et doit être demandée tout de suite — et, sur une page dont elle est
 * la première image, elle mérite `fetchPriority="high"`, sans quoi le
 * navigateur la met en file derrière les scripts.
 */
export function ProductShot({
  nom,
  alt,
  legende,
  priorite = false,
  hero = false,
  className,
}: {
  nom: string;
  alt: string;
  legende?: string;
  /** Vrai pour la capture du héros : elle est visible sans défiler. */
  priorite?: boolean;
  /** La légère perspective, réservée à la capture d'ouverture. */
  hero?: boolean;
  className?: string;
}) {
  const src = shot(nom);
  if (!src) return null;
  /* LA VARIANTE TÉLÉPHONE, quand elle existe.
   *
   * `<nom>-m.webp` est le MÊME écran, photographié à 390px de large : le
   * produit s'y est replié tout seul, donc son texte est lisible à l'échelle
   * 1 au lieu d'être réduit à 26 %. Absente, on sert la capture de bureau —
   * c'est un repli, pas une panne. */
  const srcMobile = shot(`${nom}-m`);

  return (
    /* `data-shot` porte le nom de l'écran jusqu'au CSS. Sur téléphone, chaque
       capture est cadrée sur une RÉGION différente (voir `landing.css`) : le
       cadrage ne peut pas être le même pour une conversation alignée à droite
       et pour un tableau aligné à gauche. */
    <figure className={className} data-shot={nom}>
      <div className={`shot-frame${hero ? " shot-hero" : ""}`}>
        <picture>
          {srcMobile && <source media="(max-width: 639px)" srcSet={srcMobile} />}
          <img
            src={src}
            alt={alt}
            loading={priorite ? "eager" : "lazy"}
            fetchPriority={priorite ? "high" : "auto"}
            decoding="async"
          />
        </picture>
      </div>
      {legende && (
        <figcaption className="mt-4 text-center text-[12px] text-[#8a8f98]">{legende}</figcaption>
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
  hero,
  className,
  repli,
}: {
  nom: string;
  alt: string;
  legende?: string;
  priorite?: boolean;
  hero?: boolean;
  className?: string;
  /** L'illustration à montrer tant que la capture n'est pas déposée. */
  repli: React.ReactNode;
}) {
  if (!shot(nom)) return <>{repli}</>;
  return (
    <ProductShot
      nom={nom}
      alt={alt}
      legende={legende}
      priorite={priorite}
      hero={hero}
      className={className}
    />
  );
}
