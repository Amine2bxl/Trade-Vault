import { describe, it, expect } from "bun:test";
import { isEntitled } from "../src/backend/require-pro";

describe("require-pro", () => {
  it("denies null subscription", () => {
    expect(isEntitled(null)).toBe(false);
  });

  it("allows active subscription", () => {
    expect(isEntitled({ status: "active", trial_ends_at: null })).toBe(true);
  });

  it("denies cancelled subscription", () => {
    expect(isEntitled({ status: "canceled", trial_ends_at: null })).toBe(false);
  });

  it("allows active trial", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isEntitled({ status: "trialing", trial_ends_at: future })).toBe(true);
  });

  it("denies expired trial", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isEntitled({ status: "trialing", trial_ends_at: past })).toBe(false);
  });
});
