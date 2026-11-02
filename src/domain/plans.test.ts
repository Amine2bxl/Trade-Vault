import { describe, expect, it } from "bun:test";
import {
  ACCOUNT_LIMIT,
  CAPABILITY_TIER,
  LIFETIME_EUR,
  LIFETIME_PLAN,
  PAID_TIERS,
  TIERS,
  TIER_BY_ID,
  intervalOf,
  isPaidPlan,
  monthsFree,
  planId,
  planPrice,
  tierAtLeast,
  tierOf,
  yearlySaving,
} from "./plans";

describe("catalogue d'offres", () => {
  it("annonce les prix convenus", () => {
    // UNE offre à la vente : la licence à vie, 20 € payés une fois. Les anciens
    // tarifs Pro restent décrits pour les abonnés d'avant, plus vendus.
    expect(LIFETIME_EUR).toBe(20);
    expect(planPrice(LIFETIME_PLAN)).toBe(20);
    expect(TIERS.map((t) => t.id)).toEqual(["free", "elite"]);
    expect(TIER_BY_ID.elite.monthly).toBe(LIFETIME_EUR);
    expect(TIER_BY_ID.elite.yearly).toBe(LIFETIME_EUR);
    expect(TIER_BY_ID.pro.monthly).toBe(15);
  });

  it("la licence à vie ouvre le palier le plus haut", () => {
    expect(isPaidPlan(LIFETIME_PLAN)).toBe(true);
    expect(tierOf(LIFETIME_PLAN)).toBe("elite");
    expect(tierOf("pro_monthly")).toBe("pro");
    expect(tierOf("free")).toBe("free");
  });

  it("n'affiche jamais une offre annuelle plus chère que douze mensualités", () => {
    for (const tier of TIERS) {
      if (!tier.monthly) continue;
      expect(tier.yearly).toBeLessThan(tier.monthly * 12);
    }
  });

  it("facture exactement ce que le catalogue annonce", () => {
    for (const tier of PAID_TIERS) {
      expect(planPrice(planId(tier, "monthly"))).toBe(TIER_BY_ID[tier].monthly);
      expect(planPrice(planId(tier, "yearly"))).toBe(TIER_BY_ID[tier].yearly);
    }
  });

  it("reconnaît les plans valides et rejette le reste", () => {
    expect(isPaidPlan("elite_yearly")).toBe(true);
    // L'offre Fund a été retirée du catalogue : ses plans ne doivent plus
    // ouvrir quoi que ce soit, y compris pour une ligne restée en base.
    expect(isPaidPlan("fund_yearly")).toBe(false);
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("pro_weekly")).toBe(false);
    expect(isPaidPlan("")).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    // Un plan inventé ne doit jamais ouvrir un accès payant.
    expect(isPaidPlan("admin_yearly")).toBe(false);
  });

  it("déduit palier et période d'un plan, y compris d'une valeur inconnue", () => {
    expect(tierOf("fund_monthly")).toBe("free");
    expect(tierOf("free")).toBe("free");
    expect(tierOf(null)).toBe("free");
    expect(tierOf("n'importe quoi")).toBe("free");
    expect(intervalOf("elite_yearly")).toBe("yearly");
    expect(intervalOf("elite_monthly")).toBe("monthly");
  });

  it("fait hériter chaque palier de ceux d'en dessous", () => {
    expect(tierAtLeast("elite", "pro")).toBe(true);
    expect(tierAtLeast("elite", "elite")).toBe(true);
    expect(tierAtLeast("pro", "elite")).toBe(false);
    expect(tierAtLeast("free", "pro")).toBe(false);
  });

  it("ouvre plus de comptes à chaque palier", () => {
    expect(ACCOUNT_LIMIT.free).toBeLessThan(ACCOUNT_LIMIT.pro);
    expect(ACCOUNT_LIMIT.pro).toBeLessThan(ACCOUNT_LIMIT.elite);
  });

  it("met la promesse du produit dans Pro, pas dans l'offre la plus chère", () => {
    // Pro doit ouvrir strictement plus de capacités qu'Elite n'en ajoute :
    // c'est l'offre qu'on veut vendre, donc c'est elle qui porte la valeur.
    const perTier = (t: string) => Object.values(CAPABILITY_TIER).filter((v) => v === t).length;
    expect(perTier("pro")).toBeGreaterThan(perTier("elite"));
  });

  it("ne garde aucune capacité derrière l'offre gratuite", () => {
    // Une capacité marquée « free » serait un cadenas sur du gratuit.
    for (const required of Object.values(CAPABILITY_TIER)) {
      expect(required).not.toBe("free");
    }
  });
});
