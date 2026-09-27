import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JarvisMark } from "../src/shared/ui/JarvisMark";

/**
 * LE SIGLE DE JARVIS.
 *
 * Il remplace `Bot` de lucide — le petit robot à antenne que tout le monde
 * colle dans un coin pour dire « il y a une IA ici » — puis le V de *Vault*,
 * qui était le sigle de TradeVault et pas celui de Jarvis. C'est désormais son
 * logo à lui : un NOYAU plein, un ANNEAU ouvert, une ÉTINCELLE en orbite dans
 * l'ouverture — le même objet que l'orbe vivante (`JarvisOrb`), au repos.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * `themeCoverage.test.ts` interdit déjà les couleurs de marque écrites en dur…
 * mais il ne balaie que `src/app`. Le sigle vit dans `src/shared/ui`, donc HORS
 * de son champ : une couleur écrite en dur ici passerait sans bruit, et le
 * sigle resterait vert chez un trader qui s'est choisi un thème violet — sur la
 * surface la plus visible du produit, celle qui flotte en permanence dans le
 * coin de l'écran.
 *
 * Le contrat tient en une phrase : TROIS FORMES, `currentColor`, RIEN D'AUTRE.
 * La couleur vient de la plaque qui le porte, jamais du sigle.
 */

const html = renderToStaticMarkup(<JarvisMark className="h-5 w-5" />);

describe("le sigle de Jarvis", () => {
  test("est un anneau, un noyau et une étincelle — trois formes pleines, lisibles à 16px", () => {
    expect(html.match(/<path/g) ?? []).toHaveLength(1);
    expect(html.match(/<circle/g) ?? []).toHaveLength(2);
  });

  test("prend la couleur de la surface qui le porte", () => {
    expect(html.match(/currentColor/g) ?? []).toHaveLength(3);
  });

  test("n'écrit AUCUNE couleur — le studio de thèmes doit pouvoir le repeindre", () => {
    // Ni hex, ni rgb(), ni variable : la teinte est héritée, point.
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|var\(--/i);
  });

  test("l'anneau est en retrait, le noyau et l'étincelle sont pleins", () => {
    // La hiérarchie du dessin : l'attention (anneau) s'efface derrière
    // l'intelligence (noyau). Égalisés, les trois se lisent comme une cible.
    expect(html).toContain('opacity="0.55"');
    expect(html.match(/fill="currentColor"/g) ?? []).toHaveLength(2);
  });

  test("se dimensionne par sa classe et reste invisible aux lecteurs d'écran", () => {
    // Il accompagne TOUJOURS le mot « Jarvis » ou un `aria-label` : l'annoncer
    // une seconde fois ferait lire deux fois le même nom.
    expect(html).toContain("h-5 w-5");
    expect(html).toContain('aria-hidden="true"');
  });
});
