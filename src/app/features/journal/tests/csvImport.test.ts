import { describe, it, expect } from "bun:test";
import {
  guessMapping,
  mapRowsToTrades,
  JOURNAL_REQUIRED,
  parseCsv,
  parseDateTime,
  parseDirection,
  parseMoney,
  rejectFile,
} from "../csvImport";

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

  it("rejects corrupted P&L instead of parsing a plausible prefix", () => {
    for (const input of [
      "125oops",
      "1.2.3",
      "Infinity",
      "NaN",
      "123USD",
      "1e9999",
      "1,2,3",
      "12,34,567",
      "1,23.00",
      "1,234",
      "1.234",
      "-12,345",
      "-12.345",
    ]) {
      expect(parseMoney(input)).toBeNull();
    }
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("-25.5")).toBe(-25.5);
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

  it("rejects impossible dates and hours instead of repairing them in a later layer", () => {
    for (const input of [
      "2026-02-30",
      "2025-02-29",
      "2026-13-01",
      "2026-10-00",
      "2026-04-31",
      "2026-03-14T24:00",
      "2026-03-14 09:60",
      "2026-03-14 09:10:61",
      "3/14/2026 13:05 PM",
      "3/14/2026 25:00",
      "2026-03-14garbage",
    ]) {
      expect(parseDateTime(input)).toBeNull();
    }
    expect(parseDateTime("2024-02-29 09:30")).toEqual({ date: "2024-02-29", time: "09:30" });
    expect(parseDateTime("2026.01.05 09:12:22")).toEqual({ date: "2026-01-05", time: "09:12" });
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

  it("reconnaît des en-têtes français, accents compris", () => {
    // Un export de broker européen arrive avec ces noms-là. Sans eux, le
    // trader doit tout mapper à la main dès son premier geste dans le produit.
    const m = guessMapping(["Date", "Symbole", "Résultat", "Sens", "Risque", "Stratégie"]);
    expect(m.date).toBe(0);
    expect(m.symbol).toBe(1);
    expect(m.pnl).toBe(2);
    expect(m.direction).toBe(3);
    expect(m.risk).toBe(4);
    expect(m.strategy).toBe(5);
  });

  it("une colonne exacte l'emporte sur une simple inclusion", () => {
    // Le piège corrigé : « Exit Time » contient « time », que la version
    // precedente attribuait a `date`. La date se retrouvait alors mappee sur
    // une heure de sortie, et l'import produisait un journal faux sans jamais
    // signaler d'erreur.
    const m = guessMapping(["Exit Time", "Entry Time", "Symbol", "Profit", "Date"]);
    expect(m.date).toBe(4);
    expect(m.entryTime).toBe(1);
    expect(m.exitTime).toBe(0);
  });

  it("l'ordre des colonnes ne change pas le résultat", () => {
    const a = guessMapping(["Date", "Symbol", "PnL"]);
    const b = guessMapping(["PnL", "Symbol", "Date"]);
    expect(a.date).toBe(0);
    expect(b.date).toBe(2);
    expect(b.pnl).toBe(0);
  });

  it("ignore la ponctuation et la casse des en-têtes", () => {
    const m = guessMapping(["date_du_trade", "SYMBOLE", "P&L net"]);
    expect(m.date).toBe(0);
    expect(m.symbol).toBe(1);
    expect(m.pnl).toBe(2);
  });

  it("ne devine rien sur des en-têtes qui ne veulent rien dire", () => {
    // Inventer une correspondance ici produirait un import silencieusement
    // faux : mieux vaut rendre la main au trader.
    const m = guessMapping(["col1", "col2", "col3"]);
    expect(Object.keys(m)).toHaveLength(0);
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

describe("journal import — provenance de la direction", () => {
  const mapping = { date: 0, symbol: 1, pnl: 2, direction: 3 };

  it("rejette un sens absent au lieu de produire silencieusement un long", () => {
    const result = mapRowsToTrades([["2026-03-14", "ES", "250", ""]], mapping, {
      required: JOURNAL_REQUIRED,
    });
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toBe(1);
  });

  it("refuse une direction inconnue, mais conserve les longs et shorts prouvés", () => {
    const result = mapRowsToTrades(
      [
        ["2026-03-14", "ES", "250", "Buy"],
        ["2026-03-15", "ES", "-100", "Sell"],
        ["2026-03-16", "ES", "12", "Unknown"],
      ],
      mapping,
      { required: JOURNAL_REQUIRED },
    );
    expect(result.valid.map((trade) => trade.direction)).toEqual(["long", "short"]);
    expect(result.valid.every((trade) => trade.reviewPending)).toBe(true);
    expect(result.invalid).toBe(1);
  });

  it("n'exige pas le sens pour une simulation Monte Carlo non persistée", () => {
    const result = mapRowsToTrades([["", "", "-120", ""]], mapping, { required: ["pnl"] });
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].pnl).toBe(-120);
  });
});

// `splitDuplicates` / `tradeSignature` sont retirés (lot 1). Leur règle
// « dédoublonner À L'INTÉRIEUR du fichier » était le défaut : deux trades
// réels identiques (deux scalps à +50 $ sans heure) n'en faisaient qu'un.
// Les garanties qu'ils portaient vivent dans `tests/importKey.test.ts` :
// réimporter le même fichier n'ajoute rien, un trade déjà saisi est reconnu
// (doublon probable, compté à part), deux P&L différents restent deux trades
// — et deux lignes identiques restent DEUX trades.

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

describe("provenance des lignes importées (lot 1)", () => {
  it("un horodatage ISO avec décalage est un INSTANT : conservé, et l'heure du journal suit New York", () => {
    const { valid } = mapRowsToTrades([["2026-10-21T13:30:00Z", "NQ", "long", "125.50"]], {
      date: 0,
      symbol: 1,
      direction: 2,
      pnl: 3,
    });
    expect(valid[0].entryAt).toBe("2026-10-21T13:30:00.000Z");
    expect(valid[0].entryTime).toBe("09:30");
    expect(valid[0].date).toBe("2026-10-21");
    expect(valid[0].sourceTimezone).toBe("America/New_York");
  });

  it("le décalage décide du jour de New York, pas la date UTC", () => {
    // 01:30 UTC le 22 = 21:30 à New York le 21.
    const { valid } = mapRowsToTrades([["2026-10-22T01:30:00+00:00", "NQ", "short", "-40"]], {
      date: 0,
      symbol: 1,
      direction: 2,
      pnl: 3,
    });
    expect(valid[0].date).toBe("2026-10-21");
    expect(valid[0].entryTime).toBe("21:30");
  });

  it("sans décalage, aucun instant n'est deviné", () => {
    const { valid } = mapRowsToTrades([["2026-10-21 09:30", "NQ", "long", "10"]], {
      date: 0,
      symbol: 1,
      direction: 2,
      pnl: 3,
    });
    expect(valid[0].entryAt).toBeNull();
    expect(valid[0].sourceTimezone).toBeNull();
    expect(valid[0].entryTime).toBe("09:30");
  });

  it("les frais ne sont plus rangés dans le slippage", () => {
    const headers = ["Date", "Symbol", "Side", "P&L", "Commission", "Slippage"];
    const mapping = guessMapping(headers);
    expect(mapping.fees).toBe(4);
    expect(mapping.slippage).toBe(5);
    const { valid } = mapRowsToTrades(
      [["2026-10-21", "NQ", "long", "100", "4.20", "1.5"]],
      mapping,
    );
    expect(valid[0].fees).toBe(4.2);
    expect(valid[0].slippage).toBe(1.5);
  });

  it("la colonne d'identifiant est reconnue sans happer « Side »", () => {
    const mapping = guessMapping(["Trade ID", "Date", "Symbol", "Side", "P&L"]);
    expect(mapping.tradeId).toBe(0);
    expect(mapping.direction).toBe(3);
    const out = mapRowsToTrades([["T-77", "2026-10-21", "NQ", "long", "10"]], mapping);
    expect(out.sourceIds).toEqual(["T-77"]);
  });

  it("chaque ligne refusée est rendue avec sa raison, pour la preuve d'import", () => {
    const out = mapRowsToTrades(
      [
        ["2026-10-21", "NQ", "", "10"],
        ["", "NQ", "long", "10"],
      ],
      { date: 0, symbol: 1, direction: 2, pnl: 3 },
      { required: JOURNAL_REQUIRED },
    );
    expect(out.rejected.map((r) => r.reason)).toEqual(["missing_direction", "missing_required"]);
  });

  it("source et provenance du risque sont posées, jamais inventées", () => {
    const { valid } = mapRowsToTrades(
      [
        ["2026-10-21", "NQ", "long", "100", "50"],
        ["2026-10-21", "NQ", "long", "100", ""],
      ],
      { date: 0, symbol: 1, direction: 2, pnl: 3, risk: 4 },
    );
    expect(valid.map((t) => t.source)).toEqual(["csv", "csv"]);
    expect(valid.map((t) => t.riskSource)).toEqual(["csv", null]);
  });
});
