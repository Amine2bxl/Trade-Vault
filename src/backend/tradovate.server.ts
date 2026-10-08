/**
 * Client HTTP Tradovate — serveur uniquement.
 *
 * Deux façons d'obtenir un jeton d'accès, selon ce que le trader possède :
 *
 *   1. OAuth (« Se connecter avec Tradovate ») — le parcours des journaux
 *      partenaires. Le trader se connecte CHEZ Tradovate, nous ne voyons jamais
 *      son mot de passe. Exige que TradeVault soit déclaré partenaire :
 *      `TRADOVATE_CLIENT_ID` / `TRADOVATE_CLIENT_SECRET`.
 *   2. Clé API — `POST /auth/accesstokenrequest` avec le login, le mot de passe
 *      et la paire `cid` / `sec` que le trader génère dans Tradovate
 *      (Application Settings → API Access). Utilisable dès aujourd'hui, sans
 *      accord partenaire.
 *
 * Un jeton vit ~90 minutes et se renouvelle par `GET /auth/renewaccesstoken`
 * tant qu'il est valide. La synchro le renouvelle avant expiration.
 *
 * Les échecs d'authentification sont comptés par Tradovate (quelques essais
 * par heure, puis une pénalité `p-ticket`) : un refus n'est JAMAIS retenté en
 * boucle, il est rapporté au trader.
 */

import { parseAuthResponse, type TvAuthResult } from "@/modules/brokers/tradovate";

export type TvEnvironment = "live" | "demo";

const HOSTS: Record<TvEnvironment, string> = {
  live: "https://live.tradovateapi.com/v1",
  demo: "https://demo.tradovateapi.com/v1",
};

/** Page d'autorisation OAuth de Tradovate (celle de leur exemple officiel). */
export const TRADOVATE_AUTHORIZE_URL = "https://trader.tradovate.com/oauth";

/** Échange du code OAuth. Surchargé par l'environnement si Tradovate change
 *  d'hôte (leur documentation en cite plusieurs). */
function oauthTokenUrl(): string {
  return process.env.TRADOVATE_OAUTH_TOKEN_URL || "https://live.tradovateapi.com/auth/oauthtoken";
}

/** Délai maximal d'un appel : une API lente ne doit pas consommer tout le
 *  budget d'une server function. */
const TIMEOUT_MS = 15_000;

export class TradovateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface TvCredentials {
  username: string;
  password: string;
  cid: string;
  sec: string;
  deviceId: string;
}

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

export async function requestAccessToken(
  env: TvEnvironment,
  creds: TvCredentials,
): Promise<TvAuthResult> {
  const res = await fetch(`${HOSTS[env]}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      name: creds.username,
      password: creds.password,
      appId: process.env.TRADOVATE_APP_ID || "TradeVault",
      appVersion: process.env.TRADOVATE_APP_VERSION || "1.0",
      // `cid` est numérique chez Tradovate ; une valeur non numérique est
      // transmise telle quelle et refusée par eux, avec leur message.
      cid: /^\d+$/.test(creds.cid) ? Number(creds.cid) : creds.cid,
      sec: creds.sec,
      deviceId: creds.deviceId,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return parseAuthResponse(await readJson(res));
}

export async function renewAccessToken(env: TvEnvironment, token: string): Promise<TvAuthResult> {
  const res = await fetch(`${HOSTS[env]}/auth/renewaccesstoken`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) return { ok: false, reason: "invalid", message: "token expired" };
  return parseAuthResponse(await readJson(res));
}

/** Échange du code OAuth contre un jeton (corps en formulaire, comme dans
 *  l'exemple officiel de Tradovate). */
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

/** Lecture d'une entité. `path` sans le préfixe de version (`/fill/list`). */
export async function tvGet<T>(env: TvEnvironment, token: string, path: string): Promise<T> {
  const res = await fetch(`${HOSTS[env]}${path}`, {
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
