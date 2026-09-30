/**
 * LES CAPTURES DU PRODUIT — le protagoniste de chaque section.
 *
 * ── LE PROBLÈME QUE CE FICHIER RÈGLE ────────────────────────────────────────
 *
 * `DESIGN.md` est explicite : « lead EVERY section with a product screenshot »,
 * et « NEVER invent testimonials, user counts, logos, revenue or performance
 * claims ». La landing faisait l'inverse : elle DESSINAIT le produit en SVG, et
 * les chiffres de ces dessins — « +$4,218.50 », « +16.9 % », « 64 % de
 * réussite », « profit factor 2.31 » — sont inventés de bout en bout.
 *
 * Un visiteur ne peut pas faire la différence entre une capture et un dessin
 * soigné. C'est précisément ce qui rend le dessin inacceptable : il présente
 * des performances fabriquées comme un aperçu du produit.
 *
 * ── COMMENT ON ÉVITE LES DEUX MAUVAISES SORTIES ─────────────────────────────
 *
 * Deux pannes possibles, aussi mauvaises l'une que l'autre :
 *
 *   • une image manquante → un cadre vide, une icône cassée, en haut de la
 *     page d'accueil ;
 *   • un dessin qui reste en place alors qu'une vraie capture est disponible.
 *
 * Les deux disparaissent si la présence du fichier est connue AU MOMENT DU
 * BUILD. `import.meta.glob(..., { eager: true })` liste ce qui existe
 * réellement dans `src/assets/product/` et donne l'URL hachée de chaque
 * fichier. Une capture absente n'est donc pas une erreur d'exécution : elle
 * n'est simplement pas dans la table, `shot()` rend `null`, et l'appelant
 * garde son illustration de repli.
 *
 * DÉPOSER UN FICHIER SUFFIT. Aucun code à modifier : un `dashboard.png` posé
 * dans `src/assets/product/` remplace le dessin du héros au prochain build.
 * Voir `src/assets/product/README.md` pour la liste des noms attendus.
 */

/* Vite résout ce motif à la compilation. Le chemin est littéral — une variable
   ne fonctionnerait pas, `glob` ayant besoin d'un motif statique. */
const FICHIERS = import.meta.glob<{ default: string }>(
  "../../../assets/product/*.{png,jpg,jpeg,webp,avif}",
  { eager: true },
);

/** Nom de fichier (sans extension) → URL construite par le bundler. */
const CAPTURES: Record<string, string> = Object.fromEntries(
  Object.entries(FICHIERS).map(([chemin, mod]) => [
    chemin.slice(chemin.lastIndexOf("/") + 1).replace(/\.[^.]+$/, ""),
    mod.default,
  ]),
);

/**
 * L'URL d'une capture, ou `null` si le fichier n'a pas été déposé.
 *
 * Rendre `null` plutôt que de lever : une capture manquante est un état normal
 * du dépôt (elle sera ajoutée), pas une erreur de programmation.
 */
export function shot(nom: string): string | null {
  return CAPTURES[nom] ?? null;
}
