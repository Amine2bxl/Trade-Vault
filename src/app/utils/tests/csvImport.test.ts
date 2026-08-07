import { describe, it, expect } from "bun:test";
import {
  guessMapping,
  mapRowsToTrades,
  parseCsv,
  parseDateTime,
  parseDirection,
  parseMoney,
  rejectFile,
  splitDuplicates,
  tradeSignature,
} from "../csvImport";
import type { Trade } from "../../types";

describe("parseCsv", () => {
  it("détecte le séparateur — virgule, point-virgule ou tabulation", () => {
    // Les exports européens utilisent le point-virgule ; imposer la virgule
    // ferait lire tout le fichier comme une seule colonne.
    expect(parseCsv("a;b;c\n1;2;3").headers).toEqual(["a", "b", "c"]);
    expect(parseCsv("a\tb\n1\t2").headers).toEqual(["a", "b"]);
  });

  it("respecte les guillemets — un champ notes peut contenir le séparateur", () => {
    const { rows } = parseCsv('date,notes\n2026-01-02,"trop tôt, encore"');
    expect(rows[0][1]).toBe("trop tôt, encore");
  });

  it("gère les guillemets échappés", () => {
    const { rows } = parseCsv('a\n"il a dit ""non"""');
    expect(rows[0][0]).toBe('il a dit "non"');
  });

  it("retire le BOM des exports Windows", () => {
    // Sans ça, la première colonne garde le BOM collé devant son nom et
    // n'est jamais reconnue par la devinette de colonnes.
    expect(parseCsv("\uFEFFdate,pnl\n2026-01-02,10").headers[0]).toBe("date");
  });

  it("ignore les lignes vides", () => {
    expect(parseCsv("a,b\n1,2\n\n\n3,4").rows).toHaveLength(2);
  });

  it("rend un résultat vide sur un fichier vide, sans planter", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("parseMoney", () => {
  it("lit le format anglo-saxon et le format européen", () => {
    expect(parseMoney("1,234.56")).toBe(1234.56);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("12,5")).toBe(12.5);
  });

  it("les parenthèses comptables signifient NÉGATIF", () => {
    // Le piège le plus coûteux : une perte lue comme un gain inverse le P&L
    // total, le win rate et le profit factor.
    expect(parseMoney("(1.234,56)")).toBe(-1234.56);
    expect(parseMoney("(250)")).toBe(-250);
  });

  it("retire les symboles de devise et les espaces", () => {
    expect(parseMoney(" $1,250.00 ")).toBe(1250);
    expect(parseMoney("€ 90")).toBe(90);
  });

  it("rend null sur une valeur illisible ou vide", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("n/a")).toBeNull();
  });
});

describe("parseDateTime", () => {
  it("lit l'ISO avec ou sans heure", () => {
    expect(parseDateTime("2026-03-14")).toEqual({ date: "2026-03-14", time: "" });
    expect(parseDateTime("2026-03-14T09:35")).toEqual({ date: "2026-03-14", time: "09:35" });
  });

  it("lit le format US MM/DD/YYYY avec AM/PM", () => {
    expect(parseDateTime("3/14/2026 1:05 PM")).toEqual({ date: "2026-03-14", time: "13:05" });
    expect(parseDateTime("3/14/2026 12:05 AM")).toEqual({ date: "2026-03-14", time: "00:05" });
  });

  it("rend null sur une date illisible — mieux vaut ignorer que deviner", () => {
    expect(parseDateTime("hier")).toBeNull();
    expect(parseDateTime("")).toBeNull();
  });
});

describe("parseDirection", () => {
  it("reconnaît les abréviations des brokers", () => {
    expect(parseDirection("Buy")).toBe("long");
    expect(parseDirection("SLD")).toBe("short");
    expect(parseDirection("inconnu")).toBeNull();
  });
});

describe("guessMapping", () => {
  it("reconnaît un export TopStep", () => {
    const m = guessMapping(["ContractName", "EnteredAt", "ExitedAt", "PnL"]);
    expect(m.symbol).toBe(0);
    expect(m.pnl).toBe(3);
  });

  it("n'attribue jamais deux fois la même colonne", () => {
    const m = guessMapping(["Entry Time", "Exit Time", "Symbol", "Profit"]);
    const used = Object.values(m);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("mapRowsToTrades", () => {
  const mapping = { date: 0, symbol: 1, pnl: 2 };

  it("convertit une ligne complète", () => {
    const { valid, invalid } = mapRowsToTrades([["2026-03-14", "es", "250"]], mapping);
    expect(invalid).toBe(0);
    expect(valid[0].symbol).toBe("ES");
    expect(valid[0].pnl).toBe(250);
  });

  it("COMPTE les lignes inexploitables au lieu de les deviner", () => {
    // Un trade faux pollue les statistiques bien plus qu'un trade manquant.
    const { valid, invalid } = mapRowsToTrades(
      [
        ["2026-03-14", "ES", "250"],
        ["pas-une-date", "ES", "250"],
        ["2026-03-15", "", "250"],
        ["2026-03-16", "ES", ""],
      ],
      mapping,
    );
    expect(valid).toHaveLength(1);
    expect(invalid).toBe(3);
  });

  it("déduit le R multiple du risque quand la colonne manque", () => {
    const { valid } = mapRowsToTrades([["2026-03-14", "ES", "250", "100"]], {
      ...mapping,
      risk: 3,
    });
    expect(valid[0].rMultiple).toBe(2.5);
  });

  it("un risque absent donne un R multiple de 0, pas une division par zéro", () => {
    const { valid } = mapRowsToTrades([["2026-03-14", "ES", "250"]], mapping);
    expect(valid[0].rMultiple).toBe(0);
  });
});

describe("splitDuplicates", () => {
  const trade = (date: string, pnl: number): Trade =>
    mapRowsToTrades([[date, "ES", String(pnl)]], { date: 0, symbol: 1, pnl: 2 }).valid[0];

  it("ignore un trade déjà présent au journal", () => {
    // Réimporter le même fichier est l'erreur la plus courante ; elle ne doit
    // jamais doubler l'historique.
    const a = trade("2026-03-14", 250);
    const { fresh, duplicates } = splitDuplicates([a], [a]);
    expect(fresh).toHaveLength(0);
    expect(duplicates).toBe(1);
  });

  it("dédoublonne aussi À L'INTÉRIEUR du fichier", () => {
    const a = trade("2026-03-14", 250);
    const b = trade("2026-03-14", 250);
    const { fresh, duplicates } = splitDuplicates([a, b], []);
    expect(fresh).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it("garde deux trades du même jour sur le même symbole mais de P&L différents", () => {
    const { fresh } = splitDuplicates([trade("2026-03-14", 250), trade("2026-03-14", -80)], []);
    expect(fresh).toHaveLength(2);
  });

  it("la signature combine date, symbole, P&L et heure d'entrée", () => {
    expect(tradeSignature({ date: "2026-03-14", symbol: "ES", pnl: 250, entryTime: "09:35" })).toBe(
      "2026-03-14|ES|250|09:35",
    );
  });
});

describe("rejectFile", () => {
  const file = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
    name: "export.csv",
    size: 1024,
    type: "text/csv",
    ...over,
  });

  it("accepte un CSV normal", () => {
    expect(rejectFile(file())).toBeNull();
  });

  it("refuse un fichier vide, un PDF et un fichier trop gros", () => {
    // Chacun de ces cas ne produisait AUCUN retour à l'écran auparavant.
    expect(rejectFile(file({ size: 0 }))).toBe("empty");
    expect(rejectFile(file({ name: "releve.pdf", type: "application/pdf" }))).toBe("notCsv");
    expect(rejectFile(file({ size: 20 * 1024 * 1024 }))).toBe("tooLarge");
  });

  it("accepte un .txt — certains brokers exportent en texte tabulé", () => {
    expect(rejectFile(file({ name: "export.txt", type: "text/plain" }))).toBeNull();
  });
});
