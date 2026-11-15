import { beforeEach, describe, expect, it } from "bun:test";
import {
  CHECKOUT_INTENT_TTL_MS,
  rememberCheckoutIntent,
  takeCheckoutIntent,
} from "./checkoutIntent";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("checkoutIntent — l'offre choisie avant d'avoir un compte", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("rend l'offre retenue, une seule fois", () => {
    rememberCheckoutIntent("lifetime", 1_000);
    expect(takeCheckoutIntent(2_000)).toBe("lifetime");
    expect(takeCheckoutIntent(3_000)).toBeNull();
  });

  it("garde le mensuel tel quel", () => {
    rememberCheckoutIntent("elite_monthly", 1_000);
    expect(takeCheckoutIntent(1_500)).toBe("elite_monthly");
  });

  it("expire après 24 h", () => {
    rememberCheckoutIntent("lifetime", 0);
    expect(takeCheckoutIntent(CHECKOUT_INTENT_TTL_MS + 1)).toBeNull();
  });

  it("ignore une valeur illisible ou une offre qui n'est plus en vente", () => {
    localStorage.setItem("tv.checkout.intent", "{pas du json");
    expect(takeCheckoutIntent()).toBeNull();
    localStorage.setItem(
      "tv.checkout.intent",
      JSON.stringify({ plan: "pro_yearly", at: Date.now() }),
    );
    expect(takeCheckoutIntent()).toBeNull();
  });
});
