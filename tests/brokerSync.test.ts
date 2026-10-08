import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

/**
 * LA SYNCHRO BROKER, DE BOUT EN BOUT — sans réseau ni base.
 *
 * Tradovate est simulé au niveau de `fetch` (mêmes chemins, mêmes formes de
 * réponse que leur API REST) ; Supabase par un enregistreur de requêtes qui
 * applique la seule règle qui compte ici : `(user_id, external_id)` est
 * unique. Ce qui est vérifié, c'est ce qu'aucun autre test ne peut voir :
 *
 *   • les secrets n'atteignent jamais la base en clair ;
 *   • un aller-retour clos devient UN trade, complet, dans le bon compte ;
 *   • rejouer la synchro n'écrit rien de plus ;
 *   • un compte broker sans compte TradeVault choisi n'écrit rien.
 */

process.env.BROKER_CREDENTIALS_KEY = "k".repeat(48);

const { encryptSecret, decryptSecret, encryptJson, decryptJson, sha256Hex } =
  await import("../src/backend/broker-crypto.server");
const { syncConnection } = await import("../src/backend/broker-sync.server");

// ── Tradovate simulé ─────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const calls: string[] = [];
let positions = [{ accountId: 900, contractId: 7, netPos: 0 }];

function tradovateResponse(path: string): unknown {
  if (path.endsWith("/account/list")) return [{ id: 900, name: "APEX-123-01", active: true }];
  if (path.endsWith("/fill/list"))
    return [
      {
        id: 1,
        orderId: 11,
        contractId: 7,
        timestamp: "2026-10-08T13:30:00Z",
        action: "Buy",
        qty: 2,
        price: 20000,
        active: true,
      },
      {
        id: 2,
        orderId: 12,
        contractId: 7,
        timestamp: "2026-10-08T13:42:00Z",
        action: "Sell",
        qty: 2,
        price: 20012.5,
        active: true,
      },
    ];
  if (path.endsWith("/order/list"))
    return [
      { id: 11, accountId: 900, contractId: 7, timestamp: "2026-10-08T13:30:00Z", action: "Buy" },
      { id: 12, accountId: 900, contractId: 7, timestamp: "2026-10-08T13:42:00Z", action: "Sell" },
      {
        id: 13,
        accountId: 900,
        contractId: 7,
        timestamp: "2026-10-08T13:30:00.500Z",
        action: "Sell",
      },
    ];
  if (path.endsWith("/position/list")) return positions;
  if (path.includes("/contract/items")) return [{ id: 7, name: "MNQZ6", contractMaturityId: 70 }];
  if (path.includes("/contractMaturity/items")) return [{ id: 70, productId: 700 }];
  if (path.includes("/product/items")) return [{ id: 700, name: "MNQ", valuePerPoint: 2 }];
  if (path.includes("/fillFee/items"))
    return [
      { id: 1, commission: 0.74, exchangeFee: 0.5 },
      { id: 2, commission: 0.74, exchangeFee: 0.5 },
    ];
  if (path.endsWith("/orderVersion/list"))
    return [{ id: 131, orderId: 13, orderType: "Stop", stopPrice: 19990 }];
  return null;
}

beforeAll(() => {
  globalThis.fetch = (async (url: string | URL) => {
    const path = String(url);
    calls.push(path);
    return new Response(JSON.stringify(tradovateResponse(path)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

// ── Supabase simulé ──────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let updates: { table: string; patch: Row }[];

function fakeSb() {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "update" | "upsert" = "select";
      let payload: Row[] = [];
      let patch: Row = {};
      const builder = {
        select: () => builder,
        eq: (col: string, v: unknown) => {
          filters.push([col, v]);
          return builder;
        },
        update: (p: Row) => {
          op = "update";
          patch = p;
          return builder;
        },
        upsert: (rows: Row[], opts: { onConflict: string }) => {
          op = "upsert";
          const keys = opts.onConflict.split(",");
          const list = (tables[table] ??= []);
          payload = [];
          for (const r of rows) {
            // ON CONFLICT DO NOTHING sur la clé déclarée.
            if (list.some((e) => keys.every((k) => e[k] === r[k]))) continue;
            const row = { id: r.id ?? `gen-${list.length + 1}`, ...r };
            list.push(row);
            payload.push(row);
          }
          return builder;
        },
        then(resolve: (v: { data: unknown; error: null }) => void) {
          if (op === "update") {
            updates.push({ table, patch });
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          if (op === "upsert") return Promise.resolve({ data: payload, error: null }).then(resolve);
          const data = (tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v));
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

async function connection(defaultAccount: string | null) {
  return {
    id: "conn-1",
    user_id: "user-1",
    broker: "tradovate" as const,
    auth_mode: "credentials" as const,
    environment: "demo" as const,
    label: "me",
    status: "active" as const,
    secret_ciphertext: await encryptJson({
      username: "u",
      password: "p",
      cid: "1",
      sec: "s",
      deviceId: "d",
    }),
    token_ciphertext: await encryptSecret("valid-token"),
    // Valide encore deux heures : aucun appel d'authentification attendu.
    token_expires_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
    default_risk: null,
    default_account_id: defaultAccount,
    timezone: "America/New_York",
    last_sync_at: null,
    sync_cursor: {},
  };
}

beforeEach(() => {
  tables = { trades: [], broker_accounts: [] };
  updates = [];
  calls.length = 0;
  positions = [{ accountId: 900, contractId: 7, netPos: 0 }];
});

describe("le chiffrement des secrets broker", () => {
  test("aller-retour exact, et rien de lisible dans le texte chiffré", async () => {
    const sealed = await encryptSecret("mot-de-passe-tradovate");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("mot-de-passe");
    expect(await decryptSecret(sealed)).toBe("mot-de-passe-tradovate");
    expect(await decryptJson(await encryptJson({ a: 1 }))).toEqual({ a: 1 });
  });
  test("deux chiffrements du même secret diffèrent (IV aléatoire)", async () => {
    expect(await encryptSecret("x")).not.toBe(await encryptSecret("x"));
  });
  test("le state OAuth n'est gardé qu'en empreinte", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("la synchronisation", () => {
  test("un aller-retour clos devient UN trade complet, dans le compte choisi", async () => {
    const sb = fakeSb();
    const res = await syncConnection(sb, await connection("tv-acc-50k"));
    expect(res.error).toBeNull();
    expect(res.inserted).toHaveLength(1);
    const t = res.inserted[0];
    expect(t.accountId).toBe("tv-acc-50k");
    expect(t.symbol).toBe("MNQ");
    expect(t.direction).toBe("long");
    expect(t.quantity).toBe(2);
    expect(t.entryPrice).toBe(20000);
    expect(t.exitPrice).toBe(20012.5);
    // 12,5 points × 2 contrats × 2 $ = 50 $ brut ; 2 × 1,24 $ de frais.
    expect(t.fees).toBe(2.48);
    expect(t.pnl).toBe(47.52);
    // Stop initial à 19 990 : 10 points × 2 × 2 $ = 40 $ de risque.
    expect(t.riskAmount).toBe(40);
    expect(t.rMultiple).toBe(1.188);
    // Fuseau du trader : 13:30 UTC = 09:30 à New York.
    expect(t.date).toBe("2026-10-08");
    expect(t.entryTime).toBe("09:30");
    expect(t.exitTime).toBe("09:42");
    expect(t.reviewPending).toBe(true);
    expect(t.brokerAccount).toBe("APEX-123-01");
    expect(t.externalId).toBe("tradovate:900:1");
    // Aucun appel d'authentification : le jeton était valide.
    expect(calls.some((c) => c.includes("/auth/"))).toBe(false);
  });

  test("rejouer la synchro n'écrit rien de plus", async () => {
    const sb = fakeSb();
    const conn = await connection("tv-acc-50k");
    await syncConnection(sb, conn);
    // Le curseur écrit par le premier passage est relu au second.
    const cursor = updates.filter((u) => u.table === "broker_connections").at(-1)
      ?.patch.sync_cursor;
    const again = await syncConnection(sb, { ...conn, sync_cursor: cursor as never });
    expect(again.inserted).toEqual([]);
    expect(tables.trades).toHaveLength(1);
  });

  test("même sans curseur, la clé (user_id, external_id) empêche le doublon", async () => {
    const sb = fakeSb();
    const conn = await connection("tv-acc-50k");
    await syncConnection(sb, conn);
    const again = await syncConnection(sb, conn);
    expect(again.inserted).toEqual([]);
    expect(tables.trades).toHaveLength(1);
  });

  test("un compte broker sans compte TradeVault choisi n'écrit rien", async () => {
    const sb = fakeSb();
    const res = await syncConnection(sb, await connection(null));
    expect(res.inserted).toEqual([]);
    expect(res.unmappedAccounts).toBe(1);
    expect(tables.trades).toHaveLength(0);
  });

  test("un compte rattaché APRÈS coup reçoit encore ses trades récents", async () => {
    const sb = fakeSb();
    const conn = await connection(null);
    const first = await syncConnection(sb, conn);
    expect(first.inserted).toEqual([]);
    // Le trader choisit maintenant le compte TradeVault de ce compte broker.
    tables.broker_accounts[0].account_id = "tv-acc-25k";
    const cursor = updates.filter((u) => u.table === "broker_connections").at(-1)
      ?.patch.sync_cursor;
    const second = await syncConnection(sb, { ...conn, sync_cursor: cursor as never });
    expect(second.inserted).toHaveLength(1);
    expect(second.inserted[0].accountId).toBe("tv-acc-25k");
  });

  test("aucun secret en clair n'est écrit en base", async () => {
    const sb = fakeSb();
    await syncConnection(sb, await connection("tv-acc-50k"));
    const written = JSON.stringify([tables, updates]);
    expect(written).not.toContain("valid-token");
    expect(written).not.toContain('"password"');
  });
});
