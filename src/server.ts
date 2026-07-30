import "./shared/error-capture";

import { consumeLastCapturedError } from "./shared/error-capture";
import { renderErrorPage } from "./shared/error-page";
import { SITE_URL } from "./shared/site";
import { checkRateLimit } from "./backend/rate-limit.server";

/** Public routes worth indexing. The authenticated app is behind `/` and is
 *  client-rendered, so there is nothing else for a crawler to see. */
const PUBLIC_ROUTES = ["/", "/privacy", "/terms", "/contact"] as const;

/**
 * `robots.txt` and `sitemap.xml`, generated rather than shipped as static
 * files so they follow `SITE_URL` — connecting a custom domain needs no edit.
 *
 * Preview deployments answer on a different host and are deliberately served a
 * blanket `Disallow: /`: a preview must never compete with production in the
 * index, nor leak an unfinished page into search results.
 */
function isCanonicalHost(request: Request): boolean {
  try {
    return new URL(request.url).host === new URL(SITE_URL).host;
  } catch {
    return false;
  }
}

function robotsTxt(request: Request): Response {
  const body = isCanonicalHost(request)
    ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function sitemapXml(): Response {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_ROUTES.map((path) => {
    const loc = path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
    const priority = path === "/" ? "1.0" : "0.5";
    return `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><priority>${priority}</priority></url>`;
  }).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
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
      if (pathname === "/api/cron/monthly-reports") {
        const { handleMonthlyReportsCron } = await import("./backend/monthly-reports.server");
        return await handleMonthlyReportsCron(request);
      }
      if (pathname === "/api/cron/lifecycle-emails") {
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
        }
        return response;
      }
      if (pathname === "/api/cron/economic-calendar") {
        const { handleEconomicCalendarCron } = await import("./backend/economic-calendar.server");
        return await handleEconomicCalendarCron(request);
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
