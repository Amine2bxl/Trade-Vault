/**
 * L'adresse de retour OAuth — d'où Tradovate renvoie le trader après sa
 * connexion chez eux.
 *
 * Tradovate exige la MÊME adresse, au caractère près, à trois endroits :
 * l'enregistrement de l'application, la redirection vers sa page de
 * connexion, et l'échange du code. Elle était toujours construite sur le
 * domaine de production : depuis une préversion Vercel ou en local, le
 * trader revenait sur un autre site, sans sa session, et la connexion
 * échouait. Elle suit donc l'ORIGINE de l'appel, quand cette origine est
 * l'une des nôtres, et elle est mémorisée avec la tentative pour que
 * l'échange renvoie exactement celle qui a été envoyée.
 *
 * Une origine inconnue retombe sur le domaine canonique : l'en-tête `Origin`
 * vient du navigateur, il ne choisit jamais une adresse arbitraire.
 */

import { SITE_URL } from "@/shared/site";

/** Chemin de la page qui termine la connexion. */
export const OAUTH_CALLBACK_PATH = "/brokers";

function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Les hôtes dont on accepte qu'ils reçoivent le retour OAuth. */
export function allowedRedirectHosts(): Set<string> {
  const hosts = new Set<string>();
  const add = (v: string | undefined | null) => {
    const h = hostOf(v);
    if (h) hosts.add(h);
  };
  add(SITE_URL);
  add(process.env.PUBLIC_SITE_URL);
  // Variables système de Vercel : l'URL de CE déploiement, de sa branche, et
  // du domaine de production — jamais un hôte tiers.
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  for (const o of (process.env.TRADOVATE_REDIRECT_ORIGINS ?? "").split(",")) add(o.trim());
  for (const h of [...hosts]) if (!h.startsWith("www.")) hosts.add(`www.${h}`);
  return hosts;
}

const LOCAL = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * L'adresse de retour pour une requête venue de `origin`.
 *
 * `TRADOVATE_REDIRECT_URI` l'emporte toujours (une seule adresse déclarée
 * chez Tradovate). Sinon : l'origine de l'appel si elle est connue (domaine,
 * préversion Vercel, poste local), le domaine canonique dans tous les autres
 * cas.
 */
export function oauthRedirectUri(origin: string | null | undefined): string {
  const override = process.env.TRADOVATE_REDIRECT_URI;
  if (override) return override;
  if (origin) {
    try {
      const u = new URL(origin);
      const host = u.host.toLowerCase();
      const ok =
        (u.protocol === "https:" && allowedRedirectHosts().has(host)) ||
        ((u.protocol === "http:" || u.protocol === "https:") && LOCAL.test(host));
      if (ok) return `${u.protocol}//${host}${OAUTH_CALLBACK_PATH}`;
    } catch {
      // Origine illisible : domaine canonique.
    }
  }
  return `${(process.env.PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, "")}${OAUTH_CALLBACK_PATH}`;
}

/** L'origine d'une requête : l'en-tête `Origin` (toujours envoyé par un
 *  `POST` du navigateur), sinon l'origine de l'URL appelée. */
export function requestOrigin(req: Request | null | undefined): string | null {
  if (!req) return null;
  const header = req.headers.get("origin");
  if (header && header !== "null") return header;
  try {
    return new URL(req.url).origin;
  } catch {
    return null;
  }
}

/** Les variables à poser pour ouvrir la connexion — NOMS seulement, jamais
 *  de valeur. Montré à l'administrateur, à personne d'autre. */
export function missingBrokerEnv(): string[] {
  const out: string[] = [];
  if (!process.env.TRADOVATE_CLIENT_ID) out.push("TRADOVATE_CLIENT_ID");
  if (!process.env.TRADOVATE_CLIENT_SECRET) out.push("TRADOVATE_CLIENT_SECRET");
  if (!process.env.CRON_SECRET) out.push("CRON_SECRET");
  return out;
}

/** Erreur PostgREST « table ou colonne absente » : la migration n'est pas
 *  appliquée sur cette base. */
export function isSchemaMissing(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  return (
    err.code === "PGRST205" ||
    err.code === "PGRST204" ||
    err.code === "42P01" ||
    err.code === "42703" ||
    /schema cache|(relation|column) .+ does not exist/i.test(err.message ?? "")
  );
}
