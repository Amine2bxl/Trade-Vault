/**
 * Adaptateur Tradovate — PUR : des réponses JSON de l'API vers le vocabulaire
 * du module. Aucun appel réseau ici (c'est `backend/tradovate.server.ts`).
 *
 * Les entités utilisées, telles que l'API REST les décrit :
 *   • `fill`         { id, orderId, contractId, timestamp, action, qty, price, active }
 *   • `order`        { id, accountId, contractId, timestamp, action, ordStatus }
 *   • `orderVersion` { id, orderId, orderType, price, stopPrice }
 *   • `fillFee`      { id (= id du fill), commission, clearingFee, exchangeFee,
 *                      nfaFee, brokerageFee, ipFee, orderRoutingFee }
 *   • `contract`     { id, name, contractMaturityId }
 *   • `contractMaturity` { id, productId }
 *   • `product`      { id, name, valuePerPoint }
 *   • `account`      { id, name, nickname?, active, archived }
 *
 * Tradovate n'expose ni le compte sur le fill ni le P&L de l'aller-retour :
 * le compte vient de l'ordre parent, le P&L se recalcule avec la valeur du
 * point du produit. Un fill dont l'ordre ou le contrat est inconnu est ÉCARTÉ
 * — jamais deviné.
 */

import type { BrokerFill, BrokerStopOrder, FillSide } from "./types";

export interface TvFill {
  id: number;
  orderId: number;
  contractId: number;
  timestamp: string;
  action: string;
  qty: number;
  price: number;
  active?: boolean;
}
export interface TvOrder {
  id: number;
  accountId: number;
  contractId?: number;
  timestamp: string;
  action?: string;
  ordStatus?: string;
}
export interface TvOrderVersion {
  id: number;
  orderId: number;
  orderType?: string;
  price?: number | null;
  stopPrice?: number | null;
}
export interface TvFillFee {
  id: number;
  commission?: number | null;
  clearingFee?: number | null;
  exchangeFee?: number | null;
  nfaFee?: number | null;
  brokerageFee?: number | null;
  ipFee?: number | null;
  orderRoutingFee?: number | null;
}
export interface TvAccount {
  id: number;
  name: string;
  nickname?: string | null;
  active?: boolean;
  archived?: boolean;
}

/** Ce qu'il faut savoir d'un contrat pour journaliser : sa racine et la
 *  valeur d'un point. Mis en cache par la synchro (un contrat ne change pas). */
export interface ContractInfo {
  symbol: string;
  pointValue: number;
}

export function sideOf(action: string | undefined): FillSide | null {
  const a = (action ?? "").toLowerCase();
  if (a === "buy") return "buy";
  if (a === "sell") return "sell";
  return null;
}

/** Somme des frais d'une exécution. Tradovate les détaille par nature ; le
 *  journal n'en garde que le total, toujours positif. */
export function totalFee(fee: TvFillFee | undefined): number {
  if (!fee) return 0;
  const parts = [
    fee.commission,
    fee.clearingFee,
    fee.exchangeFee,
    fee.nfaFee,
    fee.brokerageFee,
    fee.ipFee,
    fee.orderRoutingFee,
  ];
  const sum = parts.reduce<number>(
    (s, v) => s + (Number.isFinite(Number(v)) ? Math.abs(Number(v)) : 0),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/**
 * Racine d'un nom de contrat Tradovate : « MNQZ5 » → « MNQ », « ESH26 » →
 * « ES ». Sert de repli quand le produit n'a pas pu être lu ; la valeur du
 * point, elle, n'a pas de repli (sans elle, pas de P&L honnête).
 */
export function rootSymbol(contractName: string): string {
  const m = /^([A-Z0-9]+?)([FGHJKMNQUVXZ])(\d{1,2})$/.exec(contractName.toUpperCase());
  return m ? m[1] : contractName.toUpperCase();
}

export function normalizeFills(
  fills: readonly TvFill[],
  orders: ReadonlyMap<number, TvOrder>,
  contracts: ReadonlyMap<number, ContractInfo>,
  fees: ReadonlyMap<number, TvFillFee>,
): { fills: BrokerFill[]; skipped: number } {
  const out: BrokerFill[] = [];
  let skipped = 0;
  for (const f of fills) {
    // Un fill annulé (`active: false`) a été corrigé par le broker : il ne
    // compte plus.
    if (f.active === false) continue;
    const order = orders.get(f.orderId);
    const contract = contracts.get(f.contractId);
    const side = sideOf(f.action);
    if (!order || !contract || !side || !(contract.pointValue > 0)) {
      skipped++;
      continue;
    }
    out.push({
      id: String(f.id),
      accountId: String(order.accountId),
      contractId: String(f.contractId),
      symbol: contract.symbol,
      pointValue: contract.pointValue,
      side,
      qty: Math.abs(Number(f.qty)),
      price: Number(f.price),
      time: new Date(f.timestamp).toISOString(),
      fee: totalFee(fees.get(f.id)),
    });
  }
  return { fills: out, skipped };
}

const STOP_TYPES = new Set(["stop", "stoplimit", "trailingstop", "trailingstoplimit"]);

/**
 * Les ordres stop, avec leur prix INITIAL : la première version de l'ordre
 * (la plus petite `id`), pas celle qu'un trailing a remontée ensuite.
 */
export function stopOrders(
  orders: readonly TvOrder[],
  versions: readonly TvOrderVersion[],
): BrokerStopOrder[] {
  const firstVersion = new Map<number, TvOrderVersion>();
  for (const v of versions) {
    const prev = firstVersion.get(v.orderId);
    if (!prev || v.id < prev.id) firstVersion.set(v.orderId, v);
  }
  const out: BrokerStopOrder[] = [];
  for (const o of orders) {
    const v = firstVersion.get(o.id);
    const side = sideOf(o.action);
    if (!v || !side || o.contractId == null) continue;
    if (!STOP_TYPES.has((v.orderType ?? "").toLowerCase())) continue;
    const stop = Number(v.stopPrice ?? v.price);
    if (!Number.isFinite(stop) || stop <= 0) continue;
    out.push({
      accountId: String(o.accountId),
      contractId: String(o.contractId),
      side,
      stopPrice: stop,
      time: new Date(o.timestamp).toISOString(),
    });
  }
  return out;
}

/** Nom affiché d'un compte Tradovate : le surnom donné par le trader s'il
 *  existe, sinon l'identifiant de la prop firm (« APEX-12345-07 »). */
export function accountLabel(a: TvAccount): string {
  return (a.nickname && a.nickname.trim()) || a.name;
}

/**
 * Réponse d'authentification Tradovate. Trois formes :
 *   • succès : `accessToken` + `expirationTime` ;
 *   • refus : `errorText` ;
 *   • pénalité anti-abus : `p-ticket` + `p-time` (secondes), parfois
 *     `p-captcha` — dans ce cas l'API n'acceptera plus rien sans passer par
 *     l'application Tradovate.
 */
export type TvAuthResult =
  | { ok: true; accessToken: string; expiresAt: string; userId: string | null }
  | { ok: false; reason: "invalid" | "penalty" | "captcha"; message: string; retryInSec?: number };

export function parseAuthResponse(body: unknown): TvAuthResult {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.accessToken === "string" && b.accessToken) {
    const exp =
      typeof b.expirationTime === "string"
        ? new Date(b.expirationTime).toISOString()
        : new Date(Date.now() + 80 * 60_000).toISOString();
    return {
      ok: true,
      accessToken: b.accessToken,
      expiresAt: exp,
      userId: b.userId != null ? String(b.userId) : null,
    };
  }
  if (b["p-captcha"]) {
    return { ok: false, reason: "captcha", message: "captcha required" };
  }
  if (b["p-ticket"]) {
    return {
      ok: false,
      reason: "penalty",
      message: "rate limited",
      retryInSec: Number(b["p-time"]) || 60,
    };
  }
  return {
    ok: false,
    reason: "invalid",
    message: typeof b.errorText === "string" && b.errorText ? b.errorText : "authentication failed",
  };
}

// ── OAuth : jetons, renouvellement, hôtes dynamiques ───────────────────────

/**
 * Les hôtes d'API propres à un compte (« dynamic API hosts » de NinjaTrader,
 * depuis octobre 2026) : une prop firm peut avoir son hôte dédié pour `live`
 * ou `demo`. Clés connues : live, demo, mdLive, mdDemo, replay, reporting…
 * Valeurs : des noms d'hôte nus (sans schéma ni chemin).
 */
export type ApiHosts = Record<string, string>;

/** Les seuls domaines vers lesquels un jeton Tradovate peut partir. */
const TRUSTED_HOST = /(^|\.)(tradovateapi\.com|tradovate\.com|ninjatrader\.com|ninjatrader\.dev)$/i;

export function isTrustedTradovateHost(host: string): boolean {
  return /^[a-z0-9.-]+$/i.test(host) && TRUSTED_HOST.test(host);
}

/**
 * Les hôtes renvoyés par une réponse d'authentification (`apiHosts`, parfois
 * `api_hosts`). Toute valeur hors des domaines de confiance est ignorée : un
 * hôte reçu ne doit jamais pouvoir détourner le jeton ailleurs.
 */
export function parseApiHosts(body: unknown): ApiHosts {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw = (b.apiHosts ?? b.api_hosts) as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return {};
  const out: ApiHosts = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") continue;
    const host = v
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/[/?#].*$/, "")
      .toLowerCase();
    if (isTrustedTradovateHost(host)) out[k] = host;
  }
  return out;
}

/** Fusionne champ par champ : une réponse qui omet un hôte ne l'efface pas. */
export function mergeApiHosts(prev: ApiHosts | null | undefined, next: ApiHosts): ApiHosts {
  return { ...(prev ?? {}), ...next };
}

/**
 * Le résultat d'un échange OAuth, d'un renouvellement ou d'un `refresh_token`.
 * Deux dialectes coexistent chez Tradovate : l'échange OAuth répond en
 * `snake_case` (`access_token`, `expires_in`, `refresh_token`), le
 * renouvellement en `camelCase` (`accessToken`, `expirationTime`). Un seul
 * lecteur pour les deux.
 */
export type TvTokenResult =
  | {
      ok: true;
      accessToken: string;
      expiresAt: string;
      /** Présent quand Tradovate en délivre un (échange et refresh). */
      refreshToken: string | null;
      apiHosts: ApiHosts;
    }
  | {
      ok: false;
      /** `transient` : panne passagère (5xx, 429, réponse illisible) — le
       *  jeton n'est PAS révoqué, la connexion ne doit pas passer « à
       *  reconnecter » pour autant. */
      reason: "invalid" | "penalty" | "captcha" | "transient";
      /** Code d'erreur OAuth stable (`invalid_client`, `invalid_grant`…) ou
       *  message court — jamais un secret. */
      message: string;
    };

/** Durée de vie prudente quand la réponse n'en donne pas (≈ 80-90 min). */
const DEFAULT_TTL_SEC = 80 * 60;

export function parseTokenResponse(body: unknown, now: number = Date.now()): TvTokenResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const access =
    typeof b.access_token === "string" && b.access_token
      ? b.access_token
      : typeof b.accessToken === "string" && b.accessToken
        ? b.accessToken
        : null;
  if (access) {
    let expiresAt: string | null = null;
    if (typeof b.expirationTime === "string") {
      const t = Date.parse(b.expirationTime);
      if (Number.isFinite(t)) expiresAt = new Date(t).toISOString();
    }
    if (!expiresAt) {
      const ttl = Number(b.expires_in);
      expiresAt = new Date(now + (ttl > 0 ? ttl : DEFAULT_TTL_SEC) * 1000).toISOString();
    }
    return {
      ok: true,
      accessToken: access,
      expiresAt,
      refreshToken: typeof b.refresh_token === "string" && b.refresh_token ? b.refresh_token : null,
      apiHosts: parseApiHosts(b),
    };
  }
  if (b["p-captcha"]) return { ok: false, reason: "captcha", message: "captcha required" };
  if (b["p-ticket"]) return { ok: false, reason: "penalty", message: "rate limited" };
  const code =
    (typeof b.error === "string" && b.error) ||
    (typeof b.errorText === "string" && b.errorText) ||
    "authentication failed";
  return { ok: false, reason: "invalid", message: code.slice(0, 120) };
}
