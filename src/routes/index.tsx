import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import App from "@/tradevault/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeVault — Trading Journal & Analytics" },
      {
        name: "description",
        content:
          "Track your trades, analyze your performance, review your mistakes and level up as a trader.",
      },
      { property: "og:title", content: "TradeVault — Trading Journal & Analytics" },
      {
        property: "og:description",
        content:
          "Track your trades, analyze your performance, review your mistakes and level up as a trader.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <App />
    </ClientOnly>
  );
}
