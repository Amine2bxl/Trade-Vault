import type { Trade } from "./trade";
import { easternClockOf, instantMs } from "./easternClock";

/**
 * LE SOLDE DU COMPTE JUSTE AVANT UN TRADE — module pur (lot 1).
 *
 * Une règle « risque ≤ 1 % du compte » ne se juge pas avec le solde
 * d'aujourd'hui : il faut celui d'AVANT l'entrée. Le solde de départ actuel
 * n'en est pas une preuve (dépôts, retraits, recalibrage…). Ce module le
 * RECONSTRUIT à partir de faits datés, et dit à quel point il le sait :
 *
 *   • VERIFIED — un solde observé par le broker ou un relevé (snapshot)
 *     AVANT l'entrée, l'instant d'entrée prouvé, tous les trades et
 *     mouvements de l'intervalle placés sans ambiguïté avec leurs frais
 *     connus, ET l'intervalle RÉCONCILIÉ par un snapshot observé suivant
 *     (au cent près) — seule preuve qu'aucun mouvement ne manque ;
 *   • PARTIAL — un montant est calculable, mais l'une de ces preuves manque
 *     (snapshot déclaré par le trader, heure non prouvée, frais inconnus,
 *     intervalle non réconcilié…). Il s'affiche comme estimation ; il ne
 *     décide JAMAIS d'un verdict de règle ;
 *   • UNKNOWN — rien d'honnête à dire : pas de snapshot antérieur, ou un
 *     trade du même jour impossible à placer avant ou après l'entrée.
 *
 * Aucune valeur n'est complétée par défaut : un trou reste un trou.
 */

export type EvidenceSource = "user" | "broker" | "statement";

export interface BalanceSnapshot {
  accountId: string;
  balance: number;
  /** Instant ISO 8601 de l'observation. */
  observedAt: string;
  source: EvidenceSource;
  /** Code ISO 4217. Absent = devise du compte. */
  currency?: string;
}

export interface CashMovement {
  accountId: string;
  /** Signé : + entre sur le compte, − en sort. */
  amount: number;
  occurredAt: string;
  source: EvidenceSource;
  /** Code ISO 4217. Absent = devise du compte. */
  currency?: string;
}

export type BalanceTrade = Pick<Trade, "id" | "date" | "pnl"> &
  Partial<Pick<Trade, "accountId" | "entryAt" | "exitAt" | "broker" | "fees">>;

export type BalanceStatus = "VERIFIED" | "PARTIAL" | "UNKNOWN";

/** Ce qui empêche un solde d'être VERIFIED — dit au trader, jamais masqué. */
export type BalanceGap =
  | "no_account"
  | "no_snapshot"
  | "declared_snapshot"
  | "entry_time_unproven"
  | "order_unproven"
  | "fees_unknown"
  | "declared_cashflow"
  | "interval_unreconciled"
  | "currency_mismatch";

export interface BalanceAtEntry {
  status: BalanceStatus;
  /** `null` quand UNKNOWN ; une estimation quand PARTIAL. */
  balance: number | null;
  gaps: BalanceGap[];
}

const observed = (s: EvidenceSource) => s === "broker" || s === "statement";
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (ms: number) => easternClockOf(new Date(ms).toISOString())?.date ?? "";

/** Une borne d'intervalle : un instant prouvé, et son jour à New York. */
interface Bound {
  ms: number | null;
  day: string;
}

interface IntervalSum {
  /** P&L réalisé + mouvements de l'intervalle ]from, to]. */
  delta: number;
  /** Placement de chaque élément certain (instants prouvés). */
  certain: boolean;
  /** Estimable : aucun élément placé au même jour qu'une borne sans instant. */
  estimable: boolean;
  feesKnown: boolean;
  declaredCash: boolean;
}

/**
 * Somme ce qui s'est RÉALISÉ sur le compte entre deux bornes, `from` exclue,
 * `to` incluse. Un trade sans instant de sortie se place par sa date : hors de
 * la fenêtre il est certain, à l'intérieur il est estimé (une position peut
 * avoir été tenue plusieurs jours), au jour même d'une borne il est
 * impossible à placer.
 */
function sumInterval(
  trades: readonly BalanceTrade[],
  cash: readonly CashMovement[],
  from: Bound,
  to: Bound,
  excludeId?: string,
): IntervalSum {
  const out: IntervalSum = {
    delta: 0,
    certain: true,
    estimable: true,
    feesKnown: true,
    declaredCash: false,
  };
  for (const t of trades) {
    if (t.id === excludeId) continue;
    const exitMs = instantMs(t.exitAt);
    let inside: boolean;
    if (exitMs !== null && from.ms !== null && to.ms !== null) {
      inside = exitMs > from.ms && exitMs <= to.ms;
    } else {
      // Placement au jour : la date du trade est celle de son ENTRÉE.
      const day = exitMs !== null ? dayOf(exitMs) : t.date;
      if (day < from.day || day > to.day) continue;
      if (day === from.day || day === to.day) {
        out.certain = false;
        out.estimable = false;
        continue;
      }
      inside = true;
      if (exitMs === null) out.certain = false;
    }
    if (!inside) continue;
    out.delta += t.pnl;
    if (t.broker && (t.fees === null || t.fees === undefined)) out.feesKnown = false;
  }
  for (const c of cash) {
    const ms = instantMs(c.occurredAt);
    if (ms === null) {
      out.certain = false;
      continue;
    }
    let inside: boolean;
    if (from.ms !== null && to.ms !== null) {
      inside = ms > from.ms && ms <= to.ms;
    } else {
      const day = dayOf(ms);
      if (day === from.day || day === to.day) {
        // Le jour même d'une borne sans instant : ni avant ni après prouvé.
        out.certain = false;
        out.estimable = false;
        continue;
      }
      inside = day > from.day && day < to.day;
    }
    if (!inside) continue;
    out.delta += c.amount;
    if (!observed(c.source)) out.declaredCash = true;
  }
  out.delta = round2(out.delta);
  return out;
}

export interface BalanceLedger {
  snapshots: readonly BalanceSnapshot[];
  cash: readonly CashMovement[];
  /** TOUS les trades du compte (pas seulement la fenêtre affichée). */
  trades: readonly BalanceTrade[];
}

/** Le solde juste avant l'entrée de `trade`. */
export function balanceBeforeEntry(trade: BalanceTrade, ledger: BalanceLedger): BalanceAtEntry {
  const unknown = (gap: BalanceGap): BalanceAtEntry => ({
    status: "UNKNOWN",
    balance: null,
    gaps: [gap],
  });
  const accountId = trade.accountId;
  if (!accountId) return unknown("no_account");

  const entryMs = instantMs(trade.entryAt);
  const entry: Bound = { ms: entryMs, day: entryMs !== null ? dayOf(entryMs) : trade.date };
  const snapshots = ledger.snapshots
    .filter((s) => s.accountId === accountId && instantMs(s.observedAt) !== null)
    .map((s) => ({ ...s, ms: instantMs(s.observedAt)! }))
    .sort((a, b) => a.ms - b.ms);

  // Le dernier solde observé AVANT l'entrée. Sans instant d'entrée, un
  // snapshot du même jour ne se place pas : il faut un jour antérieur.
  const anchor = [...snapshots]
    .reverse()
    .find((s) => (entryMs !== null ? s.ms < entryMs : dayOf(s.ms) < entry.day));
  if (!anchor) return unknown("no_snapshot");

  const trades = ledger.trades.filter((t) => t.accountId === accountId);
  const cash = ledger.cash.filter((c) => c.accountId === accountId);
  // Aucune conversion implicite : un mouvement ou un solde dans une autre
  // devise que le snapshot d'ancrage rend la somme dénuée de sens.
  if (
    anchor.currency &&
    [...cash, ...snapshots].some((x) => x.currency && x.currency !== anchor.currency)
  ) {
    return unknown("currency_mismatch");
  }
  const from: Bound = { ms: anchor.ms, day: dayOf(anchor.ms) };
  const sum = sumInterval(trades, cash, from, entry, trade.id);
  if (!sum.estimable) return unknown("order_unproven");

  const gaps: BalanceGap[] = [];
  if (!observed(anchor.source)) gaps.push("declared_snapshot");
  if (entryMs === null) gaps.push("entry_time_unproven");
  if (!sum.certain) gaps.push("order_unproven");
  if (!sum.feesKnown) gaps.push("fees_unknown");
  if (sum.declaredCash) gaps.push("declared_cashflow");

  // Complétude : seul un snapshot OBSERVÉ suivant, réconcilié au cent près,
  // prouve qu'aucun mouvement de l'intervalle ne manque.
  const next = snapshots.find((s) => s.ms > anchor.ms && (entryMs === null || s.ms >= entryMs));
  const reconciled =
    next !== undefined &&
    observed(next.source) &&
    (() => {
      const full = sumInterval(trades, cash, from, { ms: next.ms, day: dayOf(next.ms) });
      return (
        full.certain &&
        full.feesKnown &&
        !full.declaredCash &&
        Math.abs(round2(anchor.balance + full.delta) - next.balance) < 0.005
      );
    })();
  if (!reconciled) gaps.push("interval_unreconciled");

  return {
    status: gaps.length === 0 ? "VERIFIED" : "PARTIAL",
    balance: round2(anchor.balance + sum.delta),
    gaps,
  };
}

/** Les soldes VÉRIFIÉS seulement, par trade — l'entrée attendue par les règles
 *  (`ruleAdherence`, Edge Score). Un PARTIAL n'y entre jamais. */
export function verifiedBalances(
  trades: readonly BalanceTrade[],
  ledger: BalanceLedger,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of trades) {
    const b = balanceBeforeEntry(t, ledger);
    if (b.status === "VERIFIED" && b.balance !== null) out.set(t.id, b.balance);
  }
  return out;
}

export type ReconciliationStatus = "reconciled" | "gap" | "undetermined";

export interface SnapshotReconciliation {
  accountId: string;
  from: string;
  to: string;
  /** Solde attendu au second snapshot d'après le premier et l'intervalle. */
  expected: number;
  observed: number;
  /** Observé − attendu ; ≠ 0 = un mouvement ou un trade manque (ou est faux). */
  gap: number;
  status: ReconciliationStatus;
}

/**
 * Rapprochement de chaque paire de snapshots consécutifs d'un compte : ce que
 * le journal et la trésorerie expliquent, face à ce qui a été observé.
 */
export function reconcileSnapshots(ledger: BalanceLedger): SnapshotReconciliation[] {
  const byAccount = new Map<string, (BalanceSnapshot & { ms: number })[]>();
  for (const s of ledger.snapshots) {
    const ms = instantMs(s.observedAt);
    if (ms === null) continue;
    const list = byAccount.get(s.accountId) ?? [];
    list.push({ ...s, ms });
    byAccount.set(s.accountId, list);
  }
  const out: SnapshotReconciliation[] = [];
  for (const [accountId, list] of byAccount) {
    list.sort((a, b) => a.ms - b.ms);
    const trades = ledger.trades.filter((t) => t.accountId === accountId);
    const cash = ledger.cash.filter((c) => c.accountId === accountId);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      const sum = sumInterval(
        trades,
        cash,
        { ms: a.ms, day: dayOf(a.ms) },
        { ms: b.ms, day: dayOf(b.ms) },
      );
      const expected = round2(a.balance + sum.delta);
      const gap = round2(b.balance - expected);
      out.push({
        accountId,
        from: a.observedAt,
        to: b.observedAt,
        expected,
        observed: b.balance,
        gap,
        status:
          !sum.certain || !sum.feesKnown
            ? "undetermined"
            : Math.abs(gap) < 0.005
              ? "reconciled"
              : "gap",
      });
    }
  }
  return out;
}
