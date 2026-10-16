import { describe, it, expect } from "bun:test";
import {
  alreadyCopiedIds,
  copiedScreenshotPath,
  defaultTransferFactor,
  planTransfer,
  sanitizeFactor,
  summarizeTransfer,
  tradesInRange,
  type TransferOptions,
} from "../tradeTransfer";
import type { Trade } from "@/app/types";

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: "t1",
    date: "2026-03-14",
    symbol: "NQ",
    direction: "long",
    pnl: 500,
    riskAmount: 250,
    rMultiple: 2,
    strategy: "Breakout",
    mistakes: ["FOMO entry"],
    setupQuality: 4,
    notes: "propre",
    screenshots: ["u1/a.png"],
    entryTime: "09:35",
    exitTime: "10:02",
    confluences: ["FVG"],
    confidence: 70,
    mae: -100,
    mfe: 600,
    slippage: -5,
    accountId: "sub-25k",
    quantity: 2,
    entryPrice: 18000.25,
    exitPrice: 18012.75,
    fees: 4.2,
    ...over,
  };
}

const base: TransferOptions = {
  mode: "copy",
  targetAccountId: "main-50k",
  factor: 2,
  from: null,
  to: null,
  skipAlreadyCopied: true,
};

let n = 0;
const newId = () => `new-${++n}`;

describe("le facteur par défaut — le rapport des capitaux", () => {
  it("25k vers 50k double, 50k vers 25k divise par deux", () => {
    expect(defaultTransferFactor(25_000, 50_000)).toBe(2);
    expect(defaultTransferFactor(50_000, 25_000)).toBe(0.5);
  });
  it("un capital nul ou absurde n'applique rien", () => {
    expect(defaultTransferFactor(0, 50_000)).toBe(1);
    expect(sanitizeFactor(Number.NaN)).toBe(1);
    expect(sanitizeFactor(-3)).toBe(1);
    expect(sanitizeFactor(1.5)).toBe(1.5);
  });
});

describe("la période — bornes incluses", () => {
  const list = [
    trade({ id: "a", date: "2026-03-01" }),
    trade({ id: "b", date: "2026-03-15" }),
    trade({ id: "c", date: "2026-03-31" }),
  ];
  it("garde les deux bornes", () => {
    expect(tradesInRange(list, "2026-03-01", "2026-03-15").map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("une borne absente ne filtre pas ce côté", () => {
    expect(tradesInRange(list, null, "2026-03-14").map((t) => t.id)).toEqual(["a"]);
    expect(tradesInRange(list, "2026-03-16", null).map((t) => t.id)).toEqual(["c"]);
    expect(tradesInRange(list, null, null)).toHaveLength(3);
  });
});

describe("copier", () => {
  it("crée une copie COMPLÈTE dans le compte cible, à la nouvelle échelle", () => {
    const { trades, idMap } = planTransfer([trade()], base, new Set(), newId);
    const [c] = trades;
    expect(c.id).not.toBe("t1");
    expect(idMap.get("t1")).toBe(c.id);
    expect(c.accountId).toBe("main-50k");
    expect(c.copiedFrom).toBe("t1");
    // L'argent double…
    expect(c.pnl).toBe(1000);
    expect(c.riskAmount).toBe(500);
    expect(c.mae).toBe(-200);
    expect(c.mfe).toBe(1200);
    expect(c.slippage).toBe(-10);
    expect(c.fees).toBe(8.4);
    // …le reste est un fait de marché ou de comportement : intact.
    expect(c.rMultiple).toBe(2);
    expect(c.quantity).toBe(2);
    expect(c.entryPrice).toBe(18000.25);
    expect(c.exitPrice).toBe(18012.75);
    expect(c.strategy).toBe("Breakout");
    expect(c.mistakes).toEqual(["FOMO entry"]);
    expect(c.confluences).toEqual(["FVG"]);
    expect(c.notes).toBe("propre");
    expect(c.screenshots).toEqual(["u1/a.png"]);
  });

  it("ne réutilise jamais la clé de déduplication broker de l'original", () => {
    const original = trade({ broker: "tradovate", externalId: "tv:1:2", reviewPending: true });
    const [c] = planTransfer([original], base, new Set(), newId).trades;
    expect(c.externalId).toBeNull();
    expect(c.reviewPending).toBe(false);
    expect(c.broker).toBe("tradovate");
  });

  it("rejouer le même transfert n'en duplique pas deux fois", () => {
    const existing = alreadyCopiedIds([trade({ id: "copy-1", copiedFrom: "t1" })]);
    const res = planTransfer([trade(), trade({ id: "t2" })], base, existing, newId);
    expect(res.trades.map((t) => t.copiedFrom)).toEqual(["t2"]);
    expect(res.skipped).toBe(1);
  });

  it("sans la garde, la copie est refaite à la demande", () => {
    const existing = alreadyCopiedIds([trade({ id: "copy-1", copiedFrom: "t1" })]);
    const res = planTransfer([trade()], { ...base, skipAlreadyCopied: false }, existing, newId);
    expect(res.trades).toHaveLength(1);
    expect(res.skipped).toBe(0);
  });
});

describe("déplacer", () => {
  it("garde l'identifiant et change seulement de compte (et d'échelle si demandé)", () => {
    const { trades, idMap } = planTransfer([trade()], { ...base, mode: "move" }, new Set(), newId);
    expect(trades[0].id).toBe("t1");
    expect(trades[0].accountId).toBe("main-50k");
    expect(trades[0].pnl).toBe(1000);
    expect(idMap.size).toBe(0);
  });

  it("à l'échelle 1, rien n'est converti", () => {
    const { trades } = planTransfer(
      [trade()],
      { ...base, mode: "move", factor: 1 },
      new Set(),
      newId,
    );
    expect(trades[0].pnl).toBe(500);
    expect(trades[0].fees).toBe(4.2);
  });
});

describe("l'aperçu", () => {
  it("compte, borne et convertit comme le transfert", () => {
    const list = [
      trade({ id: "a", date: "2026-03-01", pnl: 100, screenshots: [] }),
      trade({ id: "b", date: "2026-03-10", pnl: -40 }),
      trade({ id: "c", date: "2026-04-02", pnl: 75 }),
    ];
    const s = summarizeTransfer(list, { from: "2026-03-01", to: "2026-03-31", factor: 2 });
    expect(s.count).toBe(2);
    expect(s.pnlBefore).toBe(60);
    expect(s.pnlAfter).toBe(120);
    expect(s.screenshots).toBe(1);
    expect(s.firstDate).toBe("2026-03-01");
    expect(s.lastDate).toBe("2026-03-10");
  });
});

describe("les captures copiées", () => {
  it("vivent dans le dossier de l'utilisateur, sous un nom NEUF, avec la même extension", () => {
    const p = copiedScreenshotPath("u1", "u1/1700-abc.JPG", "1800-xyz");
    expect(p).toBe("u1/1800-xyz.jpg");
    expect(p).not.toBe("u1/1700-abc.JPG");
  });
  it("une capture sans extension devient un png", () => {
    expect(copiedScreenshotPath("u1", "u1/sans-extension", "n")).toBe("u1/n.png");
  });
});
