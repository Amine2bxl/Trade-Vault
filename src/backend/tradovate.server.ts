/**
 * Client HTTP Tradovate — serveur uniquement, LECTURE SEULE.
 *
 * ── AUCUN MOT DE PASSE ──────────────────────────────────────────────────────
 * Le trader se connecte CHEZ Tradovate, sur leur page (OAuth « Se connecter
 * avec Tradovate »). Son identifiant, son mot de passe et son e-mail restent
 * dans la base de Tradovate : TradeVault ne les voit jamais, ne les reçoit
 * jamais, ne les stocke jamais. Il ne reçoit qu'un JETON d'accès, que le
 * serveur chiffre avant de l'écrire (`broker-crypto.server.ts`). Exige que
 * TradeVault soit déclaré partenaire OAuth chez Tradovate :
 * `TRADOVATE_CLIENT_ID` / `TRADOVATE_CLIENT_SECRET`.
 *
 * ── LECTURE SEULE, PAR CONSTRUCTION ─────────────────────────────────────────
 * Deux garde-fous indépendants :
 *   1. côté Tradovate, l'application partenaire est déclarée en permissions
 *      « Read Only » (comptes, ordres, positions, bibliothèque de contrats) —
 *      réglage du propriétaire, voir `docs/BACKEND.md` §9 ;
 *   2. ICI, aucun appel ne part hors de `READ_ONLY_ENDPOINTS` : uniquement des
 *      `GET` sur des listes et des fiches. Passer un ordre, annuler, modifier
 *      un compte ou lire le profil privé de l'utilisateur (`/auth/me`,
 *      `/user/*`) est impossible depuis ce module, même par erreur de
 *      programmation : `tvGet` refuse le chemin avant tout réseau.
 *
 * Un jeton vit environ 90 minutes et se renouvelle par
 * `GET /auth/renewaccesstoken` tant qu'il est valide. Expiré, la connexion
 * passe en « à reconnecter » : un clic, et le trader repasse chez Tradovate.
 */

import { parseAuthResponse, type TvAuthResult } from "@/modules/brokers/tradovate";

export type TvEnvironment = "live" | "demo";

const HOSTS: Record<TvEnvironment, string> = {
  live: "https://live.tradovateapi.com/v1",
  demo: "https://demo.tradovateapi.com/v1",
};

/** Page de connexion OAuth de Tradovate (celle de leur exemple officiel). */
export const TRADOVATE_AUTHORIZE_URL = "https://trader.tradovate.com/oauth";

/** Échange du code OAuth. Surchargé par l'environnement si Tradovate change
 *  d'hôte (leur documentation en cite plusieurs). */
function oauthTokenUrl(): string {
  return process.env.TRADOVATE_OAUTH_TOKEN_URL || "https://live.tradovateapi.com/auth/oauthtoken";
}

/**
 * LES SEULS CHEMINS QUE TRADEVAULT APPELLE CHEZ TRADOVATE.
 *
 * Des LECTURES de données de trading — comptes, exécutions, ordres et leurs
 * versions (pour retrouver le stop initial), positions, frais, fiches de
 * contrat — et le renouvellement du jeton. Rien d'autre : ni écriture, ni
 * profil utilisateur. Ajouter une entrée ici doit rester une lecture.
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

export function tradovateOAuthConfigured(): boolean {
  return !!process.env.TRADOVATE_CLIENT_ID && !!process.env.TRADOVATE_CLIENT_SECRET;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { errorText: text.slice(0, 200) };
  }
}

/** Renouvelle un jeton encore valide (lecture : `GET`, aucun identifiant). */
export async function renewAccessToken(env: TvEnvironment, token: string): Promise<TvAuthResult> {
  const res = await fetch(`${HOSTS[env]}/auth/renewaccesstoken`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) return { ok: false, reason: "invalid", message: "token expired" };
  return parseAuthResponse(await readJson(res));
}

/** Échange du code OAuth contre un jeton (corps en formulaire, comme dans
 *  l'exemple officiel de Tradovate). Le seul `POST` du module : il ne porte
 *  que le code à usage unique et les identifiants de l'APPLICATION. */
export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<TvAuthResult> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.TRADOVATE_CLIENT_ID ?? "",
    client_secret: process.env.TRADOVATE_CLIENT_SECRET ?? "",
  });
  const res = await fetch(oauthTokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await readJson(res)) as Record<string, unknown> | null;
  if (body && typeof body.access_token === "string") {
    const ttl = Number(body.expires_in) || 80 * 60;
    return {
      ok: true,
      accessToken: body.access_token,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      userId: null,
    };
  }
  return {
    ok: false,
    reason: "invalid",
    message:
      (body && typeof body.error_description === "string" && body.error_description) ||
      (body && typeof body.error === "string" && body.error) ||
      "oauth exchange failed",
  };
}

/** Lecture d'une entité (`/fill/list`…). Hors liste blanche : refusé. */
export async function tvGet<T>(env: TvEnvironment, token: string, path: string): Promise<T> {
  assertReadOnly(path);
  const res = await fetch(`${HOSTS[env]}${path}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new TradovateError(`${path} → HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** `/<entité>/items?ids=…`, par paquets : l'URL d'une liste d'identifiants a
 *  une longueur finie. */
export async function tvItems<T>(
  env: TvEnvironment,
  token: string,
  entity: string,
  ids: readonly (number | string)[],
  chunk = 50,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk).join(",");
    out.push(...(await tvGet<T[]>(env, token, `/${entity}/items?ids=${part}`)));
  }
  return out;
}
