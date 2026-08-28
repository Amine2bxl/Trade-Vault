import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, structuredData } from "../shared/seo";
import { initAnalytics } from "@/app/utils/analytics";
import { reportAppError, installGlobalErrorReporting } from "../shared/error-reporting";

/** Site-wide title and description — the marketing promise, in the language
 *  the landing page is written in. Public routes override both. */
const ROOT_TITLE = "TradeVault — Ton coach IA de trading personnel";
const ROOT_DESCRIPTION =
  "Pas un simple journal de trading : un coach IA qui lit chacun de tes trades, chiffre les erreurs qui te coûtent le plus et t'impose la discipline. Journal, analytics quantitatives et checklist pré-market.";

/** Google Fonts — chargées en non-bloquant (preload → stylesheet après paint).
 *  IBM Plex Sans porte TOUTE l'identité (body, UI, titres) : un seule famille,
 *  conçue pour les interfaces denses où 0/O, 1/l/I et 5/8 ne doivent jamais se
 *  confondre — le caractère exact d'un terminal de trading. IBM Plex Mono ne
 *  sert qu'aux rares données techniques (codes, heures). */
const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";

import { lockZoom } from "../shared/lock-zoom";
import ErrorScreen from "../app/components/ErrorScreen";

function NotFoundComponent() {
  return (
    <ErrorScreen
      code="404"
      title="This page slipped the market"
      subtitle="The page you're looking for doesn't exist or has been moved. Let's get you back on the chart."
    />
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title="Something broke on our end"
      subtitle="A gear slipped while loading this page. Your data is safe — try again, or head back to your dashboard."
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#060810" },
      {
        name: "trustpilot-one-time-domain-verification-id",
        content: "3a2800eb-0ad2-4c9a-bda2-1d3833f70ef0",
      },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TradeVault" },
      // Exact product name for OS/browser surfaces — must match the OAuth
      // consent screen name character for character.
      { name: "application-name", content: SITE_NAME },
      // Site-wide defaults. Public routes override them via `pageSeo()`;
      // the authenticated app inherits these. Absolute URLs are mandatory —
      // Open Graph scrapers have no base to resolve a relative path against.
      { title: ROOT_TITLE },
      { name: "description", content: ROOT_DESCRIPTION },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: ROOT_TITLE },
      { property: "og:description", content: ROOT_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: ROOT_TITLE },
      { name: "twitter:description", content: ROOT_DESCRIPTION },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
    // No canonical here: TanStack merges `meta` by name/property (child wins)
    // but APPENDS `links`, so a root-level canonical would stack a second,
    // conflicting canonical onto every child route. Each indexable route
    // declares its own canonical via `pageSeo()` instead.
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Polices Google chargées en NON-BLOQUANT : préchargées (fetch parallèle)
      // puis basculées en stylesheet après hydratation (voir le swap ci-dessous).
      // Élimine le render-blocking sans changer le rendu final (font-display: swap).
      {
        rel: "preload",
        as: "style",
        href: GOOGLE_FONTS_URL,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Theme is applied at runtime by ThemeProvider (post-hydration). The default
    // "Jarvis" palette lives in the CSS :root, so the first paint is already
    // themed for default-theme users with no flash and no hydration divergence.
    //
    // lang="fr" for now: the public site is written in French and og:locale
    // says fr_FR. When i18n lands for SSR this should read the user's
    // preference from cookie/session.
    <html lang="fr">
      <head>
        <HeadContent />
        {/* schema.org identity for the brand + application. Rendered here rather
            than through head() so the JSON body is emitted verbatim. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData() }} />
        {/* Bascule des polices AU PLUS TÔT.
         *
         * Le lien Google Fonts est un `preload as=style` : il se télécharge sans
         * bloquer le rendu, mais il ne s'applique que le jour où quelqu'un le
         * transforme en feuille de style. C'était fait dans un `useEffect`,
         * donc APRÈS l'hydratation — plusieurs centaines de millisecondes de
         * page entièrement composée dans la pile de repli (Arial/Helvetica),
         * puis un basculement vers IBM Plex qui remesure chaque titre et
         * chaque ligne de texte : un reflow de la page complète, à chaque
         * premier chargement. C'est la source de décalage la plus visible du
         * produit, et elle n'a rien à voir avec React.
         *
         * Ce script s'exécute à l'analyse du document et bascule le lien dès
         * que le CSS arrive, typiquement bien avant l'hydratation. L'effet
         * React reste en place comme filet : la bascule est idempotente. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var l=document.querySelector(\'link[rel="preload"][as="style"][href*="fonts.googleapis.com"]\');' +
              'if(!l)return;var s=function(){l.rel="stylesheet"};' +
              'if(l.sheet){s();return}l.addEventListener("load",s,{once:true})})()',
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => lockZoom(), []);

  // GA4 — injecté uniquement si VITE_GA4_MEASUREMENT_ID est défini (sinon no-op).
  useEffect(() => {
    initAnalytics();
  }, []);

  // Polices : bascule le <link rel="preload" as="style"> en stylesheet après le
  // premier rendu — élimine le render-blocking sans changer le rendu final.
  useEffect(() => {
    const preload = document.querySelector<HTMLLinkElement>(
      'link[rel="preload"][as="style"][href*="fonts.googleapis.com"]',
    );
    if (preload) preload.rel = "stylesheet";
  }, []);

  // Erreurs non capturées du navigateur → même entonnoir que les boundaries.
  // Sans cela, une panne survenue hors du rendu React (gestionnaire
  // d'événement, setTimeout, promesse non attendue) disparaissait sans laisser
  // la moindre trace.
  useEffect(() => {
    installGlobalErrorReporting();
  }, []);

  // Stale lazy-chunk guard. Pages are code-split; after a new deploy the old
  // build's chunk hashes 404, so anyone who had the app open across a release
  // gets "Failed to fetch dynamically imported module" when they open a page —
  // which surfaces as the 500 error screen. Vite dispatches `vite:preloadError`
  // for exactly this; we swallow it and reload once (rate-limited so a genuinely
  // missing chunk can't loop) to pull the fresh manifest instead of crashing.
  useEffect(() => {
    const onPreloadError = (e: Event) => {
      e.preventDefault();
      const KEY = "tv-chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      } else {
        // Reloading didn't fix it — let the error boundary show, don't loop.
        reportAppError(e, { boundary: "vite_preload_error_persistent" });
      }
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw-push.js", { scope: "/" }).catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
