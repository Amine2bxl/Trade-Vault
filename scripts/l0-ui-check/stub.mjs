/**
 * VÉRIFICATION DE RENDU DU LOT 0 — doublure Supabase EN MÉMOIRE.
 *
 * USAGE (depuis la racine du dépôt)
 *   node scripts/l0-ui-check/seed.mjs /tmp/l0-seed.json
 *   node scripts/l0-ui-check/stub.mjs /tmp/l0-seed.json &          # :5199
 *   VITE_SUPABASE_URL=http://127.0.0.1:5199 VITE_SUPABASE_PUBLISHABLE_KEY=stub \
 *   SUPABASE_URL=http://127.0.0.1:5199 SUPABASE_PUBLISHABLE_KEY=stub \
 *     bunx vite dev --host 127.0.0.1 --port 5181 &
 *   node scripts/l0-ui-check/render.mjs /tmp/l0-shots   # pages, bureau + mobile
 *   curl http://127.0.0.1:5199/__reset
 *   node scripts/l0-ui-check/flow.mjs /tmp/l0-shots     # import CSV → relecture → rapports
 *
 * Ce que ce harnais PROUVE : le code applicatif complet (composants, moteurs,
 * fonctions serveur, écritures REST) rend les bons états sur des données dont
 * les chiffres sont calculés à la main dans `seed.mjs`.
 * Ce qu'il NE PROUVE PAS : le comportement contre la vraie base (RLS, triggers,
 * auth réelle). C'est un contrôle de rendu, pas un E2E authentifié — ce
 * dernier exige un accès réseau à Supabase depuis le poste qui l'exécute.
 *
 * N'est PAS un E2E authentifié : aucune requête ne quitte la machine.
 * Implémente le strict nécessaire de PostgREST (filtres eq/gte/lte/in/is,
 * order, range, insert/upsert, patch, delete) et de GoTrue (mot de passe).
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.STUB_PORT ?? 5199);
const SEED_PATH = process.argv[2];
let SEED = JSON.parse(readFileSync(SEED_PATH, "utf-8"));
let TABLES = SEED.tables;
const USER = SEED.user;

function parseFilter(raw) {
  const i = raw.indexOf(".");
  let op = raw.slice(0, i);
  let val = raw.slice(i + 1);
  let neg = false;
  if (op === "not") {
    neg = true;
    const j = val.indexOf(".");
    op = val.slice(0, j);
    val = val.slice(j + 1);
  }
  return { op, val, neg };
}
function test(row, col, { op, val, neg }) {
  const v = row[col];
  let ok;
  if (op === "eq") ok = String(v) === val;
  else if (op === "neq") ok = String(v) !== val;
  else if (op === "gte") ok = v >= val;
  else if (op === "gt") ok = v > val;
  else if (op === "lte") ok = v <= val;
  else if (op === "lt") ok = v < val;
  else if (op === "is") ok = val === "null" ? v === null || v === undefined : String(v) === val;
  else if (op === "in")
    ok = val
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((s) => s.replace(/"/g, ""))
      .includes(String(v));
  else ok = true;
  return neg ? !ok : ok;
}
const RESERVED = new Set([
  "select",
  "order",
  "limit",
  "offset",
  "on_conflict",
  "columns",
  "or",
  "and",
]);

function query(table, params) {
  let rows = [...(TABLES[table] ?? [])];
  for (const [k, raw] of params) {
    if (RESERVED.has(k)) continue;
    const f = parseFilter(raw);
    rows = rows.filter((r) => test(r, k, f));
  }
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((s) => s.split("."));
    rows.sort((a, b) => {
      for (const [col, dir] of keys) {
        const x = a[col] ?? "";
        const y = b[col] ?? "";
        if (x < y) return dir === "desc" ? 1 : -1;
        if (x > y) return dir === "desc" ? -1 : 1;
      }
      return 0;
    });
  }
  return rows;
}

const log = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
    "access-control-expose-headers": "content-range",
  };
  const send = (status, body, extra = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...cors, ...extra });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : null;
    if (p === "/__state") return send(200, TABLES);
    if (p === "/__reset") {
      SEED = JSON.parse(readFileSync(SEED_PATH, "utf-8"));
      TABLES = SEED.tables;
      log.length = 0;
      return send(200, { reset: true });
    }
    if (p === "/__log") return send(200, log);
    if (p.startsWith("/auth/v1/token"))
      return send(200, {
        access_token: "stub.token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "r",
        user: USER,
      });
    if (p.startsWith("/auth/v1/user")) return send(200, USER);
    if (p.startsWith("/auth/v1/logout")) return send(204);
    if (p.startsWith("/auth/v1/")) return send(200, {});
    if (p.startsWith("/rest/v1/rpc/")) return send(200, null);
    if (p.startsWith("/rest/v1/")) {
      const table = p.replace("/rest/v1/", "");
      TABLES[table] ??= [];
      const params = url.searchParams;
      const single = (req.headers["accept"] ?? "").includes("vnd.pgrst.object");
      if (req.method === "GET" || req.method === "HEAD") {
        let rows = query(table, params);
        const range = req.headers["range"];
        if (range) {
          const [a, b] = range.split("-").map(Number);
          rows = rows.slice(a, b + 1);
        }
        const limit = Number(params.get("limit"));
        if (limit)
          rows = rows.slice(
            Number(params.get("offset") ?? 0),
            Number(params.get("offset") ?? 0) + limit,
          );
        if (single) {
          if (!rows[0]) return send(406, { code: "PGRST116", message: "0 rows" });
          return send(200, rows[0]);
        }
        return send(200, rows, {
          "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
        });
      }
      if (req.method === "POST") {
        const list = Array.isArray(body) ? body : [body];
        const conflict = (params.get("on_conflict") ?? "id").split(",");
        const out = [];
        for (const row of list) {
          const idx = TABLES[table].findIndex((r) =>
            conflict.every((c) => r[c] !== undefined && r[c] === row[c]),
          );
          const merged = { id: row.id ?? `${table}-${TABLES[table].length + 1}`, ...row };
          if (idx >= 0) TABLES[table][idx] = { ...TABLES[table][idx], ...row };
          else TABLES[table].push(merged);
          out.push(idx >= 0 ? TABLES[table][idx] : merged);
        }
        log.push({ method: "POST", table, rows: list });
        return send(201, single ? out[0] : out);
      }
      if (req.method === "PATCH") {
        const rows = query(table, params);
        for (const r of rows) Object.assign(r, body);
        log.push({ method: "PATCH", table, filter: url.search, body });
        return send(200, single ? rows[0] : rows);
      }
      if (req.method === "DELETE") {
        const rows = query(table, params);
        TABLES[table] = TABLES[table].filter((r) => !rows.includes(r));
        log.push({ method: "DELETE", table, filter: url.search });
        return send(200, rows);
      }
    }
    if (p.startsWith("/storage/v1/")) return send(200, []);
    if (p.startsWith("/functions/v1/")) return send(200, {});
    return send(404, { message: "stub: unknown " + p });
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`stub on :${PORT}`));
