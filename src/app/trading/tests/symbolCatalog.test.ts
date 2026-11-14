import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SYMBOL_CATALOG, symbolChoices, symbolLogoFor } from "../symbolCatalog";

const single = (key: string) => ({ kind: "single", key });

describe("symbolLogoFor", () => {
  test("les indices US portent leur marque, mini comme micro", () => {
    for (const s of ["NQ", "MNQ", "mnqz5", "CME_MINI:NQ1!", "NAS100", "MNQ DEC25"])
      expect(symbolLogoFor(s)).toEqual(single("nasdaq"));
    for (const s of ["ES", "MES", "ESH26", "US500"])
      expect(symbolLogoFor(s)).toEqual(single("sp500"));
    expect(symbolLogoFor("YM")).toEqual(single("dow"));
    expect(symbolLogoFor("M2K")).toEqual(single("russell"));
  });

  test("une paire de devises = deux drapeaux, base d'abord", () => {
    expect(symbolLogoFor("EURUSD")).toEqual({ kind: "pair", keys: ["flag-eu", "flag-us"] });
    expect(symbolLogoFor("usd/jpy")).toEqual({ kind: "pair", keys: ["flag-us", "flag-jp"] });
    expect(symbolLogoFor("6EZ5")).toEqual({ kind: "pair", keys: ["flag-eu", "flag-us"] });
  });

  test("crypto, métaux, énergie", () => {
    for (const s of ["BTC", "BTCUSD", "btcusdt", "MBT"])
      expect(symbolLogoFor(s)).toEqual(single("btc"));
    expect(symbolLogoFor("ETHUSD")).toEqual(single("eth"));
    expect(symbolLogoFor("XAUUSD")).toEqual(single("gold"));
    expect(symbolLogoFor("GCG26")).toEqual(single("gold"));
    expect(symbolLogoFor("CL")).toEqual(single("oil"));
  });

  test("un symbole inconnu n'a pas de logo — on ne devine pas", () => {
    for (const s of ["", "TSLA", "ESTC", "NQX", "ABCDEF"]) expect(symbolLogoFor(s)).toBeNull();
  });
});

describe("catalogue de saisie", () => {
  test("chaque symbole proposé a un logo dont le fichier existe", () => {
    const dir = join(import.meta.dir, "../../../assets/symbols");
    for (const c of SYMBOL_CATALOG) {
      const logo = symbolLogoFor(c.symbol);
      expect(logo, c.symbol).not.toBeNull();
      const keys = logo!.kind === "single" ? [logo!.key] : logo!.keys;
      for (const k of keys)
        expect(existsSync(join(dir, `${k}.svg`)), `${c.symbol} → ${k}`).toBe(true);
    }
    expect(new Set(SYMBOL_CATALOG.map((c) => c.symbol)).size).toBe(SYMBOL_CATALOG.length);
  });

  test("les symboles du trader passent en tête, du plus fréquent au plus rare, sans doublon", () => {
    const list = symbolChoices(["mnq", "TSLA", "MNQ", "ES"], "aapl").map((c) => c.symbol);
    expect(list.slice(0, 4)).toEqual(["AAPL", "MNQ", "TSLA", "ES"]);
    expect(list.filter((s) => s === "MNQ")).toHaveLength(1);
    expect(list).toContain("EURUSD");
  });
});
