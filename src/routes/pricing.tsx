import { createFileRoute } from "@tanstack/react-router";
import PricingPage from "../app/pages/PricingPage";
import { pageSeo } from "../shared/seo";

export const Route = createFileRoute("/pricing")({
  head: () =>
    pageSeo({
      title: "Pricing — TradeVault",
      description:
        "TradeVault pricing: a free plan with no time limit, and Pro for the full behavioural analysis. No card to start, cancel in one click.",
      path: "/pricing",
    }),
  component: PricingPage,
});
