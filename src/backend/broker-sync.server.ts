/**
 * La synchronisation d'une connexion broker — serveur uniquement.
 *
 * Appelée de deux endroits, avec le MÊME code :
 *   • `syncBrokers` (server function) : quand l'app est ouverte, toutes les
 *     minutes environ, avec le client Supabase de l'utilisateur — la RLS
 *     s'applique ;
 *   • le cron `/api/cron/broker-sync` : une fois par jour, en service-role,
 *     pour rattraper les journées où l'app n'a pas été ouverte.
 *
 * Le déroulé, dans un ordre qui ne perd ni ne double jamais rien :
 *   1. un jeton valide — renouvelé avant expiration ; expiré, la connexion
 *      passe « à reconnecter » (TradeVault ne détient aucun mot de passe
 *      qui lui permettrait d'en redemander un) ;
 *   2. les comptes du login (nouveaux comptes enregistrés, rattachés au compte
 *      TradeVault par défaut de la connexion) ;
 *   3. exécutions + ordres + positions + contrats (+ frais, + stops) ;
 *   4. appariement plat → plat (`modules/brokers`, pur et déterministe) ;
 *   5. insertion `on conflict do nothing` sur `(user_id, external_id)` ;
 *   6. curseur avancé : un trade supprimé par le trader ne revient pas.
 *
 * Tout ce qui part vers Tradovate est une LECTURE (`tvGet`, liste blanche dans
 * `tradovate.server.ts`). Réservé au palier Pro : les appelants vérifient le
 * palier avant (`requireProPlan`, et le filtre du cron ci-dessous).
 */

import {
  buildRoundTrips,
  positionKey,
  roundTripToTrade,
  tradovate as tv,
  type BrokerStopOrder,
} from "@/modules/brokers";
import type { Trade } from "@/domain/trade";
import { effectiveTier, type EntitlementRow } from "@/domain/entitlement";
import { tierAtLeast } from "@/domain/plans";
import { decryptSecret, encryptSecret } from "./broker-crypto.server";
import { renewAccessToken, tvGet, tvItems, type TvEnvironment } from "./tradovate.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export interface ConnectionRow {
  id: string;
  user_id: string;
  broker: "tradovate";
  environment: TvEnvironment;
  label: string;
  status: "pending" | "active" | "error" | "disabled";
  token_ciphertext: string | null;
  token_expires_at: string | null;
  default_risk: number | null;
  default_account_id: string | null;
  timezone: string;
  last_sync_at: string | null;
  sync_cursor: SyncCursor | null;
}

export interface BrokerAccountRow {
  id: string;
  connection_id: string;
  external_account_id: string;
  name: string;
  account_id: string | null;
  enabled: boolean;
}

interface SyncCursor {
  /**
   * Dernière SORTIE journalisée (ISO), PAR COMPTE BROKER. Un aller-retour clos
   * avant n'est plus proposé : c'est ce qui empêche un trade supprimé de
   * revenir. Par compte et non global : un compte rattaché après coup (ou
   * réactivé) doit encore recevoir ses trades récents, même si un autre
   * compte du même login a déjà avancé le curseur.
   */
  syncedThrough?: Record<string, string>;
  /** Fiches de contrat déjà résolues — un contrat ne change pas. */
  contracts?: Record<string, tv.ContractInfo>;
}

/** Ce que l'utilisateur doit savoir d'un échec, en code stable (traduit par
 *  l'interface), jamais une trace technique. */
export type SyncErrorCode =
  | "reauth_required"
  | "rate_limited"
  | "broker_unreachable"
  | "plan_limit"
  | "crypto_unavailable";

export interface SyncOutcome {
  connectionId: string;
  inserted: Trade[];
  /** Comptes broker sans compte TradeVault choisi : rien n'y est écrit. */
  unmappedAccounts: number;
  error: SyncErrorCode | null;
}

const RENEW_MARGIN_MS = 10 * 60_000;

// ── Jeton ────────────────────────────────────────────────────────────────────

async function ensureToken(
  sb: Sb,
  conn: ConnectionRow,
): Promise<{ token: string } | { error: SyncErrorCode }> {
  const exp = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  let current: string | null = null;
  if (conn.token_ciphertext) {
    try {
      current = await decryptSecret(conn.token_ciphertext);
    } catch {
      return { error: "crypto_unavailable" };
    }
  }

  // Encore largement valide : rien à faire.
  if (current && exp - Date.now() > RENEW_MARGIN_MS) return { token: current };
  // Expiré : seul le trader peut en obtenir un nouveau, en se reconnectant
  // CHEZ Tradovate. TradeVault n'a aucun identifiant pour le faire à sa place,
  // et c'est voulu.
  if (!current || exp <= Date.now()) return { error: "reauth_required" };

  // Encore valide mais proche de l'expiration : on le renouvelle.
  const result = await renewAccessToken(conn.environment, current).catch(() => null);
  if (!result) return { error: "broker_unreachable" };
  if (!result.ok)
    return { error: result.reason === "penalty" ? "rate_limited" : "reauth_required" };
  await sb
    .from("broker_connections")
    .update({
      token_ciphertext: await encryptSecret(result.accessToken),
      token_expires_at: result.expiresAt,
    })
    .eq("id", conn.id);
  return { token: result.accessToken };
}

// ── Comptes ──────────────────────────────────────────────────────────────────

/** Lit les comptes du login et enregistre les nouveaux. Rend la table à jour. */
export async function refreshBrokerAccounts(
  sb: Sb,
  conn: ConnectionRow,
  token: string,
): Promise<BrokerAccountRow[]> {
  const remote = await tvGet<tv.TvAccount[]>(conn.environment, token, "/account/list");
  const { data: known } = await sb
    .from("broker_accounts")
    .select("id, connection_id, external_account_id, name, account_id, enabled")
    .eq("connection_id", conn.id);
  const byExternal = new Map<string, BrokerAccountRow>(
    ((known ?? []) as BrokerAccountRow[]).map((a) => [a.external_account_id, a]),
  );
  const fresh = remote
    .filter((a) => !a.archived && !byExternal.has(String(a.id)))
    .map((a) => ({
      user_id: conn.user_id,
      connection_id: conn.id,
      external_account_id: String(a.id),
      name: tv.accountLabel(a),
      // Le compte TradeVault choisi à la connexion : le trader n'a rien à
      // refaire pour un compte d'éval acheté la semaine suivante.
      account_id: conn.default_account_id,
      enabled: true,
    }));
  if (fresh.length) {
    const { data: inserted } = await sb
      .from("broker_accounts")
      .upsert(fresh, { onConflict: "connection_id,external_account_id", ignoreDuplicates: true })
      .select("id, connection_id, external_account_id, name, account_id, enabled");
    for (const a of (inserted ?? []) as BrokerAccountRow[])
      byExternal.set(a.external_account_id, a);
  }
  return [...byExternal.values()];
}

// ── Contrats ─────────────────────────────────────────────────────────────────

async function resolveContracts(
  env: TvEnvironment,
  token: string,
  ids: readonly number[],
  cache: Record<string, tv.ContractInfo>,
): Promise<Map<number, tv.ContractInfo>> {
  const out = new Map<number, tv.ContractInfo>();
  const missing: number[] = [];
  for (const id of ids) {
    const hit = cache[String(id)];
    if (hit) out.set(id, hit);
    else missing.push(id);
  }
  if (!missing.length) return out;

  // contrat → échéance → produit : c'est le produit qui porte la valeur du
  // point (`valuePerPoint`) et la racine (« MNQ »).
  const contracts = await tvItems<{ id: number; name: string; contractMaturityId: number }>(
    env,
    token,
    "contract",
    missing,
  );
  const maturityIds = [...new Set(contracts.map((c) => c.contractMaturityId))];
  const maturities = await tvItems<{ id: number; productId: number }>(
    env,
    token,
    "contractMaturity",
    maturityIds,
  );
  const productIds = [...new Set(maturities.map((m) => m.productId))];
  const products = await tvItems<{ id: number; name: string; valuePerPoint: number }>(
    env,
    token,
    "product",
    productIds,
  );
  const maturityById = new Map(maturities.map((m) => [m.id, m]));
  const productById = new Map(products.map((p) => [p.id, p]));
  for (const c of contracts) {
    const product = productById.get(maturityById.get(c.contractMaturityId)?.productId ?? -1);
    if (!product || !(Number(product.valuePerPoint) > 0)) continue;
    const info = {
      symbol: product.name || tv.rootSymbol(c.name),
      pointValue: Number(product.valuePerPoint),
    };
    out.set(c.id, info);
    cache[String(c.id)] = info;
  }
  return out;
}

// ── Écriture ─────────────────────────────────────────────────────────────────

const cents = (n: number) => Math.round(n * 100) / 100;

function tradeRow(t: Trade, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    account_id: t.accountId ?? null,
    trade_date: t.date,
    symbol: t.symbol,
    direction: t.direction,
    pnl: cents(t.pnl),
    risk_amount: cents(t.riskAmount),
    r_multiple: t.rMultiple,
    strategy: t.strategy,
    mistakes: t.mistakes,
    setup_quality: t.setupQuality,
    notes: t.notes,
    screenshots: t.screenshots,
    entry_time: t.entryTime,
    exit_time: t.exitTime,
    confluences: t.confluences,
    confidence: t.confidence,
    mae: null,
    mfe: null,
    slippage: null,
    is_example: false,
    quantity: t.quantity ?? null,
    entry_price: t.entryPrice ?? null,
    exit_price: t.exitPrice ?? null,
    fees: t.fees != null ? cents(t.fees) : null,
    broker: t.broker,
    external_id: t.externalId,
    broker_account: t.brokerAccount ?? null,
    review_pending: true,
  };
}

/** Le refus du quota mensuel est levé par le déclencheur `enforce_trade_quota`
 *  avec ce préfixe stable (le même que lit `planLimitFromDbError` côté app). */
const isPlanLimit = (e: unknown) =>
  String((e as { message?: string } | null)?.message ?? e).includes("PLAN_LIMIT_TRADES");

async function insertTrades(
  sb: Sb,
  userId: string,
  trades: Trade[],
): Promise<{ inserted: Record<string, unknown>[]; planLimit: boolean }> {
  if (!trades.length) return { inserted: [], planLimit: false };
  const rows = trades.map((t) => tradeRow(t, userId));
  const { data, error } = await sb
    .from("trades")
    .upsert(rows, { onConflict: "user_id,external_id", ignoreDuplicates: true })
    .select("*");
  if (!error) return { inserted: (data ?? []) as Record<string, unknown>[], planLimit: false };
  // Un lot refusé est repris ligne à ligne : une seule ligne fautive (ou la
  // limite de l'offre atteinte en cours de lot) n'emporte pas les autres.
  const inserted: Record<string, unknown>[] = [];
  let planLimit = isPlanLimit(error);
  for (const row of rows) {
    const res = await sb
      .from("trades")
      .upsert([row], { onConflict: "user_id,external_id", ignoreDuplicates: true })
      .select("*");
    if (!res.error) inserted.push(...((res.data ?? []) as Record<string, unknown>[]));
    else if (isPlanLimit(res.error)) {
      planLimit = true;
      break;
    }
  }
  return { inserted, planLimit };
}

// ── La synchro ───────────────────────────────────────────────────────────────

export async function syncConnection(sb: Sb, conn: ConnectionRow): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    connectionId: conn.id,
    inserted: [],
    unmappedAccounts: 0,
    error: null,
  };
  const startedAt = new Date().toISOString();
  const fail = async (error: SyncErrorCode) => {
    outcome.error = error;
    await sb
      .from("broker_connections")
      .update({
        last_sync_at: startedAt,
        last_error: error,
        // Un jeton expiré ou refusé met la connexion en erreur : elle n'est
        // plus tentée en boucle, le trader voit qu'il doit se reconnecter.
        ...(error === "reauth_required" ? { status: "error" } : {}),
      })
      .eq("id", conn.id);
    return outcome;
  };

  const auth = await ensureToken(sb, conn);
  if ("error" in auth) return fail(auth.error);
  const token = auth.token;
  const env = conn.environment;
  const cursor: SyncCursor = { ...(conn.sync_cursor ?? {}) };
  cursor.contracts = { ...(cursor.contracts ?? {}) };

  try {
    const accounts = await refreshBrokerAccounts(sb, conn, token);
    const target = new Map(
      accounts.filter((a) => a.enabled && a.account_id).map((a) => [a.external_account_id, a]),
    );
    outcome.unmappedAccounts = accounts.filter((a) => a.enabled && !a.account_id).length;

    const [fills, orders, positions] = await Promise.all([
      tvGet<tv.TvFill[]>(env, token, "/fill/list"),
      tvGet<tv.TvOrder[]>(env, token, "/order/list"),
      tvGet<{ accountId: number; contractId: number; netPos: number }[]>(
        env,
        token,
        "/position/list",
      ),
    ]);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const relevant = fills.filter((f) => {
      const o = orderById.get(f.orderId);
      return o && target.has(String(o.accountId));
    });

    if (relevant.length) {
      const contracts = await resolveContracts(
        env,
        token,
        [...new Set(relevant.map((f) => f.contractId))],
        cursor.contracts,
      );
      // Les frais sont un plus, pas un prérequis : une API de frais
      // indisponible ne bloque pas le journal (frais à 0, P&L brut).
      const feeList = await tvItems<tv.TvFillFee>(
        env,
        token,
        "fillFee",
        relevant.map((f) => f.id),
      ).catch(() => [] as tv.TvFillFee[]);
      const fees = new Map(feeList.map((f) => [f.id, f]));
      const { fills: normalized } = tv.normalizeFills(relevant, orderById, contracts, fees);

      // Position AVANT la fenêtre reçue = position actuelle − somme des
      // exécutions reçues. Non nulle : le trade a commencé hors fenêtre, ses
      // sorties sont absorbées (`openingPositions`) au lieu d'être inventées.
      const net = new Map<string, number>();
      for (const f of normalized) {
        const key = positionKey(f.accountId, f.contractId);
        net.set(key, (net.get(key) ?? 0) + (f.side === "buy" ? f.qty : -f.qty));
      }
      const opening = new Map<string, number>();
      for (const p of positions) {
        const key = positionKey(String(p.accountId), String(p.contractId));
        if (!net.has(key)) continue;
        const before = Number(p.netPos) - (net.get(key) ?? 0);
        if (Math.abs(before) > 1e-9) opening.set(key, before);
      }

      const { trips } = buildRoundTrips("tradovate", normalized, { openingPositions: opening });
      const through: Record<string, string> = { ...(cursor.syncedThrough ?? {}) };
      const fresh = trips.filter((t) => !through[t.accountId] || t.exitTime > through[t.accountId]);

      if (fresh.length) {
        // Les stops ne sont lus que s'il y a quelque chose à journaliser.
        let stops: BrokerStopOrder[] = [];
        try {
          const versions = await tvGet<tv.TvOrderVersion[]>(env, token, "/orderVersion/list");
          stops = tv.stopOrders(orders, versions);
        } catch {
          stops = [];
        }
        const trades = fresh.map((trip) => {
          const mapping = target.get(trip.accountId)!;
          return roundTripToTrade(trip, {
            broker: "tradovate",
            id: crypto.randomUUID(),
            accountId: mapping.account_id,
            brokerAccountName: mapping.name,
            timeZone: conn.timezone,
            defaultRisk: conn.default_risk != null ? Number(conn.default_risk) : null,
            stops,
          });
        });
        const { inserted, planLimit } = await insertTrades(sb, conn.user_id, trades);
        outcome.inserted = inserted.map(rowToBrokerTrade);
        if (planLimit) outcome.error = "plan_limit";
        // Le curseur n'avance que jusqu'à ce qui a été réellement traité :
        // si la limite de l'offre a coupé le lot, la suite sera reprise.
        const done = planLimit
          ? trades.filter((t) => inserted.some((r) => r.external_id === t.externalId))
          : trades;
        for (const trip of fresh) {
          if (!done.some((t) => t.externalId === trip.externalId)) continue;
          const prev = through[trip.accountId];
          if (!prev || trip.exitTime > prev) through[trip.accountId] = trip.exitTime;
        }
        cursor.syncedThrough = through;
      }
    }
  } catch (e) {
    console.error("[broker-sync] tradovate", conn.id, e);
    return fail("broker_unreachable");
  }

  await sb
    .from("broker_connections")
    .update({
      last_sync_at: startedAt,
      last_success_at: startedAt,
      last_error: outcome.error,
      status: "active",
      sync_cursor: cursor,
    })
    .eq("id", conn.id);
  return outcome;
}

/** Ligne SQL → `Trade`, pour renvoyer au client ce qui vient d'arriver. */
export function rowToBrokerTrade(r: Record<string, unknown>): Trade {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: String(r.id),
    date: String(r.trade_date),
    symbol: String(r.symbol),
    direction: r.direction === "short" ? "short" : r.direction === "be" ? "be" : "long",
    pnl: Number(r.pnl),
    riskAmount: Number(r.risk_amount),
    rMultiple: Number(r.r_multiple),
    strategy: String(r.strategy ?? ""),
    mistakes: (r.mistakes as string[]) ?? [],
    setupQuality: Number(r.setup_quality),
    notes: String(r.notes ?? ""),
    screenshots: (r.screenshots as string[]) ?? [],
    entryTime: String(r.entry_time ?? ""),
    exitTime: String(r.exit_time ?? ""),
    confluences: (r.confluences as string[]) ?? [],
    confidence: Number(r.confidence),
    mae: null,
    mfe: null,
    slippage: null,
    accountId: (r.account_id as string | null) ?? null,
    quantity: num(r.quantity),
    entryPrice: num(r.entry_price),
    exitPrice: num(r.exit_price),
    fees: num(r.fees),
    broker: (r.broker as string | null) ?? null,
    externalId: (r.external_id as string | null) ?? null,
    brokerAccount: (r.broker_account as string | null) ?? null,
    reviewPending: !!r.review_pending,
  };
}

export const CONNECTION_COLUMNS =
  "id, user_id, broker, environment, label, status, token_ciphertext, token_expires_at, default_risk, default_account_id, timezone, last_sync_at, sync_cursor";

/** Les colonnes dont dépend le palier — les mêmes que lit `require-pro.ts`. */
export const ENTITLEMENT_COLUMNS =
  "user_id, plan, status, source, trial_ends_at, current_period_end";

/** Le palier ouvre-t-il la synchro broker ? Pur : partagé par le cron et la
 *  garde des server functions. Aucune ligne d'abonnement = gratuit. */
export function brokerSyncAllowed(row: EntitlementRow | null | undefined): boolean {
  return tierAtLeast(effectiveTier(row ?? null), "pro");
}

// ── Le cron de rattrapage ────────────────────────────────────────────────────

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Une fois par jour, en service-role : chaque connexion active d'un abonné
 * Pro qui n'a pas été synchronisée depuis une heure. Le rattrapage des journées sans app
 * ouverte — l'app, elle, synchronise toute seule pendant qu'elle tourne.
 * Budget de temps borné ; ce qui n'est pas traité l'est au passage suivant.
 */
export async function handleBrokerSyncCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);

  const { serviceClient } = await import("./billing.server");
  const sb = serviceClient();
  if (!sb) return json({ error: "supabase service credentials missing" }, 500);

  const budgetMs = Number(process.env.CRON_TIME_BUDGET_MS ?? "240000");
  const started = Date.now();
  const staleBefore = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data, error } = await sb
    .from("broker_connections")
    .select(CONNECTION_COLUMNS)
    .eq("status", "active")
    .or(`last_sync_at.is.null,last_sync_at.lt.${staleBefore}`)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  // Le palier Pro, vérifié pour TOUS les propriétaires en une requête (pas
  // une par connexion). Un abonnement échu n'est plus synchronisé ; ses
  // connexions restent, et reprennent dès que l'abonnement revient.
  const conns = (data ?? []) as ConnectionRow[];
  const owners = [...new Set(conns.map((c) => c.user_id))];
  const allowed = new Set<string>();
  if (owners.length) {
    const { data: subs, error: subError } = await sb
      .from("subscriptions")
      .select(ENTITLEMENT_COLUMNS)
      .in("user_id", owners);
    // Échoue FERMÉ : sans savoir qui paie, on ne synchronise personne.
    if (subError) return json({ error: subError.message }, 500);
    for (const row of (subs ?? []) as (EntitlementRow & { user_id: string })[]) {
      if (brokerSyncAllowed(row)) allowed.add(row.user_id);
    }
  }

  let synced = 0;
  let inserted = 0;
  let failed = 0;
  let skipped = 0;
  for (const conn of conns) {
    if (Date.now() - started > budgetMs) break;
    if (!allowed.has(conn.user_id)) {
      skipped++;
      continue;
    }
    const res = await syncConnection(sb, conn).catch(() => null);
    if (!res || res.error) failed++;
    else synced++;
    inserted += res?.inserted.length ?? 0;
  }
  return json({ synced, inserted, failed, skipped }, 200);
}
