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
import { reportAppError } from "../shared/error-reporting";
import { lockZoom } from "../shared/lock-zoom";
import ErrorScreen from "../tradevault/components/ErrorScreen";

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
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#060810" },
      { name: "trustpilot-one-time-domain-verification-id", content: "3a2800eb-0ad2-4c9a-bda2-1d3833f70ef0" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TradeVault" },
      { title: "TradeVault" },
      { name: "description", content: "Trade Tracker Pro is a comprehensive trading journal application for traders to log, analyze, and improve their performance." },
      { property: "og:title", content: "TradeVault" },
      { property: "og:description", content: "Trade Tracker Pro is a comprehensive trading journal application for traders to log, analyze, and improve their performance." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/icon-512.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "TradeVault" },
      { name: "twitter:description", content: "Trade Tracker Pro is a comprehensive trading journal application for traders to log, analyze, and improve their performance." },
      { name: "twitter:image", content: "/icon-512.png" },
    ],
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
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" },
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
    <html lang="en">
      <head>
        <HeadContent />
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

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw-push.js', { scope: '/' }).catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
