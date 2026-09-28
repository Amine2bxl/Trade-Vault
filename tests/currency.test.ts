import { afterEach, describe, expect, test } from "bun:test";
import {
  CURRENCIES,
  currencySymbol,
  formatMoney,
  getCurrency,
  parseCurrency,
  setCurrency,
} from "../src/shared/currency";
import { formatPnl } from "../src/app/utils/tradeCalcs";
import { formatAxisMoney } from "../src/app/utils/chartTheme";

afterEach(() => setCurrency("USD"));

describe("devise globale", () => {
  test("le dollar reste le défaut", () => {
    expect(getCurrency()).toBe("USD");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatPnl(-80)).toBe("-$80.00");
    expect(formatPnl(0)).toBe("$0.00");
  });

  test("la préférence change CHAQUE montant formaté", () => {
    setCurrency("EUR");
    expect(formatMoney(1234.5)).toBe("€1,234.50");
    expect(formatPnl(250)).toBe("+€250.00");
    expect(formatAxisMoney(12_400)).toBe("€12k");
    setCurrency("GBP");
    expect(formatPnl(-1.5)).toBe("-£1.50");
  });

  test("le yen n'a pas de décimales", () => {
    setCurrency("JPY");
    expect(formatMoney(1234.56)).toBe("¥1,235");
    expect(formatPnl(300)).toBe("+¥300");
  });

  test("un symbole en lettres reste lisible (CHF)", () => {
    setCurrency("CHF");
    expect(currencySymbol()).toBe("CHF");
    expect(formatMoney(1500, { compact: true })).toBe("CHF 1.5k");
  });

  test("une valeur inconnue retombe sur le défaut, jamais sur une devise inventée", () => {
    expect(parseCurrency("XYZ")).toBe("USD");
    expect(parseCurrency(null)).toBe("USD");
    for (const c of CURRENCIES) expect(parseCurrency(c.code)).toBe(c.code);
  });

  test("chaque devise proposée se formate sans erreur", () => {
    for (const c of CURRENCIES) {
      expect(formatMoney(-1234.5, { currency: c.code })).toMatch(/^-/);
      expect(currencySymbol(c.code).length).toBeGreaterThan(0);
    }
  });
});
