import { describe, expect, it } from "bun:test";
import { decidePromoCode, normalizePromoCode, promoCodeIsUsable, type PromoCodeRow } from "./promo";

function row(overrides: Partial<PromoCodeRow> = {}): PromoCodeRow {
  return {
    code: "THOMAS_TRADES",
    plan: "pro_yearly",
    ownerEmail: null,
    discountPercent: null,
    active: true,
    expiresAt: null,
    maxUses: null,
    usesCount: 0,
    note: null,
    grantedBy: "admin@tradevault.be",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const NOW = new Date("2026-08-28T00:00:00Z").getTime();

describe("normalizePromoCode", () => {
  it("met en majuscules et nettoie", () => {
    expect(normalizePromoCode("  thomas trades  ")).toBe("THOMASTRADES");
    expect(normalizePromoCode("THOMAS_TRADES")).toBe("THOMAS_TRADES");
    expect(normalizePromoCode("va%ult#20")).toBe("VAULT20");
  });

  it("renvoie null pour un vide, du blanc ou juste du bruit", () => {
    expect(normalizePromoCode("")).toBeNull();
    expect(normalizePromoCode("   ")).toBeNull();
    expect(normalizePromoCode("###")).toBeNull();
    expect(normalizePromoCode(undefined)).toBeNull();
    expect(normalizePromoCode(null)).toBeNull();
  });
});

describe("promoCodeIsUsable", () => {
  it("refuse un code inactif", () => {
    expect(promoCodeIsUsable(row({ active: false }), NOW)).toBe(false);
  });

  it("refuse un code expiré", () => {
    expect(promoCodeIsUsable(row({ expiresAt: "2026-08-01T00:00:00Z" }), NOW)).toBe(false);
  });

  it("accepte une expiration future", () => {
    expect(promoCodeIsUsable(row({ expiresAt: "2026-12-01T00:00:00Z" }), NOW)).toBe(true);
  });

  it("refuse un code dont le quota est atteint", () => {
    expect(promoCodeIsUsable(row({ maxUses: 10, usesCount: 10 }), NOW)).toBe(false);
  });

  it("accepte exactement la dernière place du quota", () => {
    expect(promoCodeIsUsable(row({ maxUses: 10, usesCount: 9 }), NOW)).toBe(true);
  });
});

describe("decidePromoCode", () => {
  it("ouvre l'accès PERMANENT au titulaire (code influenceur)", () => {
    const d = decidePromoCode(row({ ownerEmail: "thomas@mail.com" }), "THOMAS@MAIL.COM", NOW);
    expect(d).toEqual({ status: "owner", plan: "pro_yearly" });
  });

  it("donne -20% à la communauté d'un code à titulaire", () => {
    const d = decidePromoCode(
      row({ ownerEmail: "thomas@mail.com", discountPercent: 20 }),
      "abel@mail.com",
      NOW,
    );
    expect(d).toEqual({ status: "discount", percent: 20 });
  });

  it("refuse un code strictement personnel à quelqu'un d'autre", () => {
    const d = decidePromoCode(row({ ownerEmail: "thomas@mail.com" }), "abel@mail.com", NOW);
    expect(d).toEqual({ status: "owner_mismatch" });
  });

  it("ouvre l'accès permanent à n'importe qui (code invite)", () => {
    const d = decidePromoCode(row(), "abel@mail.com", NOW);
    expect(d).toEqual({ status: "free", plan: "pro_yearly" });
  });

  it("refuse tout code inactif, expiré ou épuisé", () => {
    for (const bad of [
      row({ active: false }),
      row({ expiresAt: "2026-01-01T00:00:00Z" }),
      row({ maxUses: 5, usesCount: 5 }),
    ]) {
      expect(decidePromoCode(bad, "abel@mail.com", NOW)).toEqual({ status: "invalid" });
    }
  });

  it("ne compare jamais le titulaire à une adresse vide", () => {
    expect(decidePromoCode(row(), "", NOW).status).toBe("free");
  });

  it("garde la priorité au titulaire sur une éventuelle réduction", () => {
    const d = decidePromoCode(
      row({ ownerEmail: "thomas@mail.com", discountPercent: 30 }),
      "thomas@mail.com",
      NOW,
    );
    expect(d.status).toBe("owner");
  });
});
