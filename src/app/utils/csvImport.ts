/**
 * Import CSV — module PUR.
 *
 * POURQUOI CE MODULE. Toute la lecture d'un fichier broker (découpage,
 * normalisation des montants, des dates, des sens, devinette des colonnes,
 * détection des doublons) vivait à l'intérieur du composant React de la
 * modale. Elle n'était donc **pas testable** : le seul moyen de vérifier
 * qu'un montant `(1.234,56)` est bien lu comme `-1234.56` était d'ouvrir
 * l'application et d'essayer.
 *
 * L'import est le premier geste d'un nouvel inscrit et le seul qui écrit en
 * masse dans son journal. Une erreur de lecture ici fausse durablement toutes
 * ses statistiques. Ce code mérite des tests ; il est donc sorti ici, sans
 * changement de comportement, et la modale ne garde que l'affichage.
 */

import type { Trade } from "../types";
// `@/domain` et non `../store` : la façade du store importe le client
// Supabase, ce qui rendrait ce module impossible à tester hors navigateur —
// exactement le problème qu'il vient résoudre.
import { generateId } from "@/domain";

// ── Découpage ───────────────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const counts: [string, number][] = [",", ";", "\t"].map((d) => [
    d,
    firstLine.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/**
 * Lit un CSV en respectant les guillemets (un champ « notes » peut contenir
 * le séparateur ou un retour à la ligne) et le BOM des exports Windows.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let cur: string[] = [],
    field = "",
    inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((f) => f.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    if (cur.some((f) => f.trim() !== "")) rows.push(cur);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0].map((h) => h.trim()), rows: rows.slice(1) };
}

// ── Normalisation des valeurs ───────────────────────────────────────────────

/**
 * Montant broker → nombre. Gère `(123)` comptable = négatif, les symboles de
 * devise, le format européen `1.234,56` et l'anglo-saxon `1,234.56`.
 */
export function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$€£\s]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
    s = s.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (/^-?\d+,\d+$/.test(s))
    s = s.replace(",", "."); // 12,5
  else s = s.replace(/,/g, ""); // 1,234.56
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Date broker → `{ date: YYYY-MM-DD, time: HH:MM }`. */
export function parseDateTime(raw: string): { date: string; time: string } | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO / YYYY-MM-DD [HH:MM]
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : "" };
  // MM/DD/YYYY [HH:MM[:SS] [AM/PM]] — format par défaut des exports US
  m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?)?/,
  );
  if (m) {
    let hh = m[4] ? parseInt(m[4], 10) : 0;
    const ampm = m[6]?.toUpperCase();
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    return {
      date: `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
      time: m[4] ? `${String(hh).padStart(2, "0")}:${m[5]}` : "",
    };
  }
  return null;
}

export function parseDirection(raw: string): "long" | "short" | null {
  const s = raw.trim().toLowerCase();
  if (["long", "buy", "bot", "b", "l"].includes(s)) return "long";
  if (["short", "sell", "sld", "s", "sellshort"].includes(s)) return "short";
  return null;
}

// ── Correspondance des colonnes ─────────────────────────────────────────────

export type Field =
  | "date"
  | "symbol"
  | "direction"
  | "pnl"
  | "risk"
  | "rMultiple"
  | "entryTime"
  | "exitTime"
  | "strategy"
  | "slippage"
  | "notes";

export const FIELDS: Field[] = [
  "date",
  "symbol",
  "pnl",
  "direction",
  "entryTime",
  "exitTime",
  "risk",
  "rMultiple",
  "strategy",
  "slippage",
  "notes",
];

/** Sans date, symbole et P&L, une ligne n'est pas un trade. */
export const REQUIRED: Field[] = ["date", "symbol", "pnl"];

// Mots-clés d'en-tête par champ, testés dans l'ordre — couvre TradeVault,
// NinjaTrader, TradingView et TopStep(X) en plus des noms génériques.
const GUESSES: Record<Field, string[]> = {
  date: ["date", "enteredat", "entry time", "entrytime", "date/time", "datetime", "time", "opened"],
  symbol: ["symbol", "instrument", "contractname", "contract", "ticker", "market"],
  direction: ["direction", "side", "market pos", "marketpos", "type", "position"],
  pnl: ["p&l", "pnl", "profit", "net profit", "netprofit", "realized", "gain"],
  risk: ["risk"],
  rMultiple: ["r multiple", "rmultiple", "r-multiple", "r:r"],
  entryTime: ["entry time", "entrytime", "enteredat", "open time", "opened"],
  exitTime: ["exit time", "exittime", "exitedat", "close time", "closed"],
  strategy: ["strategy", "setup", "signal"],
  slippage: ["slippage", "fees", "commission"],
  notes: ["notes", "comment", "description"],
};

export function guessMapping(headers: string[]): Partial<Record<Field, number>> {
  const mapping: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  const lower = headers.map((h) => h.toLowerCase());
  for (const field of FIELDS) {
    for (const kw of GUESSES[field]) {
      const idx = lower.findIndex((h, i) => !used.has(i) && h.includes(kw));
      if (idx !== -1) {
        mapping[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return mapping;
}

/** Nom du broker reconnu, pour rassurer l'utilisateur sur ce qu'il importe. */
export function detectFormat(headers: string[]): string | null {
  const h = headers.map((x) => x.toLowerCase()).join("|");
  if (h.includes("market pos") || (h.includes("instrument") && h.includes("cum.")))
    return "NinjaTrader";
  if (h.includes("contractname") || (h.includes("enteredat") && h.includes("exitedat")))
    return "TopStep";
  if (h.includes("signal") && h.includes("contracts")) return "TradingView";
  if (h.includes("setup quality") && h.includes("confluences")) return "TradeVault";
  return null;
}

// ── Lignes → trades ─────────────────────────────────────────────────────────

/**
 * Convertit les lignes en trades selon la correspondance de colonnes.
 * Les lignes inexploitables sont comptées, jamais devinées : mieux vaut un
 * trade manquant qu'un trade faux dans les statistiques.
 */
export function mapRowsToTrades(
  rows: string[][],
  mapping: Partial<Record<Field, number>>,
): { valid: Trade[]; invalid: number } {
  const get = (row: string[], f: Field) => {
    const idx = mapping[f];
    return idx !== undefined ? (row[idx] ?? "").trim() : "";
  };
  const valid: Trade[] = [];
  let invalid = 0;
  for (const row of rows) {
    const dt = parseDateTime(get(row, "date"));
    const symbol = get(row, "symbol").toUpperCase().slice(0, 20);
    const pnl = parseMoney(get(row, "pnl"));
    if (!dt || !symbol || pnl === null) {
      invalid++;
      continue;
    }
    const entryDt = parseDateTime(get(row, "entryTime"));
    const exitDt = parseDateTime(get(row, "exitTime"));
    const risk = parseMoney(get(row, "risk"));
    const rRaw = parseMoney(get(row, "rMultiple"));
    const slippage = parseMoney(get(row, "slippage"));
    const riskAmount = risk !== null && risk > 0 ? risk : 0;
    valid.push({
      id: generateId(),
      date: dt.date,
      symbol,
      direction: parseDirection(get(row, "direction")) ?? "long",
      pnl: Math.round(pnl * 100) / 100,
      riskAmount,
      rMultiple:
        rRaw !== null ? rRaw : riskAmount > 0 ? Math.round((pnl / riskAmount) * 100) / 100 : 0,
      strategy: get(row, "strategy").slice(0, 50) || "Other",
      mistakes: [],
      setupQuality: 3,
      notes: get(row, "notes").slice(0, 10000),
      screenshots: [],
      entryTime: entryDt?.time || dt.time || "",
      exitTime: exitDt?.time || "",
      confluences: [],
      confidence: 50,
      mae: null,
      mfe: null,
      slippage: slippage !== null ? slippage : null,
    });
  }
  return { valid, invalid };
}

/**
 * Signature d'un trade pour la détection de doublons.
 *
 * Date + symbole + P&L + heure d'entrée : deux trades réellement distincts
 * partagent rarement les quatre. Réimporter le même fichier deux fois ne doit
 * pas doubler l'historique — c'est l'erreur la plus courante à l'import.
 */
export function tradeSignature(tr: Pick<Trade, "date" | "symbol" | "pnl" | "entryTime">): string {
  return `${tr.date}|${tr.symbol}|${tr.pnl}|${tr.entryTime}`;
}

/**
 * Sépare les trades à écrire des doublons — ceux déjà au journal ET ceux
 * répétés à l'intérieur du fichier lui-même.
 */
export function splitDuplicates(
  candidates: readonly Trade[],
  existing: readonly Pick<Trade, "date" | "symbol" | "pnl" | "entryTime">[],
): { fresh: Trade[]; duplicates: number } {
  const known = new Set(existing.map(tradeSignature));
  const fresh: Trade[] = [];
  let duplicates = 0;
  for (const tr of candidates) {
    const s = tradeSignature(tr);
    if (known.has(s)) {
      duplicates++;
      continue;
    }
    known.add(s);
    fresh.push(tr);
  }
  return { fresh, duplicates };
}

// ── Garde-fous sur le fichier ───────────────────────────────────────────────

/** Au-delà, le navigateur peinerait et ce n'est plus un export de journal. */
export const MAX_CSV_BYTES = 10 * 1024 * 1024;

export type FileRejection = "tooLarge" | "notCsv" | "empty" | "noHeaders";

/**
 * Vérifie un fichier AVANT lecture. Rend `null` s'il est acceptable.
 *
 * Sans ce contrôle, choisir un PDF ou un fichier vide ne produisait
 * strictement rien à l'écran : l'utilisateur croyait l'application figée.
 */
export function rejectFile(file: {
  name: string;
  size: number;
  type: string;
}): FileRejection | null {
  if (file.size === 0) return "empty";
  if (file.size > MAX_CSV_BYTES) return "tooLarge";
  const name = file.name.toLowerCase();
  const looksCsv =
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    file.type === "text/csv" ||
    file.type === "text/plain";
  return looksCsv ? null : "notCsv";
}
