/**
 * Des exécutions aux trades — l'appariement « plat à plat ».
 *
 * ── LA RÈGLE ───────────────────────────────────────────────────────────────
 * Par (compte, contrat), dans l'ordre chronologique, on suit la position
 * nette. Un trade commence quand elle quitte zéro et finit quand elle y
 * revient. Les renforts (scale-in) et les sorties partielles appartiennent au
 * MÊME trade : c'est ainsi qu'un trader raconte sa séance (« un long sur NQ,
 * deux contrats, sorti en deux fois »), et c'est ainsi que les prop firms
 * comptent leurs trades.
 *
 * ── LE RETOURNEMENT ────────────────────────────────────────────────────────
 * Une exécution qui traverse zéro (long 2, vente de 3) ferme le trade en
 * cours ET en ouvre un nouveau dans l'autre sens. Elle est coupée en deux :
 * 2 contrats ferment le long, 1 ouvre le short. Ses frais sont répartis au
 * prorata des quantités.
 *
 * ── CE QUI N'EST PAS UN TRADE ──────────────────────────────────────────────
 *   • une position encore ouverte : rien n'est rendu tant qu'elle n'est pas
 *     revenue à plat — le journal n'écrit pas un résultat qui peut changer ;
 *   • une position ouverte AVANT la fenêtre d'exécutions reçue : sans son
 *     entrée, son P&L serait inventé. `openingPositions` la déclare ; ses
 *     sorties sont consommées sans produire de trade.
 *
 * Déterministe : mêmes exécutions → mêmes trades → mêmes `externalId`. La
 * synchronisation peut donc être rejouée autant de fois qu'on veut.
 */

import type { BrokerFill, BrokerId, RoundTrip } from "./types";

const EPS = 1e-9;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

interface Leg {
  fill: BrokerFill;
  qty: number;
  fee: number;
}

interface OpenTrip {
  direction: "long" | "short";
  entries: Leg[];
  exits: Leg[];
  position: number; // signée : + long, − short
  maxAbs: number;
}

/** Clé d'une position : un compte, un contrat. */
export const positionKey = (accountId: string, contractId: string) => `${accountId}|${contractId}`;

function vwap(legs: Leg[]): number {
  const qty = legs.reduce((s, l) => s + l.qty, 0);
  if (qty <= EPS) return 0;
  return round8(legs.reduce((s, l) => s + l.qty * l.fill.price, 0) / qty);
}

function closeTrip(broker: BrokerId, t: OpenTrip): RoundTrip {
  const first = t.entries[0].fill;
  const last = t.exits[t.exits.length - 1].fill;
  const sign = t.direction === "long" ? 1 : -1;
  // P&L brut, exécution par exécution : (sorties − entrées) × valeur du point.
  const entryValue = t.entries.reduce((s, l) => s + l.qty * l.fill.price, 0);
  const exitValue = t.exits.reduce((s, l) => s + l.qty * l.fill.price, 0);
  const grossPnl = round2(sign * (exitValue - entryValue) * first.pointValue);
  const fees = round2([...t.entries, ...t.exits].reduce((s, l) => s + l.fee, 0));
  return {
    externalId: `${broker}:${first.accountId}:${first.id}`,
    accountId: first.accountId,
    contractId: first.contractId,
    symbol: first.symbol,
    pointValue: first.pointValue,
    direction: t.direction,
    quantity: round8(t.maxAbs),
    entryPrice: vwap(t.entries),
    exitPrice: vwap(t.exits),
    entryTime: first.time,
    exitTime: last.time,
    grossPnl,
    fees,
    netPnl: round2(grossPnl - fees),
    fillIds: [...new Set([...t.entries, ...t.exits].map((l) => l.fill.id))],
  };
}

export interface RoundTripOptions {
  /**
   * Position déjà ouverte au début de la fenêtre, par `positionKey` (signée).
   * Ses sorties sont absorbées sans créer de trade : on n'en connaît pas
   * l'entrée.
   */
  openingPositions?: ReadonlyMap<string, number>;
}

export function buildRoundTrips(
  broker: BrokerId,
  fills: readonly BrokerFill[],
  opts: RoundTripOptions = {},
): { trips: RoundTrip[]; openKeys: string[] } {
  // Ordre STABLE : l'heure, puis l'identifiant (deux exécutions à la même
  // milliseconde ne doivent pas changer d'ordre d'une synchro à l'autre).
  const sorted = [...fills]
    .filter((f) => f.qty > EPS && Number.isFinite(f.price))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id < b.id ? -1 : 1));

  const trips: RoundTrip[] = [];
  const open = new Map<string, OpenTrip>();
  // Reliquat d'une position antérieure à la fenêtre, à absorber.
  const legacy = new Map<string, number>(opts.openingPositions ?? []);

  for (const fill of sorted) {
    const key = positionKey(fill.accountId, fill.contractId);
    const delta = fill.side === "buy" ? fill.qty : -fill.qty;
    let remaining = fill.qty;
    const feePerUnit = fill.qty > EPS ? fill.fee / fill.qty : 0;

    // 1. Absorber d'abord une position héritée qui se referme.
    const inherited = legacy.get(key) ?? 0;
    if (Math.abs(inherited) > EPS && Math.sign(delta) !== Math.sign(inherited)) {
      const absorbed = Math.min(remaining, Math.abs(inherited));
      const left = inherited + Math.sign(delta) * absorbed;
      if (Math.abs(left) > EPS) legacy.set(key, left);
      else legacy.delete(key);
      remaining -= absorbed;
      if (remaining <= EPS) continue;
    } else if (Math.abs(inherited) > EPS) {
      // Renfort d'une position dont on ignore l'entrée : il en fait partie,
      // il ne peut pas être journalisé seul.
      legacy.set(key, inherited + delta);
      continue;
    }

    // 2. Ouvrir / renforcer / réduire / fermer — et retourner au besoin.
    while (remaining > EPS) {
      const cur = open.get(key);
      const side = fill.side;
      if (!cur) {
        open.set(key, {
          direction: side === "buy" ? "long" : "short",
          entries: [{ fill, qty: remaining, fee: feePerUnit * remaining }],
          exits: [],
          position: side === "buy" ? remaining : -remaining,
          maxAbs: remaining,
        });
        remaining = 0;
        break;
      }
      const adds = (cur.direction === "long") === (side === "buy");
      if (adds) {
        cur.entries.push({ fill, qty: remaining, fee: feePerUnit * remaining });
        cur.position += side === "buy" ? remaining : -remaining;
        cur.maxAbs = Math.max(cur.maxAbs, Math.abs(cur.position));
        remaining = 0;
        break;
      }
      const closing = Math.min(remaining, Math.abs(cur.position));
      cur.exits.push({ fill, qty: closing, fee: feePerUnit * closing });
      cur.position += side === "buy" ? closing : -closing;
      remaining -= closing;
      if (Math.abs(cur.position) <= EPS) {
        trips.push(closeTrip(broker, cur));
        open.delete(key);
        // S'il reste de la quantité, la boucle ouvre le trade inverse.
      }
    }
  }

  return { trips, openKeys: [...open.keys()] };
}
