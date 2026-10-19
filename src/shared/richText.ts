/**
 * NOTES MISES EN FORME — du texte simple qui sait porter du gras.
 *
 * Une note reste une chaîne : la recherche du journal, l'export CSV, l'import
 * et Jarvis la lisent sans rien savoir de la mise en forme. Le gras,
 * l'italique et le souligné y sont des marques doublées, toutes différentes
 * pour qu'un mélange reste sans ambiguïté :
 *
 *     **gras**   __italique__   ++souligné++   ++**__les trois__**++
 *
 * Règles qui protègent les notes existantes et ce que le trader tape :
 *   • une marque ne s'ouvre que si elle se ferme sur la même ligne, avec du
 *     texte entre les deux — sinon c'est du texte (`R ++2`, `* puce`) ;
 *   • une marque tapée littéralement est échappée à l'écriture (`\*\*`) ;
 *   • `\` n'échappe que `\ * _ +` : `C:\dossier` reste lisible.
 *
 * Aucune dépendance au DOM : `domToRichText` lit une structure de nœuds
 * minimale (celle de l'éditeur `RichTextarea`), testable sans navigateur.
 */

export interface RichRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

type Style = "bold" | "italic" | "underline";
type Fmt = Record<Style, boolean>;

const MARKS: readonly [string, Style][] = [
  ["**", "bold"],
  ["__", "italic"],
  ["++", "underline"],
];
/** Ordre d'ouverture à l'écriture : extérieur → intérieur. */
const ORDER: readonly Style[] = ["underline", "bold", "italic"];
const MARK_OF: Record<Style, string> = { bold: "**", italic: "__", underline: "++" };
const SPECIAL = new Set(["\\", "*", "_", "+"]);
const MARK_CHARS = new Set(["*", "_", "+"]);
const PLAIN: Fmt = { bold: false, italic: false, underline: false };

function pushRun(out: RichRun[], text: string, fmt: Fmt): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (
    last &&
    last.bold === fmt.bold &&
    last.italic === fmt.italic &&
    last.underline === fmt.underline
  ) {
    last.text += text;
    return;
  }
  out.push({ text, ...fmt });
}

/** Position de la marque fermante `mark` à partir de `from` (échappements sautés), ou -1. */
function findClose(s: string, from: number, mark: string): number {
  for (let i = from; i < s.length; i += 1) {
    if (s[i] === "\\" && i + 1 < s.length && SPECIAL.has(s[i + 1])) {
      i += 1;
      continue;
    }
    if (s.startsWith(mark, i)) return i;
  }
  return -1;
}

function parseLine(s: string, fmt: Fmt, out: RichRun[]): void {
  let buf = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length && SPECIAL.has(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    const mark = MARKS.find(([m, style]) => !fmt[style] && s.startsWith(m, i));
    if (mark) {
      const close = findClose(s, i + 2, mark[0]);
      if (close > i + 2) {
        pushRun(out, buf, fmt);
        buf = "";
        parseLine(s.slice(i + 2, close), { ...fmt, [mark[1]]: true }, out);
        i = close + 2;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  pushRun(out, buf, fmt);
}

/** Texte de note → segments mis en forme (retours à la ligne inclus, non stylés). */
export function parseRichText(src: string): RichRun[] {
  const out: RichRun[] = [];
  const lines = src.split("\n");
  lines.forEach((line, idx) => {
    if (idx > 0) pushRun(out, "\n", PLAIN);
    parseLine(line, PLAIN, out);
  });
  return out;
}

/** Échappe ce qui pourrait se lire comme une marque : les caractères doublés,
 *  ceux en bord de segment (collés à une marque voisine) et `\` devant un
 *  caractère spécial. Le texte ordinaire (`R+2`, `snake_case`) ne change pas. */
function escapeText(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "\\") {
      out += i + 1 < s.length && SPECIAL.has(s[i + 1]) ? "\\\\" : "\\";
      continue;
    }
    if (
      MARK_CHARS.has(ch) &&
      (s[i - 1] === ch || s[i + 1] === ch || i === 0 || i === s.length - 1)
    ) {
      out += `\\${ch}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Segments → texte de note. Les marques ne traversent jamais une ligne. */
export function serializeRichText(runs: RichRun[]): string {
  let out = "";
  const stack: Style[] = [];
  const closeFrom = (k: number) => {
    while (stack.length > k) out += MARK_OF[stack.pop() as Style];
  };
  for (const r of runs) {
    r.text.split("\n").forEach((line, idx) => {
      if (idx > 0) {
        closeFrom(0);
        out += "\n";
      }
      if (!line) return;
      const k = stack.findIndex((s) => !r[s]);
      if (k !== -1) closeFrom(k);
      for (const s of ORDER) {
        if (r[s] && !stack.includes(s)) {
          out += MARK_OF[s];
          stack.push(s);
        }
      }
      out += escapeText(line);
    });
  }
  closeFrom(0);
  return out;
}

/** Le texte sans marques (aperçus, comparaisons). */
export function stripRichText(src: string): string {
  return parseRichText(src)
    .map((r) => r.text)
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** HTML de l'éditeur : tout est échappé, seules `<u> <strong> <em> <br>` sont produites. */
export function richTextToHtml(src: string): string {
  let html = "";
  for (const r of parseRichText(src)) {
    let piece = escapeHtml(r.text).replace(/\n/g, "<br>");
    if (r.italic) piece = `<em>${piece}</em>`;
    if (r.bold) piece = `<strong>${piece}</strong>`;
    if (r.underline) piece = `<u>${piece}</u>`;
    html += piece;
  }
  // Une ligne vide en fin de note n'existe à l'écran que suivie d'un <br>.
  if (src.endsWith("\n")) html += "<br>";
  return html;
}

/** La forme minimale d'un nœud DOM lue par `domToRichText`. */
export interface RichNodeLike {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<RichNodeLike>;
  style?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    textDecorationLine?: string;
  };
}

function styleOf(node: RichNodeLike, fmt: Fmt): Fmt {
  const name = node.nodeName.toUpperCase();
  const st = node.style ?? {};
  const weight = st.fontWeight ?? "";
  const decoration = `${st.textDecoration ?? ""} ${st.textDecorationLine ?? ""}`;
  // Safari retire parfois un style par un `<span>` « normal » DANS la balise :
  // un style explicitement remis à zéro l'emporte sur l'héritage.
  const heavy = weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  const light =
    weight === "normal" || weight === "lighter" || (weight !== "" && Number(weight) < 600);
  return {
    bold: name === "B" || name === "STRONG" || heavy || (fmt.bold && !light),
    italic:
      name === "I" ||
      name === "EM" ||
      st.fontStyle === "italic" ||
      (fmt.italic && st.fontStyle !== "normal"),
    underline:
      name === "U" ||
      decoration.includes("underline") ||
      (fmt.underline && decoration.trim() !== "none"),
  };
}

/** Contenu de l'éditeur → texte de note. Lit les balises ET les styles CSS,
 *  les lignes en `<div>`/`<p>` (Chrome, Safari) comme en `<br>` (Firefox). */
export function domToRichText(root: RichNodeLike): string {
  const runs: RichRun[] = [];
  let lastLeafIsBr = false;
  // Un bloc refermé : ce qui le suit commence une nouvelle ligne.
  let pendingBreak = false;
  const lastChar = () => {
    const last = runs[runs.length - 1];
    return last ? last.text[last.text.length - 1] : undefined;
  };
  const breakLine = () => {
    if (runs.length > 0 && lastChar() !== "\n") pushRun(runs, "\n", PLAIN);
    pendingBreak = false;
  };
  const walk = (node: RichNodeLike, fmt: Fmt, isRoot: boolean) => {
    if (node.nodeType === 3) {
      const t = node.textContent ?? "";
      if (t) {
        if (pendingBreak) breakLine();
        pushRun(runs, t, fmt);
        lastLeafIsBr = false;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const name = node.nodeName.toUpperCase();
    if (name === "BR") {
      if (pendingBreak) breakLine();
      pushRun(runs, "\n", PLAIN);
      lastLeafIsBr = true;
      return;
    }
    const block = !isRoot && (name === "DIV" || name === "P");
    if (block) breakLine();
    const next = isRoot ? fmt : styleOf(node, fmt);
    for (let i = 0; i < node.childNodes.length; i += 1) walk(node.childNodes[i], next, false);
    if (block) pendingBreak = true;
  };
  walk(root, PLAIN, true);
  // Le <br> final que les navigateurs ajoutent pour placer le curseur.
  const last = runs[runs.length - 1];
  if (lastLeafIsBr && last && last.text.endsWith("\n")) {
    last.text = last.text.slice(0, -1);
    if (!last.text) runs.pop();
  }
  return serializeRichText(runs);
}
