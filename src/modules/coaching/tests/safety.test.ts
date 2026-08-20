import { describe, expect, it } from "bun:test";
import { MIN_SAMPLE, sampleVerdict } from "../safety";

describe("sécurité statistique", () => {
  it("un échantillon sous le seuil n'est pas suffisant", () => {
    const v = sampleVerdict(3);
    expect(v.sufficient).toBe(false);
    expect(v.missing).toBe(MIN_SAMPLE - 3);
    expect(v.required).toBe(MIN_SAMPLE);
  });

  it("un échantillon au seuil est suffisant", () => {
    expect(sampleVerdict(MIN_SAMPLE).sufficient).toBe(true);
    expect(sampleVerdict(MIN_SAMPLE).missing).toBe(0);
  });

  it("missing n'est jamais négatif", () => {
    expect(sampleVerdict(MIN_SAMPLE + 100).missing).toBe(0);
  });

  it("le seuil par défaut est respecté quand rien n'est passé", () => {
    const v = sampleVerdict(9);
    expect(v.required).toBe(MIN_SAMPLE);
  });
});
