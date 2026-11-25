/**
 * LE MOTEUR DE CAPTURE — le contrat et la normalisation, module PUR.
 *
 * Une capture (screenshot TradingView, position, note, dictée) passe par UN
 * seul chemin : l'IA lit ce qui est VISIBLE (ou écrit), puis ce module décide
 * de ce qui est gardé. Il ne fait confiance à rien : chaque valeur arrive avec
 * sa confiance, son origine et, quand c'est possible, l'extrait qui la prouve.
 *
 * Règles (testées dans `capture.test.ts`) :
 *   • une valeur au mauvais format devient INCONNUE, jamais devinée ;
 *   • « vérifié » ne vient jamais de l'IA seule — c'est l'état d'une valeur
 *     confirmée par le trader ou par une source déterministe ;
 *   • un champ tiré d'une NOTE doit citer un extrait réellement présent dans
 *     la note, sinon il est rejeté (aucun fait absent du texte) ;
 *   • des niveaux incohérents (stop au-dessus de l'entrée d'un long…) passent
 *     « à revoir » au lieu d'être crus ;
 *   • une confluence reconnue visuellement n'est jamais une validation ICT :
 *     elle est « confirmée visuellement », « probable », « non détectée » ou
 *     « non vérifiable », et le trader tranche.
 *
 * Les calculs (contrat, risque, R, durée, bougies, session) vivent dans
 * `captureEnrich.ts` : l'IA ne calcule rien.
 */

import { futuresSpecFor } from "./futuresContracts";

/** Change quand le prompt ou la normalisation change : invalide le cache. */
export const CAPTURE_VERSION = 1;

/** Plafonds d'une analyse — partagés par le client et le serveur. */
export const CAPTURE_LIMITS = {
  maxImages: 4,
  maxImageBytes: 4 * 1024 * 1024,
  maxNoteChars: 4000,
} as const;

export type Confidence = "verified" | "high" | "estimated" | "needs_review" | "unknown";
export type FieldOrigin = "image" | "note" | "context" | "calculated";

export interface CapturedField<T> {
  value: T | null;
  confidence: Confidence;
  origin: FieldOrigin;
  /** Ce qui prouve la valeur : texte lu sur l'image, extrait de la note… */
  evidence?: string;
}

export const CONFLUENCE_KEYS = [
  "liquidity_sweep",
  "displacement",
  "mss",
  "cisd",
  "fvg",
  "ifvg",
  "order_block",
  "breaker",
  "premium_discount",
  "pd_array",
  "killzone",
  "silver_bullet",
  "htf_level",
  "session_high_low",
  "previous_day_level",
  "previous_week_level",
] as const;
export type ConfluenceKey = (typeof CONFLUENCE_KEYS)[number];

export type ConfluenceState = "visual_confirmed" | "probable" | "not_detected" | "unverifiable";

export interface CapturedConfluence {
  key: ConfluenceKey;
  state: ConfluenceState;
  evidence?: string;
}

/** Le libellé court d'une confluence, tel qu'un trader ICT l'écrit dans ses puces. */
export const CONFLUENCE_LABELS: Record<ConfluenceKey, string> = {
  liquidity_sweep: "Liquidity Sweep",
  displacement: "Displacement",
  mss: "MSS",
  cisd: "CISD",
  fvg: "FVG",
  ifvg: "IFVG",
  order_block: "Order Block",
  breaker: "Breaker",
  premium_discount: "Premium/Discount",
  pd_array: "PD Array",
  killzone: "Killzone",
  silver_bullet: "Silver Bullet",
  htf_level: "HTF Level",
  session_high_low: "Session High/Low",
  previous_day_level: "PDH/PDL",
  previous_week_level: "PWH/PWL",
};

/** Unités de temps reconnues, en minutes. */
export const TIMEFRAME_MINUTES: Record<string, number> = {
  "1m": 1,
  "2m": 2,
  "3m": 3,
  "5m": 5,
  "10m": 10,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "2h": 120,
  "4h": 240,
  "1d": 1440,
};

export type CaptureOutcome = "target" | "stop" | "manual" | "open";

export interface CaptureExtraction {
  version: number;
  target: "trade" | "missed";
  date: CapturedField<string>;
  symbol: CapturedField<string>;
  direction: CapturedField<"long" | "short">;
  timeframe: CapturedField<string>;
  /** Fuseau d'affichage du graphique (IANA), quand l'axe ou l'en-tête le montre. */
  chartTimezone: CapturedField<string>;
  entryPrice: CapturedField<number>;
  exitPrice: CapturedField<number>;
  stopPrice: CapturedField<number>;
  targetPrice: CapturedField<number>;
  quantity: CapturedField<number>;
  /** Heures `HH:MM` dans le fuseau du graphique (converties en ET par l'enrichissement). */
  entryTime: CapturedField<string>;
  exitTime: CapturedField<string>;
  /** Plage plausible quand l'heure n'est qu'estimée depuis l'axe. */
  entryWindow: { from: string; to: string } | null;
  exitWindow: { from: string; to: string } | null;
  outcome: CapturedField<CaptureOutcome>;
  setup: CapturedField<string>;
  confluences: CapturedConfluence[];
  /** Une phrase neutre de ce que montre la capture — jamais un jugement. */
  summary: string | null;
  /** Codes stables (`levels_incoherent`, `timezone_unknown`…) traduits par l'UI. */
  warnings: string[];
}

export type CaptureWarning =
  | "levels_incoherent"
  | "timezone_unknown"
  | "exit_before_entry"
  | "future_date"
  | "note_evidence_missing"
  | "symbol_unrecognized"
  | "multiple_timeframes";

// ── Lecture défensive de la sortie brute du modèle ─────────────────────────

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);

/** La confiance déclarée par le modèle → notre échelle. « verified » est refusé. */
export function modelConfidence(v: unknown): Confidence {
  switch (typeof v === "string" ? v.toLowerCase() : "") {
    case "high":
      return "high";
    case "medium":
      return "estimated";
    case "low":
      return "needs_review";
    default:
      return "unknown";
  }
}

const RANK: Record<Confidence, number> = {
  unknown: 0,
  needs_review: 1,
  estimated: 2,
  high: 3,
  verified: 4,
};

/** La plus faible de plusieurs confiances : un calcul ne vaut que son entrée la moins sûre. */
export function weakest(...cs: Confidence[]): Confidence {
  return cs.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), "verified" as Confidence);
}

export function downgrade(c: Confidence, to: Confidence): Confidence {
  return RANK[to] < RANK[c] ? to : c;
}

const unknownField = <T>(origin: FieldOrigin = "image"): CapturedField<T> => ({
  value: null,
  confidence: "unknown",
  origin,
});

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function cleanEvidence(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, 200);
  return s || undefined;
}

function readField<T>(
  raw: unknown,
  parse: (v: unknown) => T | null,
  note: string | null,
): CapturedField<T> {
  if (!isObj(raw)) return unknownField();
  const value = parse(raw.value);
  if (value === null) return unknownField();
  const origin: FieldOrigin = raw.source === "note" ? "note" : "image";
  const evidence = cleanEvidence(raw.evidence);
  // Un champ « lu dans la note » doit citer la note mot pour mot.
  if (origin === "note" && (!note || !evidence || !squash(note).includes(squash(evidence)))) {
    return { value: null, confidence: "unknown", origin: "note" };
  }
  return { value, confidence: modelConfidence(raw.confidence), origin, evidence };
}

export function parsePrice(v: unknown): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[\s,]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : null;
}

export function parseHhmm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^([01]?\d|2[0-3])[:h]([0-5]\d)$/.exec(v.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

export function parseDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

export function parseTimeframe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/\s+/g, "");
  if (TIMEFRAME_MINUTES[s]) return s;
  // « 5 », « 15 » (TradingView écrit les minutes sans unité), « 1H », « D ».
  if (/^\d+$/.test(s) && TIMEFRAME_MINUTES[`${s}m`]) return `${s}m`;
  if (s === "d" || s === "1d" || s === "daily") return "1d";
  const hour = /^(\d+)h$/.exec(s);
  if (hour && TIMEFRAME_MINUTES[`${hour[1]}h`]) return `${hour[1]}h`;
  return null;
}

/** IANA valide, `UTC` ou `UTC±H` (→ `Etc/GMT∓H`, la convention inversée d'IANA). */
export function parseTimezone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  const offset = /^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})$/i.exec(s);
  if (offset) {
    const h = Number(offset[2]);
    if (h > 14) return null;
    return h === 0 ? "UTC" : `Etc/GMT${offset[1] === "+" ? "-" : "+"}${h}`;
  }
  if (/^(utc|gmt)$/i.test(s)) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: s });
    return s;
  } catch {
    return null;
  }
}

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (v: unknown): T | null =>
    typeof v === "string" && (list as readonly string[]).includes(v.toLowerCase())
      ? (v.toLowerCase() as T)
      : null;

function parseWindow(raw: unknown): { from: string; to: string } | null {
  if (!isObj(raw)) return null;
  const from = parseHhmm(raw.from);
  const to = parseHhmm(raw.to);
  return from && to ? { from, to } : null;
}

const CONFLUENCE_STATES: readonly ConfluenceState[] = [
  "visual_confirmed",
  "probable",
  "not_detected",
  "unverifiable",
];

function readConfluences(raw: unknown): CapturedConfluence[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CapturedConfluence[] = [];
  for (const c of raw) {
    if (!isObj(c)) continue;
    const key = oneOf(CONFLUENCE_KEYS)(c.key);
    const state = oneOf(CONFLUENCE_STATES)(c.state);
    if (!key || !state || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, state, evidence: cleanEvidence(c.evidence) });
  }
  return out;
}

export interface NormalizeContext {
  target: "trade" | "missed";
  note: string | null;
  /** La date civile du trader aujourd'hui (`todayLocalDate()`), pour refuser le futur. */
  today: string;
}

/**
 * La sortie BRUTE du modèle (déjà parsée en JSON) → une extraction sûre.
 * Ne lève jamais : un objet illisible donne une extraction vide.
 */
export function normalizeExtraction(raw: unknown, ctx: NormalizeContext): CaptureExtraction {
  const r = isObj(raw) ? raw : {};
  const note = ctx.note;
  const warnings = new Set<CaptureWarning>();

  const date = readField(r.date, parseDate, note);
  if (date.value && date.value > ctx.today) {
    warnings.add("future_date");
    date.value = null;
    date.confidence = "unknown";
  }

  const symbol = readField(
    r.symbol,
    (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase().slice(0, 24) : null),
    note,
  );
  if (symbol.value) {
    const spec = futuresSpecFor(symbol.value);
    if (spec) symbol.value = spec.symbol;
    else {
      warnings.add("symbol_unrecognized");
      symbol.confidence = downgrade(symbol.confidence, "needs_review");
    }
  }

  const direction = readField(r.direction, oneOf(["long", "short"] as const), note);
  const timeframe = readField(r.timeframe, parseTimeframe, note);
  if (r.multipleTimeframes === true) {
    warnings.add("multiple_timeframes");
    timeframe.confidence = downgrade(timeframe.confidence, "needs_review");
  }
  const chartTimezone = readField(r.chartTimezone, parseTimezone, note);
  const entryPrice = readField(r.entryPrice, parsePrice, note);
  const exitPrice = readField(r.exitPrice, parsePrice, note);
  const stopPrice = readField(r.stopPrice, parsePrice, note);
  const targetPrice = readField(r.targetPrice, parsePrice, note);
  const quantity = readField(
    r.quantity,
    (v) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
    },
    note,
  );
  const entryTime = readField(r.entryTime, parseHhmm, note);
  const exitTime = readField(r.exitTime, parseHhmm, note);
  const outcome = readField(r.outcome, oneOf(["target", "stop", "manual", "open"] as const), note);
  const setup = readField(
    r.setup,
    (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null),
    note,
  );

  // Les niveaux doivent être du BON côté de l'entrée ; sinon on ne les croit pas.
  const side = direction.value;
  const e = entryPrice.value;
  const bad = (p: number | null, below: boolean) =>
    p != null && e != null && (below ? p >= e : p <= e);
  if (side && e != null) {
    const long = side === "long";
    if (bad(stopPrice.value, long) || bad(targetPrice.value, !long)) {
      warnings.add("levels_incoherent");
      stopPrice.confidence = downgrade(stopPrice.confidence, "needs_review");
      targetPrice.confidence = downgrade(targetPrice.confidence, "needs_review");
    }
  }

  if ((entryTime.value || exitTime.value) && !chartTimezone.value) {
    warnings.add("timezone_unknown");
  }
  if (entryTime.value && exitTime.value && exitTime.value < entryTime.value) {
    // Peut être une position de nuit : signalé, jamais corrigé en silence.
    warnings.add("exit_before_entry");
  }

  const fields = [
    date,
    symbol,
    direction,
    timeframe,
    entryPrice,
    exitPrice,
    stopPrice,
    targetPrice,
    quantity,
    entryTime,
    exitTime,
    outcome,
    setup,
  ];
  if (
    isObj(r) &&
    Object.values(r).some((v) => isObj(v) && v.source === "note") &&
    fields.some((f) => f.origin === "note" && f.value === null)
  ) {
    warnings.add("note_evidence_missing");
  }

  return {
    version: CAPTURE_VERSION,
    target: ctx.target,
    date,
    symbol,
    direction,
    timeframe,
    chartTimezone,
    entryPrice,
    exitPrice,
    stopPrice,
    targetPrice,
    quantity,
    entryTime,
    exitTime,
    entryWindow: parseWindow(r.entryWindow),
    exitWindow: parseWindow(r.exitWindow),
    outcome,
    setup,
    confluences: readConfluences(r.confluences),
    summary:
      typeof r.summary === "string" && r.summary.trim() ? r.summary.trim().slice(0, 280) : null,
    warnings: [...warnings],
  };
}

/** Une extraction sans aucune valeur — ce qu'on rend quand l'IA n'a rien pu lire. */
export function emptyExtraction(target: "trade" | "missed"): CaptureExtraction {
  return normalizeExtraction({}, { target, note: null, today: "9999-12-31" });
}

/** Au moins une valeur exploitable ? (sinon l'UI dit « rien de lisible »). */
export function hasAnyValue(x: CaptureExtraction): boolean {
  return (
    [
      x.date,
      x.symbol,
      x.direction,
      x.timeframe,
      x.entryPrice,
      x.exitPrice,
      x.stopPrice,
      x.targetPrice,
      x.quantity,
      x.entryTime,
      x.exitTime,
      x.outcome,
      x.setup,
    ].some((f) => f.value !== null) || x.confluences.some((c) => c.state !== "not_detected")
  );
}
