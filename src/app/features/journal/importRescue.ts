/**
 * Récupération prudente de CSV et conversion des EXÉCUTIONS TradingView.
 * Sans appel réseau/IA, sans positions ou P&L inventés.
 * Les scénarios ambigus restent visibles et exigent une décision humaine.
 */
import type { Trade } from "@/app/types";
import { generateId } from "@/domain";
import { parseCsv, parseDateTime, parseMoney } from "./csvImport";

export interface RescuedCsv {
  headers: string[];
  rows: string[][];
  warnings: string[];
  discarded: number;
  recovered: boolean;
}

const cleanHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const column = (headers: string[], names: string[]) =>
  headers.findIndex((h) => names.includes(cleanHeader(h)));

export function isTradingViewOrders(headers: string[]): boolean {
  return [
    ["symbol"], ["side"], ["quantity"], ["fillprice"], ["status"],
  ].every((names) => column(headers, names) >= 0) &&
    column(headers, ["closingtime", "executiontime"]) >= 0;
}

/** Une ligne de récupération n'est acceptée que si ses guillemets se ferment.
 * Ne répare jamais un chiffre en devinant un caractère manquant. */
function parsePhysicalLine(line: string, separator: string): string[] | null {
  const out: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === separator && !quoted) {
      out.push(value); value = "";
    } else value += c;
  }
  if (quoted) return null;
  out.push(value);
  return out.map((s) => s.trim());
}

/** Parse normalement d'abord (les vrais champs CSV multilignes sont valides).
 * Bascule sur une récupération ligne à ligne si les lignes sont massivement
 * malformées ; les lignes douteuses sont écartées et comptées. */
export function parseCsvWithRescue(input: string): RescuedCsv {
  const text = input.replace(/^\uFEFF/, "").replace(/\u0000/g, "");
  const standard = parseCsv(text);
  const lines = text.split(/\r\n|\r|\n/).filter((s) => s.trim());
  const width = standard.headers.length;
  const malformed = standard.rows.filter((r) => r.length !== width).length;
  const usable = width >= 2 && standard.rows.length > 0;
  if (usable && malformed === 0 && standard.rows.length >= Math.floor(lines.length * 0.65) - 1) {
    return { ...standard, warnings: [], discarded: 0, recovered: false };
  }
  if (lines.length === 0) return { headers: [], rows: [], warnings: [], discarded: 0, recovered: false };

  const sep = [",", ";", "\t"].sort((a, b) =>
    lines.slice(0, 12).reduce((n, x) => n + x.split(b).length - 1, 0) -
    lines.slice(0, 12).reduce((n, x) => n + x.split(a).length - 1, 0)
  )[0];
  const candidates = lines.map((line) => parsePhysicalLine(line, sep));
  // Une ligne d'en-tête reconnaissable prévaut sur une première ligne parasite.
  const score = (fields: string[] | null) => fields
    ? fields.filter((v) => /^(date|symbol|symbole|pnl|profit|side|quantity|fill price|status|closing time|instrument|timestamp)$/i.test(v.trim())).length
    : -1;
  let headerIndex = candidates.findIndex((f) => f && f.length >= 2 && score(f) >= 2);
  if (headerIndex < 0) headerIndex = candidates.findIndex((f) => f && f.length >= 2);
  if (headerIndex < 0) return {
    headers: [], rows: [], warnings: ["Aucune structure tabulaire lisible dans le fichier."],
    discarded: lines.length, recovered: true,
  };
  const headers = candidates[headerIndex]!;
  const rows: string[][] = [];
  let discarded = headerIndex;
  for (const record of candidates.slice(headerIndex + 1)) {
    if (record && record.length === headers.length) rows.push(record);
    else discarded++;
  }
  return {
    headers, rows, discarded, recovered: true,
    warnings: [
      "Le fichier présentait des lignes endommagées : seules les colonnes et lignes lisibles ont été conservées.",
      ...(discarded ? [discarded + " ligne(s) écartée(s), à vérifier dans le fichier original."] : []),
    ],
  };
}

/** Décodage local, UTF-8 et UTF-16 de certains exports Windows. */
export function decodeImportBuffer(buffer: ArrayBuffer): { text: string; warning?: string } {
  const bytes = new Uint8Array(buffer);
  let encoding = "utf-8", skip = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = "utf-16le"; skip = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = "utf-16be"; skip = 2; }
  else if (bytes.length >= 8) {
    const evenNulls = bytes.slice(0, 4000).filter((b, i) => i % 2 === 0 && b === 0).length;
    const oddNulls = bytes.slice(0, 4000).filter((b, i) => i % 2 === 1 && b === 0).length;
    if (oddNulls >= 4 && oddNulls > evenNulls * 3) encoding = "utf-16le";
    else if (evenNulls >= 4 && evenNulls > oddNulls * 3) encoding = "utf-16be";
  }
  const text = new TextDecoder(encoding, { fatal: false }).decode(bytes.slice(skip));
  const nulCount = (text.match(/\u0000/g) || []).length;
  if (text.length && nulCount / text.length > 0.02) throw new Error("binaryFile");
  return {
    text,
    warning: text.includes("\uFFFD") ? "Certains caractères sont illisibles ; vérifie les valeurs récupérées." : undefined,
  };
}

export type PointValues = Record<string, number>;
export interface AnchorCandidate { symbol: string; quantity: number; initialExecutions: number }
export interface OrderAnalysis {
  trades: Trade[];
  missingMultipliers: string[];
  anchors: AnchorCandidate[];
  warnings: string[];
  skipped: number;
  unmatched: number;
  filled: number;
  matched: number;
}

const FUTURES: Record<string, number> = {
  NQ: 20, MNQ: 2, ES: 50, MES: 5, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
};
export function suggestedPointValue(symbol: string): number | null {
  // Le préfixe CME_MINI/COMEX/CBOT est nécessaire : un CFD "US100" n'est pas NQ.
  if (!/^(CME|CBOT|COMEX|NYMEX)[_:]/i.test(symbol)) return null;
  const ticker = symbol.split(":").pop()?.match(/^[A-Z]+/)?.[0] || "";
  for (const k of Object.keys(FUTURES).sort((a,b) => b.length - a.length)) {
    if (ticker.startsWith(k)) return FUTURES[k];
  }
  return null;
}

interface Fill {
  symbol: string; side: 1 | -1; qty: number; price: number;
  date: string; time: string; id: string; fee: number | null;
}
const num = (s: string): number | null => {
  const raw = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function analyzeTradingViewOrders(
  headers: string[],
  rows: string[][],
  pointValues: PointValues,
  acceptedAnchors: readonly string[] = [],
): OrderAnalysis {
  const idx = (name: string) => column(headers, [name]);
  if (!isTradingViewOrders(headers)) return {
    trades: [], missingMultipliers: [], anchors: [],
    warnings: ["Les colonnes obligatoires de l'historique d'ordres sont manquantes."],
    skipped: rows.length, unmatched: 0, filled: 0, matched: 0,
  };
  const get = (row: string[], name: string) => (row[idx(name)] || "").trim();
  const groups = new Map<string, Fill[]>();
  let skipped = 0, filled = 0;
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (get(row, "status").toLowerCase() !== "filled") { skipped++; continue; }
    filled++;
    const symbol = get(row, "symbol").toUpperCase();
    const sideRaw = get(row, "side").toLowerCase();
    const side = sideRaw === "buy" ? 1 : sideRaw === "sell" ? -1 : null;
    const qty = num(get(row, "quantity"));
    const price = num(get(row, "fillprice"));
    const timestamp = get(row, "closingtime");
    const dt = parseDateTime(timestamp);
    const id = get(row, "orderid");
    const key = symbol + ":" + (id || timestamp + ":" + sideRaw + ":" + qty + ":" + price);
    if (!symbol || !side || !qty || qty <= 0 || price === null || price <= 0 || !dt ||
        !dt.time || seen.has(key)) {
      skipped++;
      warnings.push("Une exécution Filled est incomplète ou dupliquée et n'a pas été reconstruite.");
      continue;
    }
    seen.add(key);
    const commission = idx("commission") >= 0 ? parseMoney(get(row, "commission")) : null;
    const fill: Fill = { symbol, side, qty, price, date: dt.date, time: timestamp, id,
      fee: commission === null ? null : Math.abs(commission) };
    groups.set(symbol, [...(groups.get(symbol) || []), fill]);
  }
  const trades: Trade[] = [];
  const missingMultipliers: string[] = [];
  const anchors: AnchorCandidate[] = [];
  let unmatched = 0, matched = 0;
  for (const [symbol, fills] of groups) {
    fills.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
    const pointValue = pointValues[symbol];
    if (!(Number.isFinite(pointValue) && pointValue > 0)) missingMultipliers.push(symbol);

    // Détecte un éventuel ordre isolé au début de l'historique : si le
    // bilan signé final est aussi le niveau "flat" dominant, afficher
    // l'hypothèse. Ne l'appliquer que sur confirmation explicite.
    let cumul = 0;
    const counts = new Map<number, number>([[0, 1]]);
    const firstAt = new Map<number, number>();
    for (let i = 0; i < fills.length; i++) {
      cumul = Math.round((cumul + fills[i].side * fills[i].qty) * 1e7) / 1e7;
      counts.set(cumul, (counts.get(cumul) || 0) + 1);
      if (!firstAt.has(cumul)) firstAt.set(cumul, i);
    }
    const candidate = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const proposedOffset = candidate?.[0] || 0;
    const firstIndex = firstAt.get(proposedOffset) ?? -1;
    const plausibleAnchor = proposedOffset !== 0 && Math.abs(cumul - proposedOffset) < 1e-7 &&
      firstIndex >= 0 && firstIndex < 3 &&
      (counts.get(proposedOffset) || 0) >= 3 * (counts.get(0) || 1);
    if (plausibleAnchor) anchors.push({
      symbol, quantity: proposedOffset, initialExecutions: firstIndex + 1,
    });
    const ignoreUntil = plausibleAnchor && acceptedAnchors.includes(symbol) ? firstIndex + 1 : 0;
    if (ignoreUntil) {
      unmatched += ignoreUntil;
      warnings.push(symbol + " : " + ignoreUntil + " exécution(s) initiale(s) exclue(s) avec ton accord (position antérieure inconnue).");
    }

    let pos = 0, entrySide: 1 | -1 = 1;
    let entryNotional = 0, exitNotional = 0, entryQty = 0, exitQty = 0;
    let start = "", end = "", ids: string[] = [], fees = 0, allFees = true;
    let cycleFills = 0;
    const finish = () => {
      if (entryQty <= 0 || Math.abs(entryQty - exitQty) > 1e-5) return;
      const dt = parseDateTime(end);
      if (dt && pointValue > 0 && Number.isFinite(pointValue)) {
        const gross = (exitNotional - entryNotional) * entrySide * pointValue;
        const pnl = round(gross - (allFees ? fees : 0));
        trades.push({
          id: generateId(), date: dt.date, symbol,
          direction: entrySide === 1 ? "long" : "short",
          pnl, riskAmount: 0, rMultiple: 0, strategy: "Other",
          mistakes: [], setupQuality: 3, notes:
            "TradingView Paper Trading | " +
            (allFees ? "P&L net des commissions renseignées" : "P&L BRUT estimé ; commissions manquantes") +
            " | Valeur du point : " + pointValue +
            " | Exécutions : " + ids.join(" / ") +
            " | Horaires conservés tels qu'exportés (fuseau non vérifié).",
          screenshots: [], entryTime: start.slice(0, 16).replace(" ", "T"),
          exitTime: end.slice(0, 16).replace(" ", "T"),
          confluences: [], confidence: 50, mae: null, mfe: null, slippage: null,
          quantity: entryQty, entryPrice: entryNotional / entryQty,
          exitPrice: exitNotional / exitQty, fees: allFees ? round(fees) : null,
          broker: "TradingView Paper Trading", externalId: ids.join("-") || null,
          reviewPending: true,
        });
        matched += cycleFills;
      } else {
        unmatched += cycleFills;
      }
      pos = 0; entryNotional = 0; exitNotional = 0;
      entryQty = 0; exitQty = 0; ids = []; fees = 0; allFees = true;
      start = ""; end = ""; cycleFills = 0;
    };
    for (const f of fills.slice(ignoreUntil)) {
      let remaining = f.qty;
      while (remaining > 1e-7) {
        if (Math.abs(pos) < 1e-7) {
          entrySide = f.side; start = f.time;
        }
        const opens = Math.abs(pos) < 1e-7 || Math.sign(pos) === f.side;
        const units = opens ? remaining : Math.min(remaining, Math.abs(pos));
        if (opens) {
          pos += f.side * units;
          entryQty += units; entryNotional += units * f.price;
        } else {
          pos += f.side * units;
          exitQty += units; exitNotional += units * f.price;
          end = f.time;
        }
        ids.push(f.id || f.time);
        cycleFills++;
        if (f.fee === null) allFees = false;
        else fees += f.fee * (units / f.qty);
        remaining -= units;
        if (Math.abs(pos) < 1e-7) finish();
      }
    }
    if (Math.abs(pos) > 1e-7) {
      unmatched += cycleFills;
      warnings.push(symbol + " : position encore ouverte / historique tronqué ; aucune clôture inventée.");
    }
  }
  if (missingMultipliers.length) warnings.push("Renseigne la valeur du point des instruments inconnus avant de calculer leur P&L.");
  if (anchors.some((a) => !acceptedAnchors.includes(a.symbol))) {
    warnings.push("Historique possiblement tronqué : vérifie les exécutions initiales proposées avant de les exclure.");
  }
  return { trades, missingMultipliers, anchors, warnings: [...new Set(warnings)],
    skipped, unmatched, filled, matched };
}
