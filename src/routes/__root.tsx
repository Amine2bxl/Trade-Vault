import { lazyPage, reloadForStaleChunk } from "@/shared/lazy-page";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ClientOnly,
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Suspense, useEffect, type ReactNode } from "react";

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
 *  Inter porte TOUTE l'identité (body, UI, titres) : la grotesque neutre et
 *  moderne des produits qui font référence (Geist/21st.dev, Linktree, et le
 *  raffinement de Roboto/Google/YouTube) — plus lisible et plus premium que
 *  Roboto lui-même. Roboto Mono sert aux rares données techniques (codes,
 *  heures). */
const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600;700&display=swap";

import { PAGES } from "@/app/types";
import { pageFromPath } from "@/app/utils/pageUrl";

/**
 * L'APPLICATION EST MONTÉE UNE FOIS, ICI — PAS PAR CHAQUE ROUTE.
 *
 * `/` (le tableau de bord) et `/$page` (tout le reste) sont deux routes, et
 * chacune montait SA copie de `App`. L'application change de page par
 * `history.pushState` ; le routeur l'intercepte, passe de l'une à l'autre…
 * et React, voyant deux composants différents, démontait toute l'application
 * pour la remonter : session revérifiée, comptes et abonnement rechargés,
 * moteurs relancés, écran « Vérification du compte… » — à CHAQUE aller-retour
 * vers le tableau de bord. C'était le « mini freeze » à l'arrivée sur une page.
 *
 * La racine, elle, ne se démonte jamais : elle héberge l'instance unique.
 * Les deux routes ne rendent plus que leur contenu SERVEUR (la vitrine, ou le
 * squelette public), affiché pendant l'hydratation et le chargement du code.
 */
const loadApp = () => import("@/app/shell/App");
const App = lazyPage(loadApp);
const isAppPath = (pathname: string) => pageFromPath(pathname) !== null;
// Le code de l'application part dès l'évaluation de ce module, en parallèle de
// l'hydratation — pas après elle.
if (typeof window !== "undefined" && isAppPath(window.location.pathname)) void loadApp();

function AppHost({ pathname }: { pathname: string }) {
  // Sur `/`, le contenu serveur EST la vitrine : l'application la reprend
  // telle quelle au lieu d'en recharger une copie.
  const surVitrine = pathname === "/";
  return (
    <ClientOnly fallback={<Outlet />}>
      <Suspense fallback={<Outlet />}>
        <App publicPage={surVitrine ? <Outlet /> : undefined} publicFallback={<Outlet />} />
      </Suspense>
    </ClientOnly>
  );
}

/**
 * LE VOILE DU TRADER CONNECTÉ — posé avant la première peinture.
 *
 * La session vit dans `localStorage` : le serveur ne peut pas la voir, et il
 * sert donc la vitrine (`/`) ou son squelette public (`/journal`…) à tout le
 * monde. Un trader connecté qui rouvrait TradeVault voyait ainsi la page de
 * vente une fraction de seconde, puis son application la remplaçait.
 *
 * Ce script lit la présence d'une session (sans réseau) et, sur les seules
 * adresses où l'application va monter, masque la vitrine jusqu'à ce que
 * `App` prenne la main — il retire lui-même le voile s'il finit par afficher
 * la vitrine (session expirée). Filet : le voile tombe seul après 10 s, pour
 * qu'une panne de JavaScript ne laisse jamais un écran vide.
 */
const APP_PATHS = JSON.stringify(["/", ...PAGES.map((p) => `/${p}`)]);

/**
 * LE STOCKAGE REFUSÉ NE FAIT PLUS TOMBER L'APPLICATION.
 *
 * Cookies bloqués, navigateur intégré d'Instagram ou de TikTok, politique
 * d'entreprise : `window.localStorage` y LÈVE une `SecurityError` dès qu'on le
 * lit — et `typeof localStorage`, la garde utilisée à une vingtaine
 * d'endroits du code, le lit. Le thème, la langue, le client Supabase
 * levaient pendant le premier rendu : écran 500 au lancement, avant même la
 * vitrine.
 *
 * Ce script s'exécute AVANT tout module : si un stockage est inaccessible, il
 * est remplacé par un stockage en mémoire du même contrat. Rien n'est
 * persisté d'une visite à l'autre — exactement ce que le visiteur a demandé
 * à son navigateur — mais tout fonctionne.
 */
const STORAGE_FALLBACK_SCRIPT =
  "(function(){function mk(){var d={};return{get length(){return Object.keys(d).length}," +
  "key:function(i){var k=Object.keys(d);return i<k.length?k[i]:null}," +
  "getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null}," +
  "setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}}}}" +
  "['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('__tv')}catch(e){" +
  "try{Object.defineProperty(window,n,{value:mk(),configurable:true})}catch(_){}}})})()";
const SESSION_VEIL_SCRIPT =
  "(function(){try{var p=location.pathname.replace(/\\/+$/,'')||'/';" +
  `if(${APP_PATHS}.indexOf(p)<0)return;var s=false;` +
  "if(/[?&#](code|access_token)=/.test(location.search+location.hash))s=true;" +
  "for(var i=0;!s&&i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^sb-.+-auth-token$/.test(k))s=true}" +
  "if(!s)return;var st=document.createElement('style');st.id='tv-session-veil';" +
  "st.textContent='.landing-root,.public-shell{visibility:hidden!important}" +
  'body::after{content:"TradeVault";position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;' +
  "font:700 15px/1 Inter,system-ui,sans-serif;letter-spacing:-.01em;color:rgb(226 232 240/.85)}';" +
  "document.head.appendChild(st);setTimeout(function(){st.remove()},10000)}catch(e){}})()";
import ErrorScreen from "../app/shell/ErrorScreen";
import { SSR_LANG, langForPath } from "@/shared/lang";

function NotFoundComponent() {
  /* LE 404 PORTE LE MÊME COUPLE DE BOUTONS QUE LE 500.
     Il n'en avait qu'un, bordé : l'écran n'offrait donc aucune action
     principale, et son seul objet coloré était l'étiquette du code — qu'on
     prenait pour un bouton rond puisque rien d'autre n'en avait l'air.
     « Actualiser » a un vrai usage ici : une adresse juste qui tombe en 404
     le temps qu'un déploiement se propage est le cas le plus fréquent, et
     recharger la résout. Quand ce n'est pas ça, le bouton bordé à côté
     ramène à l'accueil. */
  return (
    <ErrorScreen
      code="404"
      title="This page slipped the market"
      subtitle="The page you're looking for doesn't exist or has been moved. Let's get you back on the chart."
      onRetry={() => window.location.reload()}
    />
  );
}

// Le type vient du routeur : depuis 1.170, `error` y est `unknown` (une
// promesse rejetée peut porter n'importe quoi), et `reportAppError` l'accepte.
function ErrorComponent({ error, reset }: ErrorComponentProps) {
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
        // Le zoom reste au trader (WCAG 1.4.4). Le zoom AUTOMATIQUE d'iOS sur un
        // champ est déjà évité à la source : champs à 16 px sur téléphone
        // (`styles.css`, « iOS focus-zoom guard »).
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#0a0b0d" },
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
      // Aligné sur `SSR_LANG`, comme celui de `shared/seo.ts` : il y avait DEUX
      // déclarations de `og:locale` en dur, celle-ci pour l'application et
      // l'autre pour les routes publiques. Deux copies d'une même vérité.
      { property: "og:locale", content: SSR_LANG === "fr" ? "fr_FR" : "en_US" },
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
      // LE LOGO VERT, SANS CARRÉ DE FOND. Les icônes portaient une plaque
      // sombre arrondie : sur un onglet clair, un pavé noir. Elles sont
      // transparentes, avec un contour vert profond d'un pixel qui dessine la
      // forme sur fond clair et disparaît sur fond sombre. Seules les icônes
      // `maskable` du manifeste gardent un fond plein : le système les découpe
      // à sa propre forme, et un fond transparent y deviendrait noir.
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "preload",
        as: "font",
        type: "font/woff",
        href: "/fonts/tradevault-numerals-800.v1.woff",
        crossOrigin: "anonymous",
      },
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
  // LA LANGUE DU DOCUMENT SUIT L'ADRESSE.
  //
  // Elle était figée sur `SSR_LANG`. C'était exact tant qu'une seule langue
  // avait une adresse ; depuis que `/fr` existe (`routes/fr.tsx`), une page
  // française serait servie sous `<html lang="en">` — le document se
  // contredirait sur sa propre langue, ce que `SSR_LANG` avait justement été
  // créé pour empêcher.
  //
  // `shellComponent` est rendu par `Match` (@tanstack/react-router), donc à
  // l'intérieur du routeur : l'état de navigation y est lisible.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lang = langForPath(pathname);

  return (
    // Theme is applied at runtime by ThemeProvider (post-hydration). The default
    // "Graphite" palette lives in the CSS :root, so the first paint is already
    // themed for default-theme users with no flash and no hydration divergence.
    //
    // La langue du HTML SERVI. Elle doit rester alignée sur `SSR_LANG`
    // (`shared/lang.ts`), sur la langue des métadonnées (`routes/index.tsx`) et
    // sur `og:locale` : c'est ce quatuor que voit un
    // moteur de recherche, et il était incohérent — `lang="fr"` et un titre
    // français pour un corps rendu en anglais.
    //
    // Après hydratation, `LandingLangProvider` remplace cet attribut par la
    // langue réelle du visiteur, avant la première peinture.
    <html lang={lang}>
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
         * puis un basculement vers Inter qui remesure chaque titre et
         * chaque ligne de texte : un reflow de la page complète, à chaque
         * premier chargement. C'est la source de décalage la plus visible du
         * produit, et elle n'a rien à voir avec React.
         *
         * Ce script s'exécute à l'analyse du document et bascule le lien dès
         * que le CSS arrive, typiquement bien avant l'hydratation. L'effet
         * React reste en place comme filet : la bascule est idempotente. */}
        <script dangerouslySetInnerHTML={{ __html: STORAGE_FALLBACK_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SESSION_VEIL_SCRIPT }} />
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
      // Rechargement unique partagé avec `lazyPage` (même clé, même garde) :
      // les chargements différés reconnaissent l'import annulé et patientent.
      if (reloadForStaleChunk()) {
        e.preventDefault();
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
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes.
          Les adresses de l'application passent par `AppHost`, qui rend
          lui-même l'`<Outlet />` (contenu serveur) avant que `App` ne monte. */}
      {isAppPath(pathname) ? <AppHost pathname={pathname} /> : <Outlet />}
    </QueryClientProvider>
  );
}
