import { describe, expect, test } from "bun:test";
import {
  assignImportKeys,
  canonicalTradeContent,
  planCsvImport,
  sha256Hex,
} from "../src/domain/importKey";

type Row = {
  date: string;
  symbol: string;
  direction: "long" | "short" | "be";
  pnl: number;
  riskAmount: number;
  entryTime: string;
  exitTime: string;
  notes?: string;
};

const row = (over: Partial<Row> = {}): Row => ({
  date: "2026-10-21",
  symbol: "NQ",
  direction: "long",
  pnl: 50,
  riskAmount: 0,
  entryTime: "",
  exitTime: "",
  ...over,
});

describe("clés d'occurrence", () => {
  test("sha256Hex suit la norme (vecteur « abc »)", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("deux trades réels identiques d'un fichier restent DEUX trades", async () => {
    // Le défaut corrigé : deux scalps NQ à +50 $ sans heure ne faisaient qu'un.
    const keyed = await assignImportKeys([row(), row()]);
    expect(keyed[0].key).not.toBe(keyed[1].key);
    expect(keyed[0].key.endsWith("#0")).toBe(true);
    expect(keyed[1].key.endsWith("#1")).toBe(true);
    const plan = planCsvImport(keyed, []);
    expect(plan.fresh).toHaveLength(2);
    expect(plan.duplicates).toBe(0);
  });

  test("réimporter le même fichier n'ajoute rien", async () => {
    const file = [row(), row(), row({ pnl: -20, direction: "short" })];
    const first = planCsvImport(await assignImportKeys(file), []);
    const journal = first.fresh.map((r) => ({ ...r.trade, importKey: r.key }));
    const again = planCsvImport(await assignImportKeys(file), journal);
    expect(again.fresh).toHaveLength(0);
    expect(again.duplicates).toBe(3);
  });

  test("un export plus long n'importe que les nouvelles lignes", async () => {
    const before = [row(), row()];
    const journal = planCsvImport(await assignImportKeys(before), []).fresh.map((r) => ({
      ...r.trade,
      importKey: r.key,
    }));
    const after = [row(), row(), row(), row({ date: "2026-10-22" })];
    const plan = planCsvImport(await assignImportKeys(after), journal);
    // Le 3e scalp identique est un fait nouveau (rang #2), comme le 22.
    expect(plan.fresh.map((r) => r.key.split("#")[1])).toEqual(["2", "0"]);
    expect(plan.duplicates).toBe(2);
  });

  test("les annotations ne changent pas l'identité d'une ligne", () => {
    expect(canonicalTradeContent(row({ notes: "a" } as Partial<Row>))).toBe(
      canonicalTradeContent(row({ notes: "b" } as Partial<Row>)),
    );
    expect(canonicalTradeContent(row({ pnl: 50 }))).not.toBe(
      canonicalTradeContent(row({ pnl: 51 })),
    );
  });
});

describe("historique sans clé (saisies manuelles, imports antérieurs au lot 1)", () => {
  test("une signature identique est un doublon PROBABLE, compté à part", async () => {
    const legacy = [{ date: "2026-10-21", symbol: "NQ", pnl: 50, entryTime: "" }];
    const plan = planCsvImport(await assignImportKeys([row()]), legacy);
    expect(plan.fresh).toHaveLength(0);
    expect(plan.probableDuplicates).toBe(1);
    expect(plan.duplicates).toBe(0);
  });

  test("multi-ensemble : deux lignes identiques face à UN trade déjà saisi → une importée", async () => {
    const legacy = [{ date: "2026-10-21", symbol: "NQ", pnl: 50, entryTime: "" }];
    const plan = planCsvImport(await assignImportKeys([row(), row()]), legacy);
    expect(plan.probableDuplicates).toBe(1);
    expect(plan.fresh).toHaveLength(1);
  });
});

describe("colonne d'identifiant", () => {
  test("l'identifiant prime sur le contenu", async () => {
    const keyed = await assignImportKeys([row(), row()], ["T-1", "T-2"]);
    expect(keyed.map((k) => k.key)).toEqual(["csv-id:T-1", "csv-id:T-2"]);
  });

  test("un identifiant répété avec le même contenu est un doublon du fichier", async () => {
    const plan = planCsvImport(await assignImportKeys([row(), row()], ["T-1", "T-1"]), []);
    expect(plan.fresh).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });

  test("un identifiant répété avec un AUTRE contenu : le fichier se contredit, rien n'est choisi au hasard", async () => {
    const plan = planCsvImport(
      await assignImportKeys([row({ pnl: 50 }), row({ pnl: 75 })], ["T-1", "T-1"]),
      [],
    );
    expect(plan.fresh).toHaveLength(1);
    expect(plan.inFileConflicts).toBe(1);
    expect(plan.statuses[1].status).toBe("in_file_conflict");
  });
});
