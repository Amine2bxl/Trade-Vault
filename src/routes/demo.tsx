import { createFileRoute } from "@tanstack/react-router";
import { pageSeo } from "../shared/seo";
import { LandingDemo } from "@/app/components/LandingDemo";

// /demo — la démo « GIF » : lecture automatique des principales features.
export const Route = createFileRoute("/demo")({
  head: () =>
    pageSeo({
      title: "TradeVault — Démo en vidéo",
      description:
        "Découvre TradeVault en quelques secondes : tableau de bord, journal de trading, analytics et coach IA.",
      path: "/demo",
      index: false,
    }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <LandingDemo
      mode="video"
      onClose={() => {
        window.location.href = "/";
      }}
    />
  );
}
