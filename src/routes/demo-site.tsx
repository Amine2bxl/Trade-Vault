import { createFileRoute } from "@tanstack/react-router";
import { pageSeo } from "../shared/seo";
import { LandingDemo } from "@/app/components/LandingDemo";

// /demo-site — la découverte GUIDÉE du site, sans connexion : l'utilisateur
// voit l'application en action (données d'exemple, rien de modifiable) et est
// accompagné écran par écran à travers les features.
export const Route = createFileRoute("/demo-site")({
  head: () =>
    pageSeo({
      title: "TradeVault — Découvre l'application",
      description:
        "Parcours guidé de TradeVault sur données d'exemple : tableau de bord, journal, analytics, coach IA Jarvis et checklist — sans créer de compte.",
      path: "/demo-site",
      index: false,
    }),
  component: DemoSitePage,
});

function DemoSitePage() {
  return (
    <LandingDemo
      mode="guide"
      onClose={() => {
        window.location.href = "/";
      }}
    />
  );
}
