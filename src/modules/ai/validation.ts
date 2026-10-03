/**
 * LA VALIDATION DES CHIFFRES — aucun nombre inventé ne sort de Jarvis.
 *
 * Le prompt l'interdit déjà ; un modèle obéit… presque toujours. Ce module
 * VÉRIFIE, de façon déterministe et sans modèle : chaque chiffre « de donnée »
 * de la réponse (montant, pourcentage, R, décimal, nombre ≥ 11) doit se
 * retrouver dans les DONNÉES que Jarvis a reçues — les blocs de contexte, les
 * lectures préparées, les sorties d'outils, la question elle-même.
 *
 * ── CE QUI EST ACCEPTÉ ─────────────────────────────────────────────────────
 *  - le nombre tel quel, au signe près (« une perte de 120 € » pour −120) et à
 *    l'arrondi d'affichage près (42,7 pour 42,6666…) ;
 *  - un pourcentage écrit pour une fraction (42 % pour 0,42) et inversement.
 *
 * ── CE QUI NE L'EST PAS : L'ARITHMÉTIQUE DU MODÈLE ─────────────────────────
 * Une part, un écart ou un total que le modèle calcule lui-même n'est pas
 * accepté, même juste. Ce n'est pas du zèle : mesuré, avec quelques centaines
 * de nombres dans le contexte, presque n'importe quel chiffre s'écrit comme un
 * ratio ou une somme de deux d'entre eux — accepter les dérivations revenait à
 * tout accepter. Et la règle du produit est que les chiffres viennent des
 * moteurs : une part qui compte (« 64 % de ta perte nette ») doit être calculée
 * par un moteur et lue, pas reconstituée.
 *
 * ── CE QUI EST IGNORÉ ──────────────────────────────────────────────────────
 * Les dates, heures, années, numéros de liste et chiffres inclus dans un nom
 * d'instrument (« GER40 », « US30 ») : ce ne sont pas des affirmations sur les
 * données. Les petits entiers sans unité (« 3 règles ») sont vérifiés mais ne
 * déclenchent pas de réparation — compter des lignes est une lecture, et les
 * faux positifs coûteraient un appel modèle pour rien.
 *
 * Module PUR : aucun réseau, aucune dépendance, testable exhaustivement.
 */

export interface Figure {
  /** Le texte du chiffre tel qu'écrit dans la réponse. */
  raw: string;
  /** Les valeurs possibles (une écriture ambiguë « 1,234 » en a deux). */
  values: number[];
  /** Nombre de décimales affichées — fixe la tolérance d'arrondi. */
  decimals: number;
  percent: boolean;
  /** `true` = un chiffre de donnée qui DOIT être appuyé. */
  strict: boolean;
}

export interface ValidationResult {
  /** Chiffres de donnée examinés. */
  checked: number;
  /** Chiffres stricts sans appui dans les données. */
  unsupported: Figure[];
  /** Petits entiers sans appui (signalés, sans réparation). */
  softUnsupported: Figure[];
  ok: boolean;
}

const CURRENCY = /[$€£¥]/;

/** Supprime ce qui n'est pas une affirmation chiffrée : dates, heures, instruments, listes. */
function scrub(text: string): string {
  return (
    text
      // Dates ISO et JJ/MM(/AAAA), heures HH:MM, plages d'heures.
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
      .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
      .replace(/\b\d{1,2}[:h]\d{2}\b/g, " ")
      // Un nombre COLLÉ à des lettres fait partie d'un nom : GER40, US30, M2K,
      // 6E, H1, Q3, T2… (mais « 5k » / « 2R » restent des chiffres, voir plus bas).
      .replace(/\b[A-Za-z]+\d+[A-Za-z]*\b|\b\d+[A-Za-z]{2,}\d*\b/g, (m) =>
        /^\d+(?:[.,]\d+)?[kKmM]$/.test(m) ? m : " ",
      )
      // Jour + mois en lettres (« 12 septembre », « September 12 »).
      .replace(
        /\b\d{1,2}(er)?\s+(janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c|jan|feb|mar|apr|may|jun|jul|aug|sep|dec)[a-zé]*\b/gi,
        " ",
      )
      .replace(
        /\b(january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|fevrier|avril|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{1,2}\b/gi,
        " ",
      )
      // Années — mais pas un MONTANT qui leur ressemble : « 1950,37 € »,
      // « $2019.83 » ou « 2019 € » perdaient leur partie entière et leurs
      // décimales étaient ensuite signalées comme inventées.
      .replace(
        /(?<![$€£¥]\s?|[\d.,])\b(19|20)\d{2}\b(?![.,]\d|\s?(?:[$€£¥%]|R\b|[kK]\b|pts?\b|points?\b))/g,
        " ",
      )
      // Puces numérotées en début de ligne (« 1. », « 2) »).
      .replace(/^\s*\d{1,2}[.)]\s/gm, " ")
  );
}

/**
 * Les valeurs possibles d'un nombre écrit. « 1 234,50 », « 1,234.50 » et
 * « 1.234,50 » sont lus ; « 1,234 » est ambigu (mille deux cent trente-quatre
 * OU un virgule deux trois quatre) : les deux lectures sont gardées.
 */
export function parseWrittenNumber(raw: string): { values: number[]; decimals: number } {
  const s = raw.replace(/[\s\u00a0\u202f]/g, "");
  const out = new Set<number>();
  let decimals = 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const push = (txt: string) => {
    const n = Number(txt);
    if (Number.isFinite(n)) out.add(n);
  };
  if (lastComma === -1 && lastDot === -1) {
    push(s);
  } else if (lastComma !== -1 && lastDot !== -1) {
    // Les deux : le dernier séparateur est la décimale.
    if (lastComma > lastDot) {
      push(s.replace(/\./g, "").replace(",", "."));
      decimals = s.length - lastComma - 1;
    } else {
      push(s.replace(/,/g, ""));
      decimals = s.length - lastDot - 1;
    }
  } else {
    const sep = lastComma !== -1 ? "," : ".";
    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    const groupLike = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    if (groupLike) push(parts.join("")); // séparateur de milliers
    if (parts.length === 2) {
      push(`${parts[0]}.${tail}`); // séparateur décimal
      if (!groupLike) decimals = tail.length;
    }
    if (out.size === 0) push(s.replace(/[,.]/g, ""));
  }
  return { values: [...out], decimals };
}

/** Les chiffres d'une réponse, avec leur nature. */
export function extractFigures(text: string): Figure[] {
  const clean = scrub(text);
  const figures: Figure[] = [];
  const re =
    /([$€£¥]\s?)?([+\-−]?)(\d{1,3}(?:[\s\u00a0\u202f,.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(\s?(?:%|[$€£¥]|R\b|[kK]\b|pts?\b|points?\b))?/g;
  for (const m of clean.matchAll(re)) {
    const [whole, cur, , num, suffix] = m;
    const { values, decimals } = parseWrittenNumber(num);
    if (!values.length) continue;
    const unit = `${cur ?? ""}${suffix ?? ""}`;
    const percent = /%/.test(unit);
    const k = /[kK]/.test(suffix ?? "");
    const vals = k ? values.map((v) => v * 1000) : values;
    const max = Math.max(...vals.map(Math.abs));
    const strict =
      CURRENCY.test(unit) || percent || /R\b/.test(unit) || k || decimals > 0 || max >= 11;
    figures.push({ raw: whole.trim(), values: vals, decimals: k ? 0 : decimals, percent, strict });
  }
  return figures;
}

/** Tous les nombres présents dans les données (texte, JSON). */
export function evidenceNumbers(corpus: string): number[] {
  const out = new Set<number>();
  for (const m of corpus.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)) {
    const n = Number(m[0]);
    if (Number.isFinite(n)) out.add(Math.abs(n));
  }
  // Les nombres écrits avec séparateurs dans les blocs texte.
  for (const m of corpus.matchAll(/\d{1,3}(?:[ ,.\u00a0\u202f]\d{3})+(?:[.,]\d+)?/g)) {
    for (const v of parseWrittenNumber(m[0]).values) out.add(Math.abs(v));
  }
  return [...out];
}

/** Tolérance d'arrondi pour un chiffre affiché avec `decimals` décimales. */
function tolerance(value: number, decimals: number): number {
  const display = 0.5 * 10 ** -decimals + 1e-9;
  // Les montants arrondis à l'unité ou à la dizaine dans une phrase (« ~1 300 € »).
  const relative = Math.abs(value) >= 100 ? Math.abs(value) * 0.005 : 0;
  return Math.max(display, relative);
}

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** Un chiffre est-il appuyé par les données ? Au signe et à l'arrondi d'affichage près. */
export function isSupported(fig: Figure, evidence: readonly number[]): boolean {
  for (const raw of fig.values) {
    const v = Math.abs(raw);
    const tol = tolerance(v, fig.decimals);
    if (evidence.some((e) => near(e, v, tol))) return true;
    // « 42 % » pour une fraction 0,42 rendue par un moteur.
    if (fig.percent && evidence.some((e) => near(e, v / 100, tol / 100))) return true;
    // « 0,42 » pour un pourcentage 42 rendu par un moteur.
    if (!fig.percent && v < 1 && evidence.some((e) => near(e, v * 100, tol * 100))) return true;
  }
  return false;
}

/**
 * Une phrase qui RECOMMANDE ou EXPLIQUE (« limite ton risque à 0,5 % », « par
 * exemple, un ratio de 2:1… ») n'affirme rien sur les données du trader : ses
 * chiffres sont des seuils ou des illustrations, pas des mesures. Les vérifier
 * ferait « réparer » un bon conseil.
 */
const ADVICE_OR_GENERAL =
  /\b(limite|limiter|r[ée]duis|r[ée]duire|vise|viser|fixe|fixer|garde|garder|essaie|essayer|commence|passe [àa]|ne d[ée]passe|plafonne|impose|recommand|conseil|sugg[eè]r|par exemple|exemple|en g[ée]n[ée]ral|g[ée]n[ée]ralement|typiquement|par d[ée]finition|try|limit|keep|aim|set a|set your|cap |reduce|stick to|don'?t exceed|do not exceed|consider|recommend|suggest|for example|e\.g\.|typically|in general|generally|by definition|rule of thumb|r[èe]gle d'or)\b/i;

/** Les phrases d'une réponse (fin de phrase, puce, retour à la ligne). */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Valide une réponse contre son corpus de données. Les petits entiers sans
 * unité ne font pas échouer la validation (voir l'en-tête).
 */
export function validateAnswer(answer: string, corpus: string): ValidationResult {
  const figures = sentences(answer)
    .filter((s) => !ADVICE_OR_GENERAL.test(s))
    .flatMap((s) => extractFigures(s));
  const evidence = evidenceNumbers(corpus);
  const unsupported: Figure[] = [];
  const softUnsupported: Figure[] = [];
  for (const f of figures) {
    if (isSupported(f, evidence)) continue;
    (f.strict ? unsupported : softUnsupported).push(f);
  }
  return {
    checked: figures.length,
    unsupported,
    softUnsupported,
    ok: unsupported.length === 0,
  };
}

/** La consigne de réparation : quels chiffres, et quoi faire. */
export function repairInstruction(unsupported: readonly Figure[], language?: string): string {
  const list = unsupported
    .slice(0, 12)
    .map((f) => `"${f.raw}"`)
    .join(", ");
  const fr = (language ?? "").toLowerCase().startsWith("fr");
  return (
    `VERIFICATION FAILED: these figures in your draft do not appear in the trader's data you ` +
    `were given: ${list}. Rewrite the answer so that EVERY figure is one present in the data ` +
    `above, quoted as given — do not compute new shares, sums or differences. Remove any figure you cannot ` +
    `support and say plainly what is missing instead. Keep everything else, same language ` +
    `(${fr ? "French" : "the trader's language"}), no mention of this check.`
  );
}

/** La mention honnête ajoutée quand un chiffre reste invérifiable après réparation. */
export function unverifiedNotice(language?: string): string {
  return (language ?? "").toLowerCase().startsWith("fr")
    ? "_Certains chiffres de cette réponse n'ont pas pu être vérifiés dans tes données : vérifie-les dans le journal avant de t'y fier._"
    : "_Some figures in this answer could not be verified against your data — check them in your journal before relying on them._";
}
