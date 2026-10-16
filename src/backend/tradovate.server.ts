/**
 * Client HTTP Tradovate — serveur uniquement, LECTURE SEULE.
 *
 * ── AUCUN MOT DE PASSE ──────────────────────────────────────────────────────
 * Le trader se connecte CHEZ Tradovate, sur leur page (OAuth « Se connecter
 * avec Tradovate »). Son identifiant, son mot de passe et son e-mail restent
 * dans la base de Tradovate : TradeVault ne les voit jamais, ne les reçoit
 * jamais, ne les stocke jamais. Il ne reçoit que des JETONS (accès +
 * renouvellement), que le serveur chiffre avant de les écrire
 * (`broker-crypto.server.ts`). Exige que TradeVault soit enregistré comme
 * application OAuth chez Tradovate / NinjaTrader :
 * `TRADOVATE_CLIENT_ID` / `TRADOVATE_CLIENT_SECRET`.
 *
 * ── LECTURE SEULE, PAR CONSTRUCTION ─────────────────────────────────────────
 * Deux garde-fous indépendants :
 *   1. côté Tradovate, l'application est déclarée en permissions « Read Only »
 *      (comptes, ordres, positions, bibliothèque de contrats) — réglage du
 *      propriétaire, voir `docs/BACKEND.md` §9 ;
 *   2. ICI, aucun appel de données ne part hors de `READ_ONLY_ENDPOINTS` :
 *      uniquement des `GET` sur des listes et des fiches. Passer un ordre,
 *      annuler, modifier un compte ou lire le profil privé (`/auth/me`,
 *      `/user/*`) est impossible depuis ce module, même par erreur de
 *      programmation : `tvGet` refuse le chemin avant tout réseau. Les seuls
 *      `POST` sont l'échange du code OAuth et le `refresh_token`, qui ne
 *      portent que des identifiants d'APPLICATION et un jeton.
 *
 * ── HÔTES DYNAMIQUES (NinjaTrader, octobre 2026) ────────────────────────────
 * Une prop firm peut avoir son hôte d'API dédié, renvoyé dans `apiHosts` par
 * l'échange, le renouvellement et le refresh. Un appel vers l'hôte partagé
 * reçoit alors une redirection 307 — et `fetch` retire l'en-tête
 * `Authorization` en changeant d'origine : la requête suivie arrive anonyme
 * et échoue en 401. Les redirections sont donc suivies À LA MAIN, le jeton
 * n'étant renvoyé qu'à un hôte de confiance, et le nouvel hôte est retenu
 * dans la session pour être enregistré.
 *
 * ── DURÉE DE VIE ────────────────────────────────────────────────────────────
 * Un jeton d'accès vit environ 90 minutes. Il se renouvelle par
 * `GET /auth/renewaccesstoken` tant qu'il est valide ; expiré, le
 * `refresh_token` OAuth en redonne un sans renvoyer le trader chez Tradovate.
 * Sans l'un ni l'autre, la connexion passe « à reconnecter ».
 */

import {
  isTrustedTradovateHost,
  mergeApiHosts,
  parseTokenResponse,
  type ApiHosts,
  type TvTokenResult,
} from "@/modules/brokers/tradovate";

export type TvEnvironment = "live" | "demo";

const DEFAULT_HOSTS: Record<TvEnvironment, string> = {
  live: "live.tradovateapi.com",
  demo: "demo.tradovateapi.com",
};

/** Page de connexion OAuth de Tradovate (celle de leur exemple officiel). */
export const TRADOVATE_AUTHORIZE_URL =
  process.env.TRADOVATE_AUTHORIZE_URL || "https://trader.tradovate.com/oauth";

/** Échange du code et refresh. Surchargé par l'environnement si Tradovate
 *  change d'hôte (leur documentation en cite plusieurs). */
function oauthTokenUrl(): string {
  return process.env.TRADOVATE_OAUTH_TOKEN_URL || "https://live.tradovateapi.com/auth/oauthtoken";
}

/**
 * LES SEULS CHEMINS DE DONNÉES QUE TRADEVAULT APPELLE CHEZ TRADOVATE.
 *
 * Des LECTURES de données de trading — comptes, exécutions, ordres et leurs
 * versions (pour retrouver le stop initial), positions, frais, fiches de
 * contrat. Rien d'autre : ni écriture, ni profil utilisateur. Ajouter une
 * entrée ici doit rester une lecture.
 */
export const READ_ONLY_ENDPOINTS: readonly RegExp[] = [
  /^\/account\/list$/,
  /^\/fill\/list$/,
  /^\/order\/list$/,
  /^\/orderVersion\/list$/,
  /^\/position\/list$/,
  /^\/fillFee\/items\?ids=[\d,]+$/,
  /^\/contract\/items\?ids=[\d,]+$/,
  /^\/contractMaturity\/items\?ids=[\d,]+$/,
  /^\/product\/items\?ids=[\d,]+$/,
];

export class TradovateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Refuse tout chemin hors de la liste blanche — avant le moindre réseau. */
export function assertReadOnly(path: string): void {
  if (!READ_ONLY_ENDPOINTS.some((re) => re.test(path))) {
    throw new TradovateError(`blocked: ${path} is not a read-only endpoint`, 0);
  }
}

/** Délai maximal d'un appel : une API lente ne doit pas consommer tout le
 *  budget d'une server function. */
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export function tradovateOAuthConfigured(): boolean {
  return !!process.env.TRADOVATE_CLIENT_ID && !!process.env.TRADOVATE_CLIENT_SECRET;
}

/**
 * Une session d'appels pour UNE connexion : environnement, jeton, hôtes.
 * `hostsChanged` signale qu'une redirection a révélé un hôte dédié à
 * enregistrer.
 */
export interface TvSession {
  env: TvEnvironment;
  token: string;
  hosts: ApiHosts;
  hostsChanged: boolean;
}

export function newSession(env: TvEnvironment, token: string, hosts?: ApiHosts | null): TvSession {
  return { env, token, hosts: { ...(hosts ?? {}) }, hostsChanged: false };
}

/** Base REST d'un environnement : l'hôte dédié s'il est connu, sinon le
 *  partagé. */
export function restBase(env: TvEnvironment, hosts?: ApiHosts | null): string {
  const host = hosts?.[env];
  return `https://${host && isTrustedTradovateHost(host) ? host : DEFAULT_HOSTS[env]}/v1`;
}

/**
 * Une réponse du serveur de jetons qui ne dit RIEN du jeton : panne (5xx),
 * limitation (429, 408) ou corps illisible derrière un proxy. Lue comme un
 * refus, elle mettait une connexion valide « à reconnecter » pour de bon.
 */
function transientTokenFailure(res: Response, body: unknown): TvTokenResult | null {
  const unreadable =
    body === null ||
    (typeof body === "object" &&
      body !== null &&
      Object.keys(body).length === 1 &&
      "errorText" in body);
  if (res.status >= 500 || res.status === 429 || res.status === 408 || (res.ok && unreadable)) {
    return { ok: false, reason: "transient", message: `HTTP ${res.status}` };
  }
  return null;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { errorText: text.slice(0, 200) };
  }
}

/**
 * `fetch` qui suit les redirections à la main : seulement vers un hôte de
 * confiance en HTTPS, en conservant l'en-tête `Authorization` (que le suivi
 * automatique retirerait). `onHost` reçoit chaque nouvel hôte.
 */
async function fetchFollowing(
  url: string,
  init: RequestInit,
  onHost?: (host: string) => void,
): Promise<Response> {
  let current = url;
  let req = init;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      ...req,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || res.status === 304 || !location) return res;
    const next = new URL(location, current);
    if (next.protocol !== "https:" || !isTrustedTradovateHost(next.hostname)) {
      throw new TradovateError(`redirect to untrusted host ${next.hostname}`, res.status);
    }
    onHost?.(next.hostname);
    // 307/308 rejouent la méthode et le corps ; 301/302/303 passent en GET.
    if (res.status !== 307 && res.status !== 308 && req.method && req.method !== "GET") {
      req = { ...req, method: "GET", body: undefined };
    }
    current = next.toString();
  }
  throw new TradovateError("too many redirects", 310);
}

function authHeaders(token: string): HeadersInit {
  return { authorization: `Bearer ${token}`, accept: "application/json" };
}

/** Renouvelle un jeton encore valide (`GET`, aucun identifiant). */
export async function renewAccessToken(session: TvSession): Promise<TvTokenResult> {
  const res = await fetchFollowing(
    `${restBase(session.env, session.hosts)}/auth/renewaccesstoken`,
    { method: "GET", headers: authHeaders(session.token) },
    (host) => rememberHost(session, host),
  );
  if (res.status === 401) return { ok: false, reason: "invalid", message: "token expired" };
  const body = await readJson(res);
  return transientTokenFailure(res, body) ?? parseTokenResponse(body);
}

/** Les identifiants de l'APPLICATION, jamais ceux du trader. */
function clientForm(extra: Record<string, string>): string {
  return new URLSearchParams({
    ...extra,
    client_id: process.env.TRADOVATE_CLIENT_ID ?? "",
    client_secret: process.env.TRADOVATE_CLIENT_SECRET ?? "",
  }).toString();
}

async function postToken(kind: string, form: string): Promise<TvTokenResult> {
  const res = await fetchFollowing(oauthTokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form,
  });
  const body = await readJson(res);
  const result = transientTokenFailure(res, body) ?? parseTokenResponse(body);
  if (!result.ok) {
    // Diagnostic côté serveur (journal Vercel) : statut et code d'erreur
    // OAuth, jamais le code à usage unique, le jeton ou le secret.
    const b = (body ?? {}) as Record<string, unknown>;
    console.error(`[tradovate] ${kind} failed`, {
      status: res.status,
      error: typeof b.error === "string" ? b.error : undefined,
      description:
        typeof b.error_description === "string" ? b.error_description.slice(0, 200) : undefined,
    });
  }
  return result;
}

/** Échange du code OAuth contre des jetons (corps en formulaire, comme dans
 *  l'exemple officiel de Tradovate). */
export function exchangeOAuthCode(code: string, redirectUri: string): Promise<TvTokenResult> {
  return postToken(
    "oauth exchange",
    clientForm({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

/** Nouveau jeton d'accès à partir du `refresh_token` : la connexion survit
 *  à une journée sans app ouverte. */
export function refreshAccessToken(refreshToken: string): Promise<TvTokenResult> {
  return postToken(
    "oauth refresh",
    clientForm({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}

/** Retient l'hôte révélé par une redirection pour l'environnement courant. */
function rememberHost(session: TvSession, host: string): void {
  if (session.hosts[session.env] === host) return;
  session.hosts = mergeApiHosts(session.hosts, { [session.env]: host });
  session.hostsChanged = true;
}

/** Lecture d'une entité (`/fill/list`…). Hors liste blanche : refusé. */
export async function tvGet<T>(session: TvSession, path: string): Promise<T> {
  assertReadOnly(path);
  const res = await fetchFollowing(
    `${restBase(session.env, session.hosts)}${path}`,
    { method: "GET", headers: authHeaders(session.token) },
    (host) => rememberHost(session, host),
  );
  if (!res.ok) throw new TradovateError(`${path} → HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** `/<entité>/items?ids=…`, par paquets : l'URL d'une liste d'identifiants a
 *  une longueur finie. */
export async function tvItems<T>(
  session: TvSession,
  entity: string,
  ids: readonly (number | string)[],
  chunk = 50,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk).join(",");
    out.push(...(await tvGet<T[]>(session, `/${entity}/items?ids=${part}`)));
  }
  return out;
}
