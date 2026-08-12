import { expect, test } from "bun:test";
import { scan } from "../src/modules/patterns/scan";
import { DISMISS_DAYS } from "../src/modules/patterns/thresholds";
import type { TradeLike } from "../src/modules/patterns/detectors";

const NOW = new Date("2026-06-01T10:00:00Z");

/** Journal où le trade suivant une perte est nettement moins bon. */
function degraded(n = 200): TradeLike[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    pnl: i % 2 === 0 ? -100 : 100,
    rMultiple: i % 2 === 0 ? 1 : -2,
    mistakes: i % 2 === 0 ? ["No stop loss"] : [],
    entryTime: "09:30",
  }));
}

test("an empty journal produces nothing and claims nothing", () => {
  const out = scan({ trades: [], sessions: [], known: [], now: NOW });
  expect(out.patterns).toEqual([]);
  expect(out.suppressed).toBe(0);
  // Mais il dit ce qui manque, plutôt que de rendre un écran vide.
  expect(out.pending.length).toBeGreaterThan(0);
});

test("what is not sayable yet comes back as pending, with the shortfall", () => {
  const out = scan({ trades: degraded(12), sessions: [], known: [], now: NOW });
  expect(out.patterns).toEqual([]);
  for (const p of out.pending) {
    expect(p.missing).toBeGreaterThan(0);
    expect(["trades", "sessions"]).toContain(p.unit);
  }
});

test("a dismissed pattern does not come back inside the window", () => {
  const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const out = scan({
    trades: degraded(),
    sessions: [],
    known: [{ kind: "after_loss", clusterId: null, dismissedAt: yesterday }],
    now: NOW,
  });
  expect(out.patterns.some((p) => p.kind === "after_loss")).toBe(false);
  expect(out.suppressed).toBe(1);
});

test("it comes back once the window has passed", () => {
  const old = new Date(NOW.getTime() - (DISMISS_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
  const out = scan({
    trades: degraded(),
    sessions: [],
    known: [{ kind: "after_loss", clusterId: null, dismissedAt: old }],
    now: NOW,
  });
  expect(out.patterns.some((p) => p.kind === "after_loss")).toBe(true);
  expect(out.suppressed).toBe(0);
});

test("dismissal is scoped to the exact pattern, not to a whole family of them", () => {
  const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const out = scan({
    trades: degraded(),
    sessions: [],
    known: [{ kind: "cluster_concentration", clusterId: "exit", dismissedAt: yesterday }],
    now: NOW,
  });
  // Le motif écarté portait sur « sorties » ; celui trouvé porte sur « risque ».
  expect(out.patterns.some((p) => p.kind === "cluster_concentration")).toBe(true);
});

test("patterns are ordered by observed impact, and a null impact never jumps the queue", () => {
  const out = scan({ trades: degraded(), sessions: [], known: [], now: NOW });
  const impacts = out.patterns.map((p) => Math.abs(p.impactR ?? 0));
  expect([...impacts].sort((a, b) => b - a)).toEqual(impacts);
});

test("every published pattern carries n and comparisons", () => {
  const out = scan({ trades: degraded(), sessions: [], known: [], now: NOW });
  expect(out.patterns.length).toBeGreaterThan(0);
  for (const p of out.patterns) {
    expect(p.evidence.n).toBeGreaterThan(0);
    expect(p.evidence.comparisons).toBeGreaterThanOrEqual(1);
  }
});

test("the scan invents nothing: every published kind comes from a detector", () => {
  const out = scan({ trades: degraded(), sessions: [], known: [], now: NOW });
  const allowed = ["cluster_concentration", "after_loss", "time_of_day", "readiness_correlation"];
  for (const p of out.patterns) expect(allowed).toContain(p.kind);
});
