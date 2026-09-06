import "./shared/error-capture";

import { consumeLastCapturedError } from "./shared/error-capture";
import { renderErrorPage } from "./shared/error-page";
import { SITE_URL } from "./shared/site";
import { checkRateLimit } from "./backend/rate-limit.server";
import { logger } from "./shared/logger";

/**
 * Public routes worth indexing. The authenticated app is behind `/` and is
 * client-rendered, so there is nothing else for a crawler to see.
 *
 * `changefreq` dit à quel rythme la page bouge RÉELLEMENT. Les pages légales
 * ne changent qu'à une révision de contrat ; la vitrine suit le produit.
 * L'annoncer honnêtement vaut mieux que de tout déclarer `daily` : un sitemap
 * qui exagère est un sitemap que le moteur cesse de lire.
 */
const PUBLIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/fr", priority: "1.0", changefreq: "weekly" },
  { path: "/privacy", priority: "0.5", changefreq: "yearly" },
  { path: "/terms", priority: "0.5", changefreq: "yearly" },
  { path: "/cgu", priority: "0.5", changefreq: "yearly" },
  { path: "/contact", priority: "0.5", changefreq: "monthly" },
] as const;

/**
 * `lastmod` — L'HORODATAGE DU BUILD, PAS CELUI DE LA REQUÊTE.
 *
 * Il valait `new Date()`, évalué à chaque appel : le sitemap déclarait donc
 * CHAQUE URL modifiée aujourd'hui, TOUS LES JOURS — y compris des CGU
 * inchangées depuis des mois. Google mesure cet écart, en conclut que le
 * `lastmod` du site n'est pas fiable, et cesse alors de le lire pour toutes
 * les URL, y compris celles qui changent vraiment.
 *
 * Le déploiement est le seul moment où le contenu de ces pages peut changer :
 * c'est donc la bonne date. Figée à l'évaluation du module — une fois par
 * démarrage de la fonction, pas une fois par requête.
 *
 * UTC est ICI le bon choix, contrairement au reste du produit : le `lastmod`
 * d'un sitemap n'appartient à personne en particulier, et le serveur n'a aucun
 * fuseau « local » qui voudrait dire quelque chose. (`tests/calendarDate.test.ts`
 * s'accroche à cette phrase — elle marque une exception délibérée à la règle
 * « aucune date métier ne repasse par UTC », pour qu'on ne la « corrige » pas
 * par symétrie.)
 */
const BUILD_DATE = new Date().toISOString().slice(0, 10);

/**
 * `robots.txt` et `sitemap.xml`, GÉNÉRÉS plutôt que livrés en fichiers
 * statiques : ils suivent ainsi `SITE_URL`, et brancher un domaine
 * personnalisé ne demande aucune modification.
 *
 * Les déploiements de préversion répondent sur un autre hôte et reçoivent
 * délibérément un `Disallow: /` intégral : une préversion ne doit jamais
 * concurrencer la production dans l'index, ni y laisser fuir une page
 * inachevée.
 *
 * ── CE CODE ÉTAIT MORT ──────────────────────────────────────────────────────
 *
 * `public/robots.txt` et `public/sitemap.xml` existaient AUSSI en fichiers
 * statiques. Sur Vercel, le CDN sert `public/` avant d'atteindre la fonction :
 * ces deux gestionnaires n'étaient donc jamais appelés, et la protection des
 * préversions ne s'est jamais appliquée — chaque déploiement de préversion
 * était indexable avec `Allow: /`. Le sitemap statique, tenu à la main, avait
 * en plus divergé de `PUBLIC_ROUTES` (il ignorait `/contact`).
 *
 * Les deux fichiers statiques ont été supprimés. Ce qui suit est désormais ce
 * qui répond réellement.
 */
function isCanonicalHost(request: Request): boolean {
  try {
    return new URL(request.url).host === new URL(SITE_URL).host;
  } catch {
    return false;
  }
}

function robotsTxt(request: Request): Response {
  // `Disallow: /api/` : ces chemins ne rendent jamais de HTML (webhooks, crons,
  // facturation). Les faire explorer ne peut rien indexer et gaspille le budget
  // de crawl — quand ça ne déclenche pas un 405 ou une limitation de débit.
  //
  // Le reste du site reste EXPLORABLE, y compris les écrans authentifiés. C'est
  // délibéré et c'est le point que la plupart des configurations ratent : un
  // `Disallow` empêche le robot de LIRE le `noindex` de la page, donc l'URL
  // peut rester dans l'index, sans titre ni description. Explorable + `noindex`
  // est la seule combinaison qui désindexe vraiment.
  //
  // `llms.txt` est annoncé ici parce que c'est le seul endroit conventionnel où
  // un agent va chercher les métadonnées d'un site.
  const body = isCanonicalHost(request)
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n\n# Machine-readable summary for AI assistants\n# ${SITE_URL}/llms.txt\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

/** Les deux adresses de la vitrine. Doit rester aligné sur
 *  `LANDING_ALTERNATES` (`shared/seo.ts`) — la grappe `hreflang` du `<head>` et
 *  celle du sitemap doivent décrire la MÊME paire, sinon Google en ignore une. */
const LANDING_PATHS: Record<string, string> = { "/": `${SITE_URL}/`, "/fr": `${SITE_URL}/fr` };

function sitemapXml(): Response {
  const urls = PUBLIC_ROUTES.map(({ path, priority, changefreq }) => {
    const loc = path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
    // Les alternatives de langue sont déclarées DANS le sitemap en plus du
    // `<head>`. Ce n'est pas une redondance : Google accepte les deux canaux,
    // et un sitemap est lu même quand le rendu de la page échoue.
    const alt =
      path in LANDING_PATHS
        ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${LANDING_PATHS["/"]}"/>` +
          `\n    <xhtml:link rel="alternate" hreflang="fr" href="${LANDING_PATHS["/fr"]}"/>` +
          `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${LANDING_PATHS["/"]}"/>`
        : "";
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${alt}\n  </url>`;
  }).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const { pathname } = new URL(request.url);

      // Health check — no auth, no rate limit.
      if (pathname === "/api/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "content-type": "application/json" },
        });
      }

      // Rate limit on API endpoints (not crons, not static files).
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/cron/")) {
        const { allowed, retryAfter } = checkRateLimit(request);
        if (!allowed) {
          return new Response("Too many requests", {
            status: 429,
            headers: {
              "retry-after": String(retryAfter ?? 60),
              "content-type": "text/plain; charset=utf-8",
            },
          });
        }
      }

      // Raw HTTP endpoints (no file-route support in this router version).
      // The Vercel cron hits this path on the 1st of each month.
      if (pathname === "/robots.txt") return robotsTxt(request);
      if (pathname === "/sitemap.xml") return sitemapXml();
      if (pathname === "/api/cron/monthly-reports" && request.method === "POST") {
        const { handleMonthlyReportsCron } = await import("./backend/monthly-reports.server");
        return await handleMonthlyReportsCron(request);
      }
      if (pathname === "/api/cron/lifecycle-emails" && request.method === "POST") {
        const { handleLifecycleCron } = await import("./backend/lifecycle-emails.server");
        // Same daily tick also drives the weekly goal-plan push reminders
        // (Mondays only — the handler itself gates the day). Best-effort:
        // a reminder failure must never block the email run.
        const response = await handleLifecycleCron(request);
        if (response.ok) {
          try {
            const { handleGoalRemindersCron } = await import("./backend/goal-reminders.server");
            await handleGoalRemindersCron(request);
          } catch (e) {
            console.error("[goal-reminders] cron failed", e);
          }
          // Rétention de la télémétrie IA (90 jours). Greffée sur ce même tick
          // quotidien plutôt que sur un cron dédié : `ai_agent_runs` croissait
          // linéairement sans jamais rien supprimer. Best-effort — une purge
          // ratée ne doit jamais faire échouer l'envoi des emails.
          try {
            const { purgeOldAgentRuns } = await import("./backend/telemetry.server");
            await purgeOldAgentRuns();
          } catch (e) {
            console.error("[telemetry] purge cron failed", e);
          }
          // Propositions échues. Greffé sur le même tick quotidien : une
          // proposition de plus de quatorze jours s'appuie sur des données que
          // le trader a dépassées, et tant qu'elle reste `pending` elle occupe
          // une place du budget d'intervention sans rien proposer.
          // Best-effort, comme les deux au-dessus.
          try {
            const { serviceClient } = await import("./backend/billing.server");
            const { expireStaleProposals } = await import("./backend/proposals.functions");
            const sb = serviceClient();
            if (sb) {
              const expired = await expireStaleProposals(sb);
              if (expired > 0) console.log("[proposals] expired", expired);
            }
          } catch (e) {
            console.error("[proposals] expiry sweep failed", e);
          }
        }
        return response;
      }
      if (pathname === "/api/cron/pattern-scan" && request.method === "POST") {
        const { handlePatternScanCron } = await import("./backend/pattern-scan.server");
        return await handlePatternScanCron(request);
      }
      if (pathname === "/api/cron/economic-calendar" && request.method === "POST") {
        const { handleEconomicCalendarCron } = await import("./backend/economic-calendar.server");
        return await handleEconomicCalendarCron(request);
      }
      if (pathname.startsWith("/api/cron/") && !pathname.startsWith("/api/cron/__")) {
        return new Response("Method not allowed", {
          status: 405,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      if (pathname === "/api/emails/welcome" && request.method === "POST") {
        const { handleWelcomeEmail } = await import("./backend/lifecycle-emails.server");
        return await handleWelcomeEmail(request);
      }
      if (pathname === "/api/billing/checkout" && request.method === "POST") {
        const { handleCheckout } = await import("./backend/billing.server");
        return await handleCheckout(request);
      }
      if (pathname === "/api/billing/portal" && request.method === "POST") {
        const { handlePortal } = await import("./backend/billing.server");
        return await handlePortal(request);
      }
      if (pathname === "/api/stripe/webhook" && request.method === "POST") {
        const { handleStripeWebhook } = await import("./backend/billing.server");
        return await handleStripeWebhook(request);
      }
      if (pathname === "/api/crypto/checkout" && request.method === "POST") {
        const { handleCryptoCheckout } = await import("./backend/crypto-pay.server");
        return await handleCryptoCheckout(request);
      }
      // Accès offert — réservé aux adresses listées dans `ADMIN_EMAILS`.
      if (pathname === "/api/admin/me" && request.method === "GET") {
        const { handleAdminMe } = await import("./backend/admin.server");
        return await handleAdminMe(request);
      }
      if (pathname === "/api/admin/grants" && request.method === "GET") {
        const { handleListGrants } = await import("./backend/admin.server");
        return await handleListGrants(request);
      }
      if (pathname === "/api/admin/grants" && request.method === "POST") {
        const { handleGrant } = await import("./backend/admin.server");
        return await handleGrant(request);
      }
      if (pathname === "/api/admin/grants/revoke" && request.method === "POST") {
        const { handleRevokeGrant } = await import("./backend/admin.server");
        return await handleRevokeGrant(request);
      }
      // Codes promo gérés par l'app — réservés aux adresses `ADMIN_EMAILS`.
      if (pathname === "/api/admin/promos" && request.method === "GET") {
        const { handleListPromos } = await import("./backend/promo.server");
        return await handleListPromos(request);
      }
      if (pathname === "/api/admin/promos" && request.method === "POST") {
        const { handleCreatePromo } = await import("./backend/promo.server");
        return await handleCreatePromo(request);
      }
      if (pathname === "/api/admin/promos/set-active" && request.method === "POST") {
        const { handleSetPromoActive } = await import("./backend/promo.server");
        return await handleSetPromoActive(request);
      }
      if (pathname === "/api/admin/promos/delete" && request.method === "POST") {
        const { handleDeletePromo } = await import("./backend/promo.server");
        return await handleDeletePromo(request);
      }
      if (pathname === "/api/admin/promos/redemptions" && request.method === "GET") {
        const { handleListPromoRedemptions } = await import("./backend/promo.server");
        return await handleListPromoRedemptions(request);
      }
      if (pathname === "/api/admin/promos/revoke" && request.method === "POST") {
        const { handleRevokePromoRedemption } = await import("./backend/promo.server");
        return await handleRevokePromoRedemption(request);
      }
      if (pathname === "/api/crypto/webhook" && request.method === "POST") {
        const { handleCryptoWebhook } = await import("./backend/crypto-pay.server");
        return await handleCryptoWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
