import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JarvisMark } from "../src/shared/ui/JarvisMark";

/**
 * LE SIGLE DE JARVIS.
 *
 * Il remplace `Bot` de lucide — le petit robot à antenne que tout le monde
 * colle dans un coin pour dire « il y a une IA ici ». C'est désormais le V de
 * *Vault*, construit comme le mot de la marque : un bras fin et sourd
 * (« Trade », à 65 % dans `Brand.tsx`), un bras épais et plein (« Vault »).
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
 * Le contrat tient en une phrase : DEUX TRAITS, `currentColor`, RIEN D'AUTRE.
 * La couleur vient de la plaque qui le porte, jamais du sigle.
 */

const html = renderToStaticMarkup(<JarvisMark className="h-5 w-5" />);

describe("le sigle de Jarvis", () => {
  test("est un SVG de deux traits, et deux seulement", () => {
    // Deux bras : le fin et l'épais. Un troisième trait, et ce n'est plus un V.
    expect(html.match(/<path/g) ?? []).toHaveLength(2);
  });

  test("prend la couleur de la surface qui le porte", () => {
    expect(html.match(/currentColor/g) ?? []).toHaveLength(2);
  });

  test("n'écrit AUCUNE couleur — le studio de thèmes doit pouvoir le repeindre", () => {
    // Ni hex, ni rgb(), ni variable : la teinte est héritée, point.
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|var\(--/i);
  });

  test("garde le contraste de graisse qui cite le mot de la marque", () => {
    // Le bras « Trade » est en retrait, le bras « Vault » est plein et plus
    // épais. Si les deux s'égalisent, le sigle perd son lien au logotype.
    const widths = [...html.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(widths).toHaveLength(2);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(html).toContain('opacity="0.5"');
  });

  test("se dimensionne par sa classe et reste invisible aux lecteurs d'écran", () => {
    // Il accompagne TOUJOURS le mot « Jarvis » ou un `aria-label` : l'annoncer
    // une seconde fois ferait lire deux fois le même nom.
    expect(html).toContain("h-5 w-5");
    expect(html).toContain('aria-hidden="true"');
  });
});
