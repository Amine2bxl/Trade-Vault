import { describe, expect, test } from "bun:test";
import {
  currenciesForSymbol,
  currencyFocus,
  normalizeSymbol,
} from "../src/domain/instrumentCurrency";

/**
 * DU SYMBOLE À LA DEVISE — le pont entre le journal (NQ, EURUSD…) et le
 * calendrier économique (USD, EUR…). Une erreur ici fait sonner le téléphone
 * pour la mauvaise annonce, ou le fait taire pour la bonne.
 */

describe("normalizeSymbol", () => {
  test("préfixes de plateforme, suffixes de broker et séparateurs", () => {
    expect(normalizeSymbol("CME_MINI:NQ1!")).toBe("NQ1");
    expect(normalizeSymbol("eurusd.pro")).toBe("EURUSD");
    expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
    expect(normalizeSymbol("  gbp-jpy ")).toBe("GBPJPY");
  });
});

describe("currenciesForSymbol", () => {
  test("une paire expose ses deux devises, la base d'abord", () => {
    expect(currenciesForSymbol("EURUSD")).toEqual(["EUR", "USD"]);
    expect(currenciesForSymbol("gbp/jpy")).toEqual(["GBP", "JPY"]);
  });

  test("l'or et l'argent suivent leur devise de cotation", () => {
    expect(currenciesForSymbol("XAUUSD")).toEqual(["USD"]);
    expect(currenciesForSymbol("XAGEUR")).toEqual(["EUR"]);
  });

  test("indices US, matières premières, crypto → USD", () => {
    for (const s of ["NQ", "MNQ", "ES", "US30", "NAS100", "GC", "CL", "BTCUSD", "BTC"]) {
      expect(currenciesForSymbol(s), s).toEqual(["USD"]);
    }
  });

  test("indices hors US → leur devise", () => {
    expect(currenciesForSymbol("GER40")).toEqual(["EUR"]);
    expect(currenciesForSymbol("FDAX")).toEqual(["EUR"]);
    expect(currenciesForSymbol("UK100")).toEqual(["GBP"]);
    expect(currenciesForSymbol("JP225")).toEqual(["JPY"]);
  });

  test("contrats continus et datés", () => {
    expect(currenciesForSymbol("NQ1!")).toEqual(["USD"]);
    expect(currenciesForSymbol("NQZ5")).toEqual(["USD"]);
    expect(currenciesForSymbol("ESH26")).toEqual(["USD"]);
    expect(currenciesForSymbol("6EZ5")).toEqual(["EUR", "USD"]);
  });

  test("un symbole inconnu n'expose rien : on ne devine pas", () => {
    expect(currenciesForSymbol("AAPLXYZ")).toEqual([]);
    expect(currenciesForSymbol("")).toEqual([]);
  });
});

describe("currencyFocus", () => {
  const today = "2026-03-10";
  const t = (symbol: string, date = "2026-03-01") => ({ symbol, date });

  test("les devises viennent du journal, de la plus tradée à la moins", () => {
    const f = currencyFocus([t("NQ"), t("NQ"), t("ES"), t("EURUSD"), t("NQ")], [], today);
    expect(f.currencies).toEqual(["USD", "EUR"]);
    expect(f.share.USD).toBe(1);
    expect(f.share.EUR).toBe(0.2);
    expect(f.basedOn).toBe(5);
  });

  test("un essai isolé (moins de 10 %) ne fait pas sonner le téléphone", () => {
    const trades = [...Array.from({ length: 12 }, () => t("NQ")), t("AUDCAD")];
    const f = currencyFocus(trades, [], today);
    expect(f.currencies).toEqual(["USD"]);
  });

  test("le récent compte, l'ancien s'efface", () => {
    const anciens = Array.from({ length: 10 }, () => t("GER40", "2025-06-01"));
    const recents = Array.from({ length: 6 }, () => t("NQ", "2026-03-05"));
    const f = currencyFocus([...anciens, ...recents], [], today);
    expect(f.currencies).toEqual(["USD"]);
  });

  test("journal vide : les marchés déclarés à l'onboarding prennent le relais", () => {
    expect(currencyFocus([], ["futures"], today).currencies).toEqual(["USD"]);
    expect(currencyFocus([], ["forex"], today).currencies).toEqual(["USD", "EUR", "GBP", "JPY"]);
    expect(currencyFocus([], [], today).currencies).toEqual([]);
  });
});
