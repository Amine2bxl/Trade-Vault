import { describe, expect, test } from "bun:test";
import {
  analyzeTradingViewOrders, decodeImportBuffer, isTradingViewOrders,
  parseCsvWithRescue, suggestedPointValue,
} from "../importRescue";

const H = ["Symbol", "Side", "Type", "Quantity", "Fill price", "Status",
  "Commission", "Closing time", "Order ID"];
const row = (
  symbol: string, side: string, qty: number, price: number,
  at: string, id: string, status = "Filled", fees = "",
) => [symbol, side, "Market", String(qty), String(price), status, fees, at, id];

describe("récupération des fichiers abîmés", () => {
  test("ne perturbe pas un CSV valide et ses champs multilignes", () => {
    const csv = 'Date,Symbol,P&L,Notes\n2026-10-01,NQ,100,"first line\nsecond line"\n';
    const result = parseCsvWithRescue(csv);
    expect(result.recovered).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][3]).toBe("first line\nsecond line");
  });

  test("sauve les lignes intactes autour d'une ligne dont les guillemets sont cassés", () => {
    const csv = 'Date,Symbol,P&L\n2026-10-01,ES,15\n"broken,ES,25\n2026-10-03,NQ,-20';
    const result = parseCsvWithRescue(csv);
    expect(result.recovered).toBe(true);
    expect(result.discarded).toBe(1);
    expect(result.rows).toEqual([
      ["2026-10-01", "ES", "15"],
      ["2026-10-03", "NQ", "-20"],
    ]);
  });

  test("ignore un en-tête publicitaire avant la vraie table", () => {
    const csv = "Broker Export\nDate,Symbol,P&L\n2026-10-01,NQ,35\n";
    const result = parseCsvWithRescue(csv);
    expect(result.headers).toEqual(["Date", "Symbol", "P&L"]);
    expect(result.rows).toHaveLength(1);
    expect(result.discarded).toBe(1);
  });

  test("lit UTF-16 LE avec BOM, sans déformer les nombres", () => {
    const original = "Date,Symbol,P&L\n2026-10-01,NQ,10";
    const data = [255, 254, ...Array.from(original).flatMap((c) => [c.charCodeAt(0), 0])];
    const decoded = decodeImportBuffer(new Uint8Array(data).buffer);
    expect(decoded.text).toBe(original);
  });

  test("ne prétend pas récupérer un fichier sans lignes lisibles", () => {
    expect(parseCsvWithRescue("%%%\n??\n")).toMatchObject({ headers: [], rows: [] });
  });
});

describe("reconstruction prudente d'un historique TradingView", () => {
  test("reconnaît les bons exports, pas un simple journal", () => {
    expect(isTradingViewOrders(H)).toBe(true);
    expect(isTradingViewOrders(["Date", "Symbol", "P&L"])).toBe(false);
  });

  test("les multiplicateurs CFD ne sont pas inventés", () => {
    expect(suggestedPointValue("CME_MINI:NQ1!")).toBe(20);
    expect(suggestedPointValue("CME_MINI:MNQ1!")).toBe(2);
    expect(suggestedPointValue("CAPITALCOM:US100")).toBeNull();
    expect(suggestedPointValue("FX:EURUSD")).toBeNull();
  });

  test("groupe un trade avec sorties partielles et ignore les annulations", () => {
    const rows = [
      row("CME_MINI:NQ1!", "Buy", 2, 100, "2026-10-01 09:30:00", "A"),
      row("CME_MINI:NQ1!", "Sell", 1, 105, "2026-10-01 09:35:00", "B"),
      row("CME_MINI:NQ1!", "Sell", 1, 110, "2026-10-01 09:40:00", "C"),
      row("CME_MINI:NQ1!", "Sell", 1, 100, "2026-10-01 09:41:00", "D", "Cancelled"),
    ];
    const result = analyzeTradingViewOrders(H, rows, { "CME_MINI:NQ1!": 20 });
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].pnl).toBe(300);
    expect(result.trades[0].direction).toBe("long");
    expect(result.trades[0].quantity).toBe(2);
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].exitPrice).toBe(107.5);
    expect(result.skipped).toBe(1);
    expect(result.trades[0].reviewPending).toBe(true);
  });

  test("ne produit pas de P&L pour un multiplicateur inconnu", () => {
    const rows = [
      row("CAPITALCOM:US100", "Buy", 1, 100, "2026-10-01 09:30:00", "A"),
      row("CAPITALCOM:US100", "Sell", 1, 105, "2026-10-01 09:40:00", "B"),
    ];
    const result = analyzeTradingViewOrders(H, rows, {});
    expect(result.trades).toHaveLength(0);
    expect(result.missingMultipliers).toEqual(["CAPITALCOM:US100"]);
  });

  test("n'applique pas une hypothèse de position préexistante sans consentement", () => {
    const rows = [row("CAPITALCOM:US100", "Buy", 10, 90, "2026-10-01 09:00:00", "O")];
    for (let i = 0; i < 3; i++) {
      rows.push(row("CAPITALCOM:US100", "Buy", 10, 100,
        "2026-10-01 10:0" + i + ":00", "B" + i));
      rows.push(row("CAPITALCOM:US100", "Sell", 10, 105,
        "2026-10-01 11:0" + i + ":00", "S" + i));
    }
    const before = analyzeTradingViewOrders(H, rows, { "CAPITALCOM:US100": 1 });
    expect(before.anchors).toHaveLength(1);
    expect(before.trades).toHaveLength(2); // cycles are shifted by the initial orphan
    const after = analyzeTradingViewOrders(H, rows, { "CAPITALCOM:US100": 1 }, ["CAPITALCOM:US100"]);
    expect(after.trades).toHaveLength(3);
    expect(after.trades.every((trade) => trade.pnl === 50)).toBe(true);
    expect(after.unmatched).toBe(1);
  });

  test("ne crée jamais de faux trade pour une position encore ouverte", () => {
    const result = analyzeTradingViewOrders(H, [
      row("CME_MINI:NQ1!", "Buy", 1, 100, "2026-10-01 09:30:00", "A"),
    ], { "CME_MINI:NQ1!": 20 });
    expect(result.trades).toHaveLength(0);
    expect(result.unmatched).toBeGreaterThan(0);
  });

  test("une commission connue diminue le P&L ; absente = estimation brute", () => {
    const rows = [
      row("CME_MINI:NQ1!", "Sell", 1, 200, "2026-10-01 09:30:00", "A", "Filled", "2.00"),
      row("CME_MINI:NQ1!", "Buy", 1, 190, "2026-10-01 09:40:00", "B", "Filled", "3.00"),
    ];
    const result = analyzeTradingViewOrders(H, rows, { "CME_MINI:NQ1!": 20 });
    expect(result.trades[0].pnl).toBe(195);
    expect(result.trades[0].fees).toBe(5);
    rows[1][6] = "";
    const without = analyzeTradingViewOrders(H, rows, { "CME_MINI:NQ1!": 20 });
    expect(without.trades[0].pnl).toBe(200);
    expect(without.trades[0].fees).toBeNull();
  });
});
