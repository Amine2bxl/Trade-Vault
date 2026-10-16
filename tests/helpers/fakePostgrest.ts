/**
 * Un PostgREST EN MÉMOIRE, pour tester les outils serveur de Jarvis sans base.
 *
 * Les outils lisent la base avec le client de service (`serviceClient()`), qui
 * contourne la RLS : le cloisonnement par utilisateur et par compte est donc
 * porté par LEUR code. Le seul moyen honnête de le vérifier est de leur donner
 * une base qui contient AUSSI les lignes des autres — et de regarder ce qui
 * revient.
 *
 * Ce faux serveur applique réellement les filtres que le client envoie
 * (`eq`, `gte`, `lte`, `in`, `offset`, `limit`) : une requête qui oublie
 * `user_id=eq.…` rend les lignes d'un autre trader, et le test le voit. Un
 * opérateur inconnu fait échouer le test plutôt que d'être ignoré en silence.
 *
 * Les lignes sont rendues dans l'ordre où le test les fournit (le tri `order`
 * n'est pas rejoué) : fournir des lignes déjà triées comme la vraie requête.
 */

export type Row = Record<string, unknown>;

export interface PgCall {
  table: string;
  method: string;
  /** Les paramètres de requête, tels qu'envoyés (`user_id` → `eq.u1`). */
  params: Record<string, string>;
}

export interface FakePostgrest {
  calls: PgCall[];
  /** Les appels à une table donnée. */
  callsTo(table: string): PgCall[];
}

const BASE = "http://fake-postgrest.test";

function parseIn(v: string): string[] {
  return v
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""));
}

function matches(row: Row, column: string, filter: string): boolean {
  const dot = filter.indexOf(".");
  const op = filter.slice(0, dot);
  const value = filter.slice(dot + 1);
  const cell = row[column];
  const asText = cell === null || cell === undefined ? null : String(cell);
  switch (op) {
    case "eq":
      return asText === value;
    case "neq":
      return asText !== value;
    case "gte":
      return asText !== null && asText >= value;
    case "lte":
      return asText !== null && asText <= value;
    case "in":
      return asText !== null && parseIn(value).includes(asText);
    case "is":
      return value === "null" ? asText === null : String(cell) === value;
    default:
      throw new Error(`fakePostgrest : opérateur non géré « ${op} » sur ${column}`);
  }
}

const RESERVED = new Set(["select", "order", "offset", "limit", "columns", "on_conflict"]);

/**
 * Exécute `fn` avec un PostgREST factice branché sur `serviceClient()`.
 * `fail` : tables qui répondent une erreur (pour vérifier qu'un échec se DIT).
 */
export async function withFakePostgrest<T>(
  tables: Record<string, Row[]>,
  fn: (db: FakePostgrest) => Promise<T>,
  opts: { fail?: string[] } = {},
): Promise<T> {
  const realFetch = globalThis.fetch;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = BASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  const fail = new Set(opts.fail ?? []);
  const calls: PgCall[] = [];
  const db: FakePostgrest = {
    calls,
    callsTo: (table) => calls.filter((c) => c.table === table),
  };

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!href.startsWith(`${BASE}/rest/v1/`)) return realFetch(input, init);
    const u = new URL(href);
    const table = decodeURIComponent(u.pathname.replace("/rest/v1/", ""));
    const method = (
      init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
    ).toUpperCase();
    const params: Record<string, string> = {};
    for (const [k, v] of u.searchParams) params[k] = v;
    calls.push({ table, method, params });

    if (fail.has(table)) {
      return new Response(JSON.stringify({ message: `${table} unavailable`, code: "XX000" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (method !== "GET") {
      throw new Error(`fakePostgrest : écriture inattendue (${method} ${table})`);
    }
    let rows = [...(tables[table] ?? [])];
    for (const [column, filter] of Object.entries(params)) {
      if (RESERVED.has(column)) continue;
      rows = rows.filter((r) => matches(r, column, filter));
    }
    const offset = Number(params.offset ?? 0);
    const limit = params.limit !== undefined ? Number(params.limit) : rows.length;
    rows = rows.slice(offset, offset + limit);
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    return await fn(db);
  } finally {
    globalThis.fetch = realFetch;
    if (url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = url;
    if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }
}
