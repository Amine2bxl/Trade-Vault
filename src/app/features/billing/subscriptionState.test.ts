import { describe, expect, it } from "bun:test";
import type { Subscription } from "@/app/hooks/useSubscription";
import { checkoutErrorKey, etatAbonnement, offerMode } from "./subscriptionState";

const base: Subscription = {
  plan: "elite_monthly",
  status: "active",
  source: "stripe",
  trialEndsAt: null,
  currentPeriodEnd: new Date("2026-12-15T00:00:00Z"),
  cancelAtPeriodEnd: false,
  hasStripeCustomer: true,
};

describe("etatAbonnement — un état nommé, décidé une fois", () => {
  it("sans ligne ou sur un plan gratuit : gratuit", () => {
    expect(etatAbonnement(null)).toBe("free");
    expect(etatAbonnement({ ...base, plan: "free" })).toBe("free");
  });

  it("une licence se reconnaît à son plan, pas à l'absence d'échéance", () => {
    expect(etatAbonnement({ ...base, plan: "lifetime", currentPeriodEnd: null })).toBe("lifetime");
    // Même si une date traîne sur la ligne, une licence active reste une licence.
    expect(etatAbonnement({ ...base, plan: "lifetime" })).toBe("lifetime");
  });

  it("l'annulation passe AVANT l'actif — c'est ce qui la rendait invisible", () => {
    expect(etatAbonnement({ ...base, cancelAtPeriodEnd: true })).toBe("cancelling");
    expect(etatAbonnement(base)).toBe("active");
  });

  it("impayé et terminé ont leur propre état", () => {
    expect(etatAbonnement({ ...base, status: "past_due" })).toBe("pastDue");
    expect(etatAbonnement({ ...base, status: "expired" })).toBe("expired");
  });
});

describe("offerMode — ce que la page propose d'acheter", () => {
  it("au gratuit et à l'abonnement terminé : les deux offres", () => {
    expect(offerMode(null, "free")).toBe("choose");
    const fini = { ...base, status: "expired" as const };
    expect(offerMode(fini, etatAbonnement(fini))).toBe("choose");
  });

  it("au mensuel en cours, même annulé ou impayé : la licence seulement", () => {
    for (const s of [
      base,
      { ...base, cancelAtPeriodEnd: true },
      { ...base, status: "past_due" as const },
    ]) {
      expect(offerMode(s, etatAbonnement(s))).toBe("upgrade");
    }
  });

  it("à la licence : plus rien à vendre", () => {
    const l = { ...base, plan: "lifetime" as const, currentPeriodEnd: null };
    expect(offerMode(l, etatAbonnement(l))).toBe("none");
  });
});

describe("checkoutErrorKey — jamais le code brut du serveur à l'écran", () => {
  it("traduit chaque code connu", () => {
    expect(checkoutErrorKey("already lifetime")).toBe("billing.err.alreadyLifetime");
    expect(checkoutErrorKey("already subscribed")).toBe("billing.err.alreadySubscribed");
    expect(checkoutErrorKey("price not configured")).toBe("billing.err.unavailable");
    expect(checkoutErrorKey("invalid promo code")).toBe("billing.err.invalidPromo");
    expect(checkoutErrorKey("not signed in")).toBe("billing.err.signedOut");
  });

  it("un code inconnu tombe sur la phrase générique", () => {
    expect(checkoutErrorKey("boom")).toBe("billing.err.generic");
    expect(checkoutErrorKey("")).toBe("billing.err.generic");
  });
});
