/**
 * D'UNE CAPTURE À UN FORMULAIRE — ce que le moteur propose, et ce qu'il a le
 * droit d'écrire.
 *
 * Une proposition par champ du formulaire de trade (ou de setup manqué), avec
 * sa nature : DÉTECTÉE (lue clairement), CALCULÉE (formule déterministe),
 * ESTIMÉE (lue sur un axe, déduite d'un fuseau supposé), À REVOIR (douteuse).
 *
 * Écrire n'est permis que dans un champ VIDE (égal à sa valeur par défaut) :
 * ce que le trader a déjà saisi n'est jamais écrasé — une valeur différente
 * devient un CONFLIT qu'il tranche. Une proposition « à revoir » n'est jamais
 * appliquée d'office. Les confluences s'AJOUTENT, aucune n'est retirée.
 *
 * Module pur (aucun React) : testé dans `tests/capturePrefill.test.ts`.
 */

import {
  CONFLUENCE_LABELS,
  type CaptureExtraction,
  type CapturedField,
  type Confidence,
} from "@/domain/capture";
import type { CaptureDerived } from "@/domain/captureEnrich";

/** Les champs du formulaire de trade (`TradeModal`) que la capture sait remplir. */
export interface TradeFormSlice {
  date: string;
  symbol: string;
  direction: "long" | "short" | "be";
  entryTime: string;
  exitTime: string;
  entryPrice: string;
  exitPrice: string;
  initialStop: string;
  initialTarget: string;
  quantity: string;
  riskAmount: string;
  rMultiple: string;
  strategy: string;
  confluences: string[];
}
export type TradeFormField = keyof TradeFormSlice;

export type ProposalKind = "detected" | "calculated" | "estimated" | "needs_review";

export interface Proposal<F extends string = TradeFormField> {
  field: F;
  value: string | string[];
  kind: ProposalKind;
  confidence: Confidence;
  evidence?: string;
}

export function kindOf(
  f: Pick<CapturedField<unknown>, "origin" | "confidence">,
): ProposalKind | null {
  if (f.confidence === "unknown") return null;
  if (f.confidence === "needs_review") return "needs_review";
  // Un calcul fait sur une valeur estimée reste une estimation.
  if (f.confidence === "estimated") return "estimated";
  return f.origin === "calculated" ? "calculated" : "detected";
}

const num = (n: number) => String(Math.round(n * 10000) / 10000);

/** Le libellé d'une confluence dans le vocabulaire du trader quand il l'a déjà. */
function confluenceLabel(label: string, known: readonly string[]): string {
  const k = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  return known.find((c) => c.toLowerCase().replace(/[^a-z0-9]/g, "") === k) ?? label;
}

export interface ProposalContext {
  /** Setups connus (plan + liste) : un setup lu n'est proposé que s'il en fait partie. */
  strategies: readonly string[];
  /** Confluences déjà employées par le trader. */
  confluences: readonly string[];
}

export function tradeProposals(
  x: CaptureExtraction,
  d: CaptureDerived,
  ctx: ProposalContext,
): Proposal[] {
  const out: Proposal[] = [];
  const push = <T>(field: TradeFormField, f: CapturedField<T>, fmt: (v: T) => string) => {
    const kind = kindOf(f);
    if (f.value === null || !kind) return;
    out.push({ field, value: fmt(f.value), kind, confidence: f.confidence, evidence: f.evidence });
  };
  const str = (v: string) => v;

  // Date et heures : LUES sur la capture, seulement ramenées à l'heure de New York.
  push("date", { ...d.dateEt, origin: x.date.origin }, str);
  push("symbol", x.symbol, str);
  push("direction", x.direction, str);
  push("entryTime", { ...d.entryTimeEt, origin: x.entryTime.origin }, str);
  push("exitTime", { ...d.exitTimeEt, origin: x.exitTime.origin }, str);
  push("entryPrice", x.entryPrice, num);
  push("exitPrice", x.exitPrice, num);
  push("initialStop", x.stopPrice, num);
  push("initialTarget", x.targetPrice, num);
  push("quantity", x.quantity, num);
  push("riskAmount", d.riskDollars, num);
  push("rMultiple", d.realizedR, num);

  if (x.setup.value) {
    const v = x.setup.value.toLowerCase();
    const match = ctx.strategies.find((s) => s.toLowerCase() === v);
    if (match) push("strategy", { ...x.setup, value: match }, str);
  }

  const seen = x.confluences.filter(
    (c) => c.state === "visual_confirmed" || c.state === "probable",
  );
  if (seen.length) {
    out.push({
      field: "confluences",
      value: seen.map((c) => confluenceLabel(CONFLUENCE_LABELS[c.key], ctx.confluences)),
      kind: seen.every((c) => c.state === "visual_confirmed") ? "detected" : "estimated",
      confidence: seen.every((c) => c.state === "visual_confirmed") ? "high" : "estimated",
    });
  }
  return out;
}

/** Les champs qui comptent pour un trade et que la capture n'a pas trouvés. */
export const ESSENTIAL_TRADE_FIELDS: readonly TradeFormField[] = [
  "date",
  "symbol",
  "direction",
  "entryTime",
  "entryPrice",
  "initialStop",
  "exitPrice",
];

export function missingFields<F extends string>(
  proposals: readonly Proposal<F>[],
  essential: readonly F[],
): F[] {
  const have = new Set(proposals.map((p) => p.field));
  return essential.filter((f) => !have.has(f));
}

export interface ApplyResult<S, F extends string> {
  next: S;
  applied: Proposal<F>[];
  conflicts: Proposal<F>[];
}

const isEmptyValue = (v: unknown) =>
  v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

/**
 * Applique les propositions aux champs VIDES de `form`. Un champ est vide s'il
 * n'a pas de valeur ou s'il vaut encore sa valeur par défaut (`pristine`).
 * `only` restreint à certaines propositions (« appliquer ce champ »).
 */
export function applyProposals<S extends object, F extends string>(
  form: S,
  pristine: Partial<S>,
  proposals: readonly Proposal<F>[],
  opts: {
    includeReview?: boolean;
    force?: boolean;
    /** Convertit la valeur texte d'une proposition vers le type du champ (prix numériques…). */
    coerce?: (field: string, value: string) => unknown;
  } = {},
): ApplyResult<S, F> {
  const next = { ...form } as Record<string, unknown>;
  const applied: Proposal<F>[] = [];
  const conflicts: Proposal<F>[] = [];
  for (const p of proposals) {
    if (p.kind === "needs_review" && !opts.includeReview && !opts.force) continue;
    const current = next[p.field];
    if (Array.isArray(p.value)) {
      const have = Array.isArray(current) ? (current as string[]) : [];
      const lower = new Set(have.map((c) => c.toLowerCase()));
      const add = p.value.filter((v) => !lower.has(v.toLowerCase()));
      if (add.length) {
        next[p.field] = [...have, ...add];
        applied.push({ ...p, value: add });
      }
      continue;
    }
    const empty =
      isEmptyValue(current) || current === (pristine as Record<string, unknown>)[p.field];
    if (empty || opts.force) {
      if (String(current) !== p.value) {
        next[p.field] = opts.coerce ? opts.coerce(p.field, p.value) : p.value;
        applied.push(p);
      }
    } else if (String(current).toLowerCase() !== p.value.toLowerCase()) {
      conflicts.push(p);
    }
  }
  return { next: next as S, applied, conflicts };
}

/**
 * Ce que le trader a changé dans un champ que la capture avait rempli — la
 * matière de l'apprentissage par correction. La capture d'origine n'est pas
 * réécrite : seules ces différences sont gardées, à part.
 */
export function correctionsOf<S extends object>(
  applied: readonly Proposal<string>[],
  saved: S,
): Record<string, { detected: string; saved: string }> {
  const out: Record<string, { detected: string; saved: string }> = {};
  for (const p of applied) {
    if (Array.isArray(p.value)) continue;
    const v = String((saved as Record<string, unknown>)[p.field] ?? "");
    if (v.toLowerCase() !== p.value.toLowerCase()) out[p.field] = { detected: p.value, saved: v };
  }
  return out;
}

// ── Setup manqué ───────────────────────────────────────────────────────────

/** Les champs du formulaire de setup manqué (`MissedEditor`) que la capture remplit. */
export interface MissedFormSlice {
  date: string;
  symbol: string;
  direction: "long" | "short" | null;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  outcome: "target" | "stop" | "unknown" | null;
}
export type MissedFormField = keyof MissedFormSlice;

/** Les prix d'un setup manqué sont des nombres dans son formulaire. */
export const coerceMissed = (field: string, value: string): unknown =>
  field === "entryPrice" || field === "stopPrice" || field === "targetPrice"
    ? Number(value)
    : value;

export function missedProposals(
  x: CaptureExtraction,
  d: CaptureDerived,
): Proposal<MissedFormField>[] {
  const out: Proposal<MissedFormField>[] = [];
  const push = <T>(field: MissedFormField, f: CapturedField<T>, fmt: (v: T) => string) => {
    const kind = kindOf(f);
    if (f.value === null || !kind) return;
    out.push({ field, value: fmt(f.value), kind, confidence: f.confidence, evidence: f.evidence });
  };
  push("date", { ...d.dateEt, origin: x.date.origin }, (v) => v);
  push("symbol", x.symbol, (v) => v);
  push("direction", x.direction, (v) => v);
  push("entryPrice", x.entryPrice, num);
  push("stopPrice", x.stopPrice, num);
  push("targetPrice", x.targetPrice, num);
  // Une issue ne se lit que si la capture montre la cible ou le stop touché.
  if (x.outcome.value === "target" || x.outcome.value === "stop") {
    push("outcome", x.outcome, (v) => v);
  }
  return out;
}

export const ESSENTIAL_MISSED_FIELDS: readonly MissedFormField[] = [
  "date",
  "symbol",
  "direction",
  "entryPrice",
  "stopPrice",
  "targetPrice",
];

// ── Apprentissage par correction ───────────────────────────────────────────

/** Les champs où une correction récurrente a un sens (pas les prix ni les heures). */
const LEARNABLE = new Set(["symbol", "quantity", "strategy"]);
/** Une correction ne devient une habitude qu'à partir de deux fois, sans contre-exemple. */
const MIN_REPEATS = 2;

export type Corrections = Record<string, { detected: string; saved: string }>;

/**
 * Ce que le trader corrige toujours de la même façon : « NQ lu → MNQ saisi »
 * deux fois, et jamais « NQ lu → NQ gardé ». Rend champ → valeur lue → valeur voulue.
 */
export function learnedRemaps(
  history: readonly Corrections[],
): Record<string, Record<string, string>> {
  const counts = new Map<string, Map<string, number>>();
  for (const c of history) {
    for (const [field, { detected, saved }] of Object.entries(c ?? {})) {
      if (!LEARNABLE.has(field) || !detected || !saved) continue;
      const key = `${field}\u0000${detected.toLowerCase()}`;
      const bucket = counts.get(key) ?? new Map<string, number>();
      bucket.set(saved, (bucket.get(saved) ?? 0) + 1);
      counts.set(key, bucket);
    }
  }
  const out: Record<string, Record<string, string>> = {};
  for (const [key, bucket] of counts) {
    if (bucket.size !== 1) continue; // corrections contradictoires : rien appris
    const [[saved, n]] = [...bucket];
    if (n < MIN_REPEATS) continue;
    const [field, detected] = key.split("\u0000");
    (out[field] ??= {})[detected] = saved;
  }
  return out;
}

/** Ajuste les propositions selon les habitudes apprises ; la valeur ajustée n'est qu'« estimée ». */
export function applyLearning<F extends string>(
  proposals: readonly Proposal<F>[],
  remaps: Record<string, Record<string, string>>,
): Proposal<F>[] {
  return proposals.map((p) => {
    if (Array.isArray(p.value)) return p;
    const to = remaps[p.field]?.[p.value.toLowerCase()];
    return to && to !== p.value
      ? {
          ...p,
          value: to,
          kind: "estimated",
          confidence: "estimated",
          evidence: `learned:${p.value}`,
        }
      : p;
  });
}
