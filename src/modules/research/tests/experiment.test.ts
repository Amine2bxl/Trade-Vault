import { describe, expect, test } from "bun:test";
import { draftExperiment, evaluateExperiment, type ScenarioTrade } from "../index";

/** Expérience de progression : protocole figé, respect vérifiable, aucun effet affirmé. */

let seq = 0;
const t = (date: string, pnl: number, entry: string, exit: string): ScenarioTrade => ({
  id: `x${++seq}`,
  date,
  pnl,
  entryTime: entry,
  exitTime: exit,
  accountId: "acc",
});

/** Une séance : deux pertes, puis (ou non) un trade de plus après la seconde. */
function session(date: string, continued: boolean, extraPnl = 50): ScenarioTrade[] {
  const s = [t(date, -100, "09:30", "09:40"), t(date, -100, "09:45", "09:50")];
  if (continued) s.push(t(date, extraPnl, "10:00", "10:10"));
  return s;
}

describe("expérience « pause après N pertes »", () => {
  const p = draftExperiment({ maxLosses: 2, targetSessions: 5 }, "2026-11-02");

  test("le protocole est borné et daté du jour — jamais dans le passé", () => {
    expect(p).toMatchObject({ rule: "stop_after_losses", maxLosses: 2, targetSessions: 5 });
    expect(p.startDay).toBe("2026-11-02");
    expect(draftExperiment({ maxLosses: 9, targetSessions: 999 }, "2026-11-02")).toMatchObject({
      maxLosses: 5,
      targetSessions: 60,
    });
  });

  test("le respect se compte séance par séance ; avant le début, c'est la base", () => {
    const trades = [
      ...session("2026-10-28", true, -80),
      ...session("2026-10-29", true, -80),
      ...session("2026-11-02", false),
      ...session("2026-11-03", false),
      ...session("2026-11-04", true),
      // Une séance où la règle n'est pas éprouvée (une seule perte).
      t("2026-11-05", -100, "09:30", "09:40"),
      t("2026-11-05", 200, "09:45", "09:55"),
    ];
    const r = evaluateExperiment(p, trades);
    expect(r).toMatchObject({
      status: "running",
      sessionsObserved: 4,
      complied: 2,
      violated: 1,
      notTriggered: 1,
      unknown: 0,
    });
    expect(r.complianceRate).toBeCloseTo(2 / 3, 10);
    expect(r.baselineSessions).toBe(2);
    expect(r.baselineAvgSessionPnl).toBe(-280);
    // Jamais d'effet affirmé ; quelques séances n'ont aucune puissance.
    expect(r.causalClaim).toBe(false);
    expect(r.lowPower).toBe(true);
  });

  test("une séance à l'ordre non prouvé n'est JAMAIS comptée comme respectée", () => {
    const trades = [
      t("2026-11-02", -100, "09:30", "09:40"),
      t("2026-11-02", -100, "09:31", "09:40"),
    ];
    const r = evaluateExperiment(p, trades);
    expect(r.unknown).toBe(1);
    expect(r.complied).toBe(0);
    expect(r.complianceRate).toBeNull();
    expect(r.avgSessionPnl).toBeNull();
  });

  test("l'expérience se clôt au nombre de séances visé, pas avant", () => {
    const days = [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-09",
    ];
    const r = evaluateExperiment(
      p,
      days.flatMap((d) => session(d, false)),
    );
    expect(r.status).toBe("complete");
    expect(r.sessionsObserved).toBe(5);
  });
});
