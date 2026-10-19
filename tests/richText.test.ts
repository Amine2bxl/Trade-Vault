import { describe, expect, test } from "bun:test";
import {
  domToRichText,
  parseRichText,
  richTextToHtml,
  serializeRichText,
  stripRichText,
  type RichNodeLike,
} from "../src/shared/richText";

/**
 * LES NOTES MISES EN FORME — stockées en texte simple.
 *
 * La note reste une chaîne : la recherche du journal, l'export CSV et Jarvis
 * continuent de la lire. Gras, italique et souligné y sont des marques
 * (`**gras**`, `__italique__`, `++souligné++`) que l'éditeur affiche mises en
 * forme. Ce qui compte ici :
 *   • aller-retour sans perte (texte → mise en forme → texte) ;
 *   • les anciennes notes, tapées sans marques, s'affichent telles quelles ;
 *   • une marque tapée littéralement par le trader ne devient pas un style ;
 *   • aucun HTML venu de la note n'atteint la page (échappement).
 */

const run = (
  text: string,
  f: Partial<{ bold: boolean; italic: boolean; underline: boolean }> = {},
) => ({
  text,
  bold: !!f.bold,
  italic: !!f.italic,
  underline: !!f.underline,
});

describe("lecture", () => {
  test("une ancienne note sans marque reste du texte", () => {
    expect(parseRichText("Entrée trop tôt.\n* pas de confirmation")).toEqual([
      run("Entrée trop tôt.\n* pas de confirmation"),
    ]);
  });

  test("gras, italique, souligné", () => {
    expect(parseRichText("a **b** __c__ ++d++")).toEqual([
      run("a "),
      run("b", { bold: true }),
      run(" "),
      run("c", { italic: true }),
      run(" "),
      run("d", { underline: true }),
    ]);
  });

  test("styles combinés", () => {
    expect(parseRichText("++**__x__**++")).toEqual([
      run("x", { bold: true, italic: true, underline: true }),
    ]);
  });

  test("une marque sans fermeture sur la ligne reste du texte", () => {
    expect(parseRichText("R ++2\nfin ++")).toEqual([run("R ++2\nfin ++")]);
  });

  test("une marque échappée reste du texte", () => {
    expect(parseRichText("\\*\\*pas gras\\*\\*")).toEqual([run("**pas gras**")]);
  });

  test("une barre oblique ordinaire est gardée", () => {
    expect(parseRichText("C:\\dossier")).toEqual([run("C:\\dossier")]);
  });
});

describe("écriture", () => {
  test("aller-retour sans perte", () => {
    const runs = [
      run("Plan "),
      run("respecté", { bold: true }),
      run(", mais "),
      run("sortie", { italic: true, underline: true }),
      run(" trop tôt.\nLeçon : "),
      run("attendre", { bold: true, underline: true }),
    ];
    expect(parseRichText(serializeRichText(runs))).toEqual(runs);
  });

  test("les marques ne traversent pas une ligne", () => {
    const text = serializeRichText([run("a\nb", { bold: true })]);
    expect(text).toBe("**a**\n**b**");
  });

  test("une marque tapée littéralement ne devient pas un style", () => {
    const text = serializeRichText([run("x ** y ++ z __")]);
    expect(parseRichText(text)).toEqual([run("x ** y ++ z __")]);
  });

  test("le texte sans style ne change pas", () => {
    expect(serializeRichText([run("R+2, 1*3, snake_case")])).toBe("R+2, 1*3, snake_case");
  });

  test("texte brut pour les aperçus", () => {
    expect(stripRichText("a **b** ++c++ \\*\\*")).toBe("a b c **");
  });
});

describe("HTML de l'éditeur", () => {
  test("échappe tout HTML venu de la note", () => {
    expect(richTextToHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  test("mise en forme et retours à la ligne", () => {
    expect(richTextToHtml("a **b**\nc")).toBe("a <strong>b</strong><br>c");
  });

  test("une ligne vide finale reste visible", () => {
    expect(richTextToHtml("a\n")).toBe("a<br><br>");
  });
});

// ── Un faux DOM minimal : ce que l'éditeur contient après la frappe ──────────
const txt = (t: string): RichNodeLike => ({
  nodeType: 3,
  nodeName: "#text",
  textContent: t,
  childNodes: [],
});
const el = (
  name: string,
  children: RichNodeLike[],
  style: Record<string, string> = {},
): RichNodeLike => ({
  nodeType: 1,
  nodeName: name,
  textContent: null,
  childNodes: children,
  style,
});

describe("lecture de l'éditeur", () => {
  test("balises des navigateurs (b, i, u, strong, em)", () => {
    const root = el("DIV", [
      txt("a "),
      el("B", [txt("b")]),
      txt(" "),
      el("I", [el("U", [txt("c")])]),
    ]);
    expect(domToRichText(root)).toBe("a **b** ++__c__++");
  });

  test("styles posés en CSS par certains navigateurs", () => {
    const root = el("DIV", [
      el("SPAN", [txt("x")], { fontWeight: "700", textDecorationLine: "underline" }),
    ]);
    expect(domToRichText(root)).toBe("++**x**++");
  });

  test("lignes en <div> (Chrome, Safari) et <br> (Firefox)", () => {
    const chrome = el("DIV", [
      txt("a"),
      el("DIV", [txt("b")]),
      el("DIV", [el("BR", [])]),
      el("DIV", [txt("c")]),
    ]);
    expect(domToRichText(chrome)).toBe("a\nb\n\nc");
    const firefox = el("DIV", [txt("a"), el("BR", []), txt("b")]);
    expect(domToRichText(firefox)).toBe("a\nb");
  });

  test("le <br> de fin ajouté pour le curseur n'ajoute pas de ligne", () => {
    const root = el("DIV", [txt("a"), el("BR", []), el("BR", [])]);
    expect(domToRichText(root)).toBe("a\n");
  });

  test("aller-retour texte → HTML → texte", () => {
    // Le HTML produit est relu via sa structure : on la reconstruit à la main.
    const root = el("DIV", [txt("a "), el("STRONG", [txt("b")]), el("BR", []), txt("c")]);
    expect(domToRichText(root)).toBe("a **b**\nc");
  });
});

describe("lecture de l'éditeur — cas limites", () => {
  test("un style remis à « normal » dans une balise l'emporte", () => {
    const root = el("DIV", [el("B", [txt("a"), el("SPAN", [txt("b")], { fontWeight: "normal" })])]);
    expect(domToRichText(root)).toBe("**a**b");
  });

  test("du texte après un bloc refermé commence une nouvelle ligne", () => {
    const root = el("DIV", [el("DIV", [txt("a")]), txt("b")]);
    expect(domToRichText(root)).toBe("a\nb");
  });

  test("un éditeur vidé ne laisse pas de ligne fantôme", () => {
    expect(domToRichText(el("DIV", [el("BR", [])]))).toBe("");
    expect(domToRichText(el("DIV", [el("DIV", [el("BR", [])])]))).toBe("");
  });
});
