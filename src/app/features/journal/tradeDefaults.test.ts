import { describe, expect, test } from "bun:test";
import { applyDefaults } from "./tradeDefaults";

const d = {
  symbol: "MNQ",
  strategy: "Silver Bullet",
  riskAmount: "150",
  riskType: "dollar" as const,
};
const blank = { symbol: "", strategy: "Scalping", riskAmount: "", riskType: "dollar" };

describe("défauts d'un compte", () => {
  test("remplissent un formulaire vierge", () => {
    expect(applyDefaults(blank, d, "Scalping")).toEqual({ ...d });
  });

  test("ne remplacent jamais ce qui est écrit (relais de séance, saisie)", () => {
    const fromSession = { symbol: "NQ", strategy: "ICT", riskAmount: "250", riskType: "dollar" };
    expect(applyDefaults(fromSession, d, "Scalping")).toEqual(fromSession);
  });
});
