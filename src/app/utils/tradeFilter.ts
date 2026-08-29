import { isBreakEven, type Trade } from "../types";
import { getSession, type TradingSession } from "./quantStats";
import { localDateOf } from "@/shared/calendar-date";

/**
 * FILTRE UNIFIÉ — la SEULE façon de filtrer les trades dans tout le produit.
 *
 * Journal, Analytics, Missed, Monte Carlo, Weekly Review et les deep-links de
 * Jarvis passent tous par ici. Une seule définition, une seule implémentation :
 * ajouter une dimension ici la rend disponible partout, sans recopier la
 * logique (qui finit toujours par diverger).
 *
 * Sérialisation : `encodeFilter` → chaîne compacte `k=v&k=v`, embarquée dans un
 * query param `?f=…` ; `decodeFilter` fait le chemin inverse. Les valeurs sont
 * encodées en URI, donc les symboles/setups avec espaces passent sans casse.
 *
 * Le filtre est volontairement PAUVRE en logique métier : `applyFilter` ne fait
 * que répondre « ce trade correspond-il ? ». Les métriques dérivées (win rate,
 * expectancy…) restent dans `computeStats`, appliquées AU SOUS-ENSEMBLE filtré —
 * jamais recalculées ici.
 */

export interface UnifiedFilter {
  /** Fenêtre de temps relative. */
  period?: "all" | "7d" | "30d" | "90d" | "1y";
  /** Jour de semaine, 0 = dimanche (convention `Date#getDay`). */
  weekday?: number;
  /** Instrument (ex: "NQ", "ES"). */
  symbol?: string;
  /** Sens : long / short / break-even. */
  direction?: "long" | "short" | "be";
  /** Résultat : win / loss / be (break-even). */
  result?: "win" | "loss" | "be";
  /** Setup (champ `strategy` du trade). */
  strategy?: string;
  /** Une erreur parmi `mistakes`. */
  mistake?: string;
  /** Session dérivée de l'heure d'entrée. */
  session?: TradingSession;
  /** Heure d'entrée (0..23). */
  hour?: number;
  /** Contexte séquentiel : le trade précédent (non-BE) était gagnant/perdant. */
  context?: "after_loss" | "after_win";
  /** Une confluence parmi `confluences`. */
  confluence?: string;
  /** Setup A+ : qualité maximale (setupQuality >= 5). */
  aplus?: boolean;
  /** Liste explicite d'ids (deep-link « voir les N trades »). */
  trades?: string[];
}

/** Seuil « A+ » — même définition que le badge émeraude du formulaire. */
export const APLUS_SETUP_QUALITY = 5;

const PERIODS = new Set(["all", "7d", "30d", "90d", "1y"]);
const DIRECTIONS = new Set(["long", "short", "be"]);
const RESULTS = new Set(["win", "loss", "be"]);
const SESSIONS = new Set(["asia", "london", "newyork"]);
const CONTEXTS = new Set(["after_loss", "after_win"]);

function isEmpty(f: UnifiedFilter): boolean {
  return Object.values(f).every((v) => v === undefined || v === false);
}

/** Normalise + écarte les champs invalides (une entrée corrompue ne doit jamais casser un filtre). */
export function sanitizeFilter(input: Partial<UnifiedFilter>): UnifiedFilter {
  const f: UnifiedFilter = {};
  if (input.period && PERIODS.has(input.period)) f.period = input.period as UnifiedFilter["period"];
  if (typeof input.weekday === "number" && input.weekday >= 0 && input.weekday <= 6)
    f.weekday = input.weekday;
  if (typeof input.symbol === "string" && input.symbol) f.symbol = input.symbol;
  if (input.direction && DIRECTIONS.has(input.direction))
    f.direction = input.direction as UnifiedFilter["direction"];
  if (input.result && RESULTS.has(input.result)) f.result = input.result as UnifiedFilter["result"];
  if (typeof input.strategy === "string" && input.strategy) f.strategy = input.strategy;
  if (typeof input.mistake === "string" && input.mistake) f.mistake = input.mistake;
  if (input.session && SESSIONS.has(input.session)) f.session = input.session as TradingSession;
  if (typeof input.hour === "number" && input.hour >= 0 && input.hour <= 23) f.hour = input.hour;
  if (input.context && CONTEXTS.has(input.context))
    f.context = input.context as UnifiedFilter["context"];
  if (typeof input.confluence === "string" && input.confluence) f.confluence = input.confluence;
  if (input.aplus === true) f.aplus = true;
  if (Array.isArray(input.trades) && input.trades.length)
    f.trades = input.trades.filter((id) => typeof id === "string" && id);
  return f;
}

function periodCutoff(period: NonNullable<UnifiedFilter["period"]>): string | null {
  const now = new Date();
  if (period === "all" || !period) return null;
  const d = new Date(now);
  if (period === "7d") d.setDate(d.getDate() - 7);
  else if (period === "30d") d.setDate(d.getDate() - 30);
  else if (period === "90d") d.setDate(d.getDate() - 90);
  else if (period === "1y") d.setFullYear(d.getFullYear() - 1);
  return localDateOf(d);
}

/** Tri chronologique stable — identique à `computeBehaviorSignals` (date seule),
 *  pour que le filtre `after_loss` désigne EXACTEMENT le même ensemble de trades
 *  que le détecteur qui a produit le claim. Pas de seconde définition. */
function byDate(a: Trade, b: Trade): number {
  return a.date.localeCompare(b.date);
}

function weekdayOf(date: string): number | null {
  const d = new Date(date + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d.getDay();
}

function hourOf(entryTime: string): number | null {
  const [h] = entryTime.split(":").map(Number);
  return Number.isFinite(h) ? h : null;
}

/**
 * Filtre la liste. Seule fonction publique de filtrage — pas de seconde
 * implémentation ailleurs.
 */
export function applyFilter(trades: Trade[], input: Partial<UnifiedFilter>): Trade[] {
  const f = sanitizeFilter(input);
  if (isEmpty(f)) return trades;

  const explicit = f.trades ? new Set(f.trades) : null;

  // Contextes séquentiels : précalculer l'ensemble des ids "après perte/gain".
  // Même règle que `computeBehaviorSignals` : le trade IMMÉDIATEMENT précédent
  // (dans l'ordre date, stable) — un BE précédent ne « colore » pas.
  let afterLoss: Set<string> | null = null;
  let afterWin: Set<string> | null = null;
  if (f.context) {
    afterLoss = new Set();
    afterWin = new Set();
    const sorted = [...trades].sort(byDate);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const afterDecisive = !!prev && !isBreakEven(prev);
      if (afterDecisive && prev.pnl < 0) afterLoss.add(sorted[i].id);
      else if (afterDecisive && prev.pnl > 0) afterWin.add(sorted[i].id);
    }
  }

  const cutoff = f.period ? periodCutoff(f.period) : null;

  return trades.filter((t) => {
    if (explicit && !explicit.has(t.id)) return false;
    if (cutoff && t.date < cutoff) return false;
    if (f.weekday !== undefined && weekdayOf(t.date) !== f.weekday) return false;
    if (f.symbol && t.symbol !== f.symbol) return false;
    if (f.direction && t.direction !== f.direction) return false;
    if (f.result) {
      const isWin = !isBreakEven(t) && t.pnl > 0;
      const isLoss = !isBreakEven(t) && t.pnl < 0;
      const isBE = isBreakEven(t);
      if (f.result === "win" && !isWin) return false;
      if (f.result === "loss" && !isLoss) return false;
      if (f.result === "be" && !isBE) return false;
    }
    if (f.strategy && t.strategy !== f.strategy) return false;
    if (f.mistake && !t.mistakes.includes(f.mistake)) return false;
    if (f.session && getSession(t.entryTime) !== f.session) return false;
    if (f.hour !== undefined && hourOf(t.entryTime) !== f.hour) return false;
    if (f.confluence && !t.confluences.includes(f.confluence)) return false;
    if (f.aplus && t.setupQuality < APLUS_SETUP_QUALITY) return false;
    if (f.context === "after_loss" && afterLoss && !afterLoss.has(t.id)) return false;
    if (f.context === "after_win" && afterWin && !afterWin.has(t.id)) return false;
    return true;
  });
}

/* ── Sérialisation ── */

const ORDER: (keyof UnifiedFilter)[] = [
  "period",
  "weekday",
  "symbol",
  "direction",
  "result",
  "strategy",
  "mistake",
  "session",
  "hour",
  "context",
  "confluence",
  "aplus",
  "trades",
];

/** Chaîne compacte `k=v&k=v`, valeurs encodées en URI. */
export function encodeFilter(input: Partial<UnifiedFilter>): string {
  const f = sanitizeFilter(input);
  const parts: string[] = [];
  for (const key of ORDER) {
    const v = f[key];
    if (v === undefined || v === false) continue;
    if (key === "aplus") {
      parts.push("aplus");
      continue;
    }
    if (key === "trades") {
      parts.push(`trades=${encodeURIComponent((v as string[]).join(","))}`);
      continue;
    }
    parts.push(`${key}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

/** Décodage inverse, tolérant aux entrées corrompues. */
export function decodeFilter(raw: string | null | undefined): UnifiedFilter {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    const val = eq === -1 ? "" : decodeURIComponent(part.slice(eq + 1));
    if (key === "aplus") {
      out.aplus = true;
      continue;
    }
    if (key === "weekday" || key === "hour") {
      const n = Number(val);
      out[key] = Number.isFinite(n) ? n : undefined;
      continue;
    }
    if (key === "trades") {
      out.trades = val.split(",").filter(Boolean);
      continue;
    }
    out[key] = val;
  }
  return sanitizeFilter(out);
}
