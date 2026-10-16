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
 *   • un compte broker sans compte TradeVault choisi n'écrit rien ;
 *   • LECTURE SEULE : tout ce qui part vers Tradovate est un `GET` sur la
 *     liste blanche — aucun ordre, aucun profil, aucun mot de passe ;
 *   • un jeton expiré met la connexion « à reconnecter », sans rien tenter —
 *     sauf s'il reste un `refresh_token` OAuth, qui en redonne un ;
 *   • l'hôte d'API dédié d'une prop firm (redirection 307) est suivi avec le
 *     jeton, et seulement vers un hôte Tradovate / NinjaTrader ;
 *   • l'adresse de retour OAuth suit l'origine de l'appel, jamais un hôte
 *     inconnu ;
 *   • seul un abonné Pro est synchronisé par le cron.
 */

process.env.BROKER_CREDENTIALS_KEY = "k".repeat(48);
process.env.TRADOVATE_CLIENT_ID = "app-client-id";
process.env.TRADOVATE_CLIENT_SECRET = "app-client-secret";

const { encryptSecret, decryptSecret, encryptJson, decryptJson, sha256Hex } =
  await import("../src/backend/broker-crypto.server");
const { syncConnection, brokerSyncAllowed, advanceCursor, detectEnvironment, cronSlotActive } =
  await import("../src/backend/broker-sync.server");
const { assertReadOnly, READ_ONLY_ENDPOINTS, exchangeOAuthCode } =
  await import("../src/backend/tradovate.server");
const { parseTokenResponse, parseApiHosts, isTrustedTradovateHost } =
  await import("../src/modules/brokers/tradovate");
const { oauthRedirectUri } = await import("../src/backend/broker-oauth.server");

// ── Tradovate simulé ─────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const calls: string[] = [];
const methods: string[] = [];
const auths: (string | null)[] = [];
const bodies: string[] = [];
let positions = [{ accountId: 900, contractId: 7, netPos: 0 }];
/** Une redirection à renvoyer pour cette URL (hôte dédié d'une prop firm). */
let redirectFor: ((url: string) => string | null) | null = null;
/** Comptes renvoyés par hôte — pour la détection d'environnement. */
let accountsByHost: Record<string, unknown[]> | null = null;
/** Statut HTTP imposé au serveur de jetons (panne passagère simulée). */
let tokenStatus: number | null = null;

function tradovateResponse(path: string): unknown {
  if (path.endsWith("/account/list")) {
    if (accountsByHost) return accountsByHost[new URL(path).host] ?? [];
    return [{ id: 900, name: "APEX-123-01", active: true }];
  }
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
  if (path.endsWith("/auth/renewaccesstoken"))
    return {
      accessToken: "renewed-token",
      expirationTime: new Date(Date.now() + 90 * 60_000).toISOString(),
      userId: 42,
    };
  if (path.endsWith("/auth/oauthtoken"))
    return {
      access_token: "refreshed-token",
      token_type: "bearer",
      expires_in: 4800,
      refresh_token: "next-refresh-token",
    };
  return null;
}

beforeAll(() => {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    calls.push(path);
    methods.push((init?.method ?? "GET").toUpperCase());
    const headers = (init?.headers ?? {}) as Record<string, string>;
    auths.push(headers.authorization ?? null);
    bodies.push(typeof init?.body === "string" ? init.body : "");
    if (tokenStatus && path.endsWith("/auth/oauthtoken")) {
      return new Response("<html>Bad gateway</html>", { status: tokenStatus });
    }
    const location = redirectFor?.(path) ?? null;
    if (location) return new Response(null, { status: 307, headers: { location } });
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

async function connection(
  defaultAccount: string | null,
  expiresInMs = 2 * 3600_000,
  refreshToken: string | null = null,
) {
  return {
    id: "conn-1",
    user_id: "user-1",
    broker: "tradovate" as const,
    environment: "demo" as const,
    label: "me",
    status: "active" as const,
    token_ciphertext: await encryptSecret("valid-token"),
    // Par défaut valide encore deux heures : aucun appel d'authentification.
    token_expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    refresh_token_ciphertext: refreshToken ? await encryptSecret(refreshToken) : null,
    api_hosts: {},
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
  methods.length = 0;
  auths.length = 0;
  bodies.length = 0;
  positions = [{ accountId: 900, contractId: 7, netPos: 0 }];
  redirectFor = null;
  accountsByHost = null;
  tokenStatus = null;
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

  test("sans BROKER_CREDENTIALS_KEY : clé dérivée du secret de service, préfixe d1", async () => {
    const explicit = process.env.BROKER_CREDENTIALS_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      delete process.env.BROKER_CREDENTIALS_KEY;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "s".repeat(64);
      const sealed = await encryptSecret("jeton-tradovate");
      expect(sealed.startsWith("d1:")).toBe(true);
      expect(sealed).not.toContain("jeton");
      expect(await decryptSecret(sealed)).toBe("jeton-tradovate");
      // Poser la clé explicite PLUS TARD ne rend pas illisible ce qui a été
      // scellé avec la clé dérivée ; les nouveaux scellés passent en v1.
      process.env.BROKER_CREDENTIALS_KEY = "k".repeat(48);
      expect(await decryptSecret(sealed)).toBe("jeton-tradovate");
      expect((await encryptSecret("x")).startsWith("v1:")).toBe(true);
      // Une autre clé de service ne déchiffre pas : la dérivation dépend bien
      // du secret, pas d'une constante.
      delete process.env.BROKER_CREDENTIALS_KEY;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "t".repeat(64);
      await expect(decryptSecret(sealed)).rejects.toThrow();
    } finally {
      process.env.BROKER_CREDENTIALS_KEY = explicit;
      if (service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = service;
    }
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

describe("le jeton : renouvelé, jamais redemandé", () => {
  test("proche de l'expiration : renouvelé par un GET, et réécrit chiffré", async () => {
    const sb = fakeSb();
    const res = await syncConnection(sb, await connection("tv-acc-50k", 5 * 60_000));
    expect(res.error).toBeNull();
    expect(calls.filter((c) => c.endsWith("/auth/renewaccesstoken"))).toHaveLength(1);
    const patch = updates.find((u) => u.patch.token_ciphertext)?.patch;
    expect(String(patch?.token_ciphertext)).toMatch(/^v1:/);
    expect(await decryptSecret(String(patch?.token_ciphertext))).toBe("renewed-token");
    expect(JSON.stringify(updates)).not.toContain("renewed-token");
  });

  test("expiré : « à reconnecter », sans le moindre appel chez Tradovate", async () => {
    const sb = fakeSb();
    const res = await syncConnection(sb, await connection("tv-acc-50k", -60_000));
    expect(res.error).toBe("reauth_required");
    expect(res.inserted).toEqual([]);
    expect(calls).toEqual([]);
    const patch = updates.find((u) => u.table === "broker_connections")?.patch;
    expect(patch?.status).toBe("error");
    expect(patch?.last_error).toBe("reauth_required");
  });

  test("expiré mais refresh_token présent : nouveau jeton, sans renvoyer le trader chez Tradovate", async () => {
    const sb = fakeSb();
    const res = await syncConnection(
      sb,
      await connection("tv-acc-50k", -60_000, "first-refresh-token"),
    );
    expect(res.error).toBeNull();
    expect(res.inserted).toHaveLength(1);
    // Un seul POST : le refresh, qui ne porte que l'identité de l'APPLICATION
    // et le jeton — jamais un identifiant ni un mot de passe du trader.
    const posts = methods.map((m, i) => [m, i] as const).filter(([m]) => m === "POST");
    expect(posts).toHaveLength(1);
    const form = new URLSearchParams(bodies[posts[0][1]]);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("first-refresh-token");
    expect([...form.keys()].sort()).toEqual(
      ["client_id", "client_secret", "grant_type", "refresh_token"].sort(),
    );
    // Le nouveau jeton ET le nouveau refresh_token sont réécrits chiffrés.
    const patch = updates.find((u) => u.patch.token_ciphertext)?.patch;
    expect(await decryptSecret(String(patch?.token_ciphertext))).toBe("refreshed-token");
    expect(await decryptSecret(String(patch?.refresh_token_ciphertext))).toBe("next-refresh-token");
    const written = JSON.stringify(updates);
    expect(written).not.toContain("refreshed-token");
    expect(written).not.toContain("next-refresh-token");
    // Les données ont ensuite été lues avec le jeton neuf.
    expect(auths.filter((a) => a === "Bearer refreshed-token").length).toBeGreaterThan(0);
  });
});

describe("une panne passagère n'est pas une révocation", () => {
  for (const status of [502, 503, 429]) {
    test(`refresh en HTTP ${status} : la connexion reste active et sera retentée`, async () => {
      tokenStatus = status;
      const sb = fakeSb();
      const res = await syncConnection(
        sb,
        await connection("tv-acc-50k", -60_000, "still-valid-refresh"),
      );
      expect(res.error).toBe("broker_unreachable");
      const patch = updates.find((u) => u.table === "broker_connections")?.patch;
      // Surtout pas « error » : syncBrokers et le cron ne relisent que les
      // connexions actives, la connexion serait perdue pour de bon.
      expect(patch?.status).toBeUndefined();
      expect(patch?.last_error).toBe("broker_unreachable");
    });
  }

  test("renouvellement en panne mais jeton encore valide : la synchro continue avec lui", async () => {
    const realFetchMock = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith("/auth/renewaccesstoken")) {
        calls.push(String(url));
        methods.push("GET");
        return new Response("", { status: 503 });
      }
      return realFetchMock(url, init);
    }) as typeof fetch;
    try {
      const sb = fakeSb();
      const res = await syncConnection(sb, await connection("tv-acc-50k", 5 * 60_000));
      expect(res.error).toBeNull();
      expect(res.inserted).toHaveLength(1);
    } finally {
      globalThis.fetch = realFetchMock;
    }
  });
});

describe("le cron passe avant la clôture CME, une fois par jour", () => {
  test("créneau d'été en été, créneau d'hiver en hiver", () => {
    const summer = new Date("2026-07-15T20:30:00Z");
    const winter = new Date("2026-01-15T21:30:00Z");
    expect(cronSlotActive("edt", summer)).toBe(true);
    expect(cronSlotActive("est", summer)).toBe(false);
    expect(cronSlotActive("edt", winter)).toBe(false);
    expect(cronSlotActive("est", winter)).toBe(true);
    // Appel manuel, sans créneau : il travaille toujours.
    expect(cronSlotActive(null, winter)).toBe(true);
  });
});

describe("hôtes dédiés (NinjaTrader, octobre 2026)", () => {
  test("une redirection 307 vers l'hôte de la prop firm est suivie AVEC le jeton, puis retenue", async () => {
    const sb = fakeSb();
    redirectFor = (url) =>
      url.startsWith("https://demo.tradovateapi.com/")
        ? url.replace("demo.tradovateapi.com", "firm-a.tradovateapi.com")
        : null;
    const res = await syncConnection(sb, await connection("tv-acc-50k"));
    expect(res.error).toBeNull();
    expect(res.inserted).toHaveLength(1);
    // La requête suivie part avec l'en-tête d'autorisation (que `fetch`
    // retire en suivant seul une redirection vers une autre origine).
    const followed = calls.findIndex((c) => c.startsWith("https://firm-a.tradovateapi.com/"));
    expect(followed).toBeGreaterThan(-1);
    expect(auths[followed]).toBe("Bearer valid-token");
    // Une fois l'hôte connu, plus aucun détour par l'hôte partagé.
    expect(calls.filter((c) => c.startsWith("https://demo.tradovateapi.com/"))).toHaveLength(1);
    const patch = updates.filter((u) => u.table === "broker_connections").at(-1)?.patch;
    expect(patch?.api_hosts).toEqual({ demo: "firm-a.tradovateapi.com" });
  });

  test("une redirection vers un hôte inconnu n'est jamais suivie : le jeton ne sort pas", async () => {
    const sb = fakeSb();
    redirectFor = (url) =>
      url.includes("tradovateapi.com") ? "https://evil.example.com/v1/account/list" : null;
    const res = await syncConnection(sb, await connection("tv-acc-50k"));
    expect(res.error).toBe("broker_unreachable");
    expect(calls.some((c) => c.includes("evil.example.com"))).toBe(false);
  });

  test("seuls les hôtes Tradovate / NinjaTrader sont de confiance", () => {
    expect(isTrustedTradovateHost("live.tradovateapi.com")).toBe(true);
    expect(isTrustedTradovateHost("firm.api.ninjatrader.com")).toBe(true);
    expect(isTrustedTradovateHost("tradovateapi.com.evil.io")).toBe(false);
    expect(isTrustedTradovateHost("eviltradovateapi.com")).toBe(false);
    expect(isTrustedTradovateHost("live.tradovateapi.com/x")).toBe(false);
    expect(
      parseApiHosts({
        apiHosts: { live: "https://firm.tradovateapi.com/v1", demo: "attacker.io" },
      }),
    ).toEqual({ live: "firm.tradovateapi.com" });
  });
});

describe("l'échange OAuth et la détection d'environnement", () => {
  test("réponse OAuth (snake_case) et renouvellement (camelCase) se lisent pareil", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const oauth = parseTokenResponse(
      { access_token: "a", expires_in: 4800, refresh_token: "r" },
      now,
    );
    expect(oauth).toEqual({
      ok: true,
      accessToken: "a",
      expiresAt: "2026-10-09T13:20:00.000Z",
      refreshToken: "r",
      apiHosts: {},
    });
    const renew = parseTokenResponse(
      { accessToken: "b", expirationTime: "2026-10-09T13:30:00.000Z" },
      now,
    );
    expect(renew.ok && renew.accessToken).toBe("b");
    expect(renew.ok && renew.refreshToken).toBeNull();
    expect(parseTokenResponse({ error: "invalid_grant" }, now).ok).toBe(false);
    const penalty = parseTokenResponse({ "p-ticket": "t", "p-time": 5 }, now);
    expect(!penalty.ok && penalty.reason).toBe("penalty");
  });

  test("l'échange du code renvoie l'adresse de retour à l'identique, en formulaire", async () => {
    const res = await exchangeOAuthCode("one-time-code", "https://preview.vercel.app/brokers");
    expect(res.ok).toBe(true);
    expect(methods).toEqual(["POST"]);
    const form = new URLSearchParams(bodies[0]);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("one-time-code");
    expect(form.get("redirect_uri")).toBe("https://preview.vercel.app/brokers");
    expect(form.get("client_id")).toBe("app-client-id");
    expect(form.has("password")).toBe(false);
    expect(form.has("username")).toBe(false);
  });

  test("un login prop firm sans compte « live » bascule sur « démo » tout seul", async () => {
    accountsByHost = {
      "live.tradovateapi.com": [],
      "demo.tradovateapi.com": [{ id: 900, name: "APEX-1", active: true }],
    };
    expect(await detectEnvironment("live", "tok", {})).toBe("demo");
    accountsByHost = {
      "live.tradovateapi.com": [{ id: 1, name: "LIVE-1", active: true }],
      "demo.tradovateapi.com": [{ id: 900, name: "APEX-1", active: true }],
    };
    expect(await detectEnvironment("live", "tok", {})).toBe("live");
    accountsByHost = {};
    expect(await detectEnvironment("demo", "tok", {})).toBe("demo");
  });
});

describe("l'adresse de retour OAuth", () => {
  const saved = { ...process.env };
  afterAll(() => {
    for (const k of [
      "TRADOVATE_REDIRECT_URI",
      "VERCEL_BRANCH_URL",
      "VERCEL_URL",
      "TRADOVATE_REDIRECT_ORIGINS",
    ]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  test("suit l'origine de l'appel quand c'est la nôtre", () => {
    delete process.env.TRADOVATE_REDIRECT_URI;
    process.env.VERCEL_BRANCH_URL = "tradevault-git-feature-team.vercel.app";
    expect(oauthRedirectUri("https://tradevault-git-feature-team.vercel.app")).toBe(
      "https://tradevault-git-feature-team.vercel.app/brokers",
    );
    expect(oauthRedirectUri("http://localhost:8080")).toBe("http://localhost:8080/brokers");
  });

  test("une origine inconnue ne choisit jamais l'adresse : domaine canonique", () => {
    delete process.env.TRADOVATE_REDIRECT_URI;
    for (const origin of [
      "https://evil.example.com",
      "http://tradevault-git-feature-team.vercel.app",
      "javascript:alert(1)",
      null,
    ]) {
      expect(oauthRedirectUri(origin)).toMatch(/^https:\/\/[^/]+\/brokers$/);
      expect(oauthRedirectUri(origin)).not.toContain("evil");
      expect(oauthRedirectUri(origin)).not.toContain("vercel.app");
    }
  });

  test("TRADOVATE_REDIRECT_URI l'emporte partout", () => {
    process.env.TRADOVATE_REDIRECT_URI = "https://tradevault.be/brokers";
    expect(oauthRedirectUri("http://localhost:8080")).toBe("https://tradevault.be/brokers");
  });
});

describe("le curseur ne saute jamais un trade non écrit", () => {
  const trip = (accountId: string, exitTime: string, externalId: string) => ({
    accountId,
    exitTime,
    externalId,
  });

  test("il s'arrête au premier aller-retour non traité de chaque compte", () => {
    const out = advanceCursor(
      {},
      [
        trip("A", "2026-10-08T14:00:00Z", "a1"),
        trip("A", "2026-10-08T15:00:00Z", "a2"),
        trip("A", "2026-10-08T16:00:00Z", "a3"),
        trip("B", "2026-10-08T15:30:00Z", "b1"),
      ],
      new Set(["a1", "a3", "b1"]),
    );
    expect(out).toEqual({ A: "2026-10-08T14:00:00Z", B: "2026-10-08T15:30:00Z" });
  });

  test("à sortie égale, le non traité bloque l'avance", () => {
    const at = "2026-10-08T14:00:00Z";
    const out = advanceCursor(
      { A: "2026-10-08T13:00:00Z" },
      [trip("A", at, "done"), trip("A", at, "todo")],
      new Set(["done"]),
    );
    expect(out).toEqual({ A: "2026-10-08T13:00:00Z" });
  });
});

describe("lecture seule, par construction", () => {
  test("une synchro complète n'envoie que des GET, tous sur la liste blanche", async () => {
    const sb = fakeSb();
    await syncConnection(sb, await connection("tv-acc-50k", 5 * 60_000));
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
    for (const url of calls) {
      const path = url.replace(/^https:\/\/(live|demo)\.tradovateapi\.com\/v1/, "");
      if (path === "/auth/renewaccesstoken") continue;
      expect(() => assertReadOnly(path)).not.toThrow();
    }
  });

  test("passer, modifier ou annuler un ordre est refusé avant tout réseau", () => {
    for (const path of [
      "/order/placeorder",
      "/order/placeOSO",
      "/order/modifyorder",
      "/order/cancelorder",
      "/order/liquidateposition",
      "/account/item?id=1",
      "/cashBalance/getcashbalancesnapshot",
      "/auth/me",
      "/user/list",
      "/userProperty/list",
      "/fill/list/../../order/placeorder",
      "/contract/items?ids=1;drop",
    ]) {
      expect(() => assertReadOnly(path)).toThrow(/read-only/);
    }
  });

  test("la liste blanche ne contient que des lectures", () => {
    for (const re of READ_ONLY_ENDPOINTS) {
      expect(re.source).toMatch(/\\\/(list|items)/);
      expect(re.source).not.toMatch(/place|modify|cancel|liquidate|auth|user/i);
    }
  });
});

describe("Pro uniquement", () => {
  test("le cron ne synchronise qu'un abonnement Pro ou Elite actif", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(brokerSyncAllowed(null)).toBe(false);
    expect(brokerSyncAllowed({ plan: "free", status: "active", source: "signup" })).toBe(false);
    expect(brokerSyncAllowed({ plan: "pro_monthly", status: "active", source: "stripe" })).toBe(
      true,
    );
    expect(
      brokerSyncAllowed({
        plan: "elite_yearly",
        status: "active",
        source: "stripe",
        current_period_end: future,
      }),
    ).toBe(true);
    expect(brokerSyncAllowed({ plan: "pro_monthly", status: "canceled", source: "stripe" })).toBe(
      false,
    );
    expect(
      brokerSyncAllowed({
        plan: "pro_monthly",
        status: "active",
        source: "crypto",
        current_period_end: "2020-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});

describe("le retour OAuth n'accepte que le state de l'URL", () => {
  test("aucun state gardé ni substitué côté navigateur", async () => {
    const { readSource } = await import("./helpers/source");
    const page = readSource(import.meta.dir, "../src/app/features/brokers/Brokers.tsx");
    // Substituer un state stocké à un state absent laissait un code obtenu par
    // un tiers sur SON compte Tradovate se greffer sur la session du trader.
    expect(page).toContain('const state = params.get("state");');
    expect(page).not.toMatch(/params\.get\("state"\)\s*\|\|/);
    expect(page).not.toContain("recallState");
  });
});
