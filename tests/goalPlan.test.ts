import { expect, test } from "bun:test";
import { tasksForMonth, monthTaskCompletion, type GoalPlan } from "../src/app/utils/goalPlan";

const plan: GoalPlan = {
  goals: [{ id: "g1", kind: "capital", startValue: 10000, targetValue: 20000 }],
  startedAt: "2025-01-01",
  horizonMonths: 6,
  tasksDone: {},
};

const topMistake = { name: "revenge trade", totalPnl: -640, count: 5 };

test("the shared task targets the trader's real #1 recurring mistake", () => {
  const tasks = tasksForMonth(plan, 0, "en", { topMistake });
  const shared = tasks.find((t) => t.key === "0:generic:0");
  expect(shared).toBeDefined();
  // Grounded in real data: cites the mistake name, its cost and count.
  expect(`${shared!.title} ${shared!.desc}`).toContain("revenge trade");
  expect(shared!.desc).toContain("640");
  expect(shared!.desc).toContain("5");
});

test("the leak campaign is progressive — a different action every month", () => {
  const titles = Array.from(
    { length: 6 },
    (_, i) =>
      tasksForMonth(plan, i, "en", { topMistake }).find((t) => t.key === `${i}:generic:0`)!.title,
  );
  expect(new Set(titles).size).toBe(6);
});

test("personalization never changes task count or keys (no completion drift)", () => {
  for (let i = 0; i < 6; i++) {
    const generic = tasksForMonth(plan, i, "en");
    const personal = tasksForMonth(plan, i, "en", { topMistake });
    expect(personal.length).toBe(generic.length);
    expect(personal.map((t) => t.key)).toEqual(generic.map((t) => t.key));
  }
  // monthTaskCompletion (which recomputes without personalization) stays valid.
  expect(monthTaskCompletion(plan, 0)).toBe(0);
});

test("falls back to the generic task when there is no logged mistake", () => {
  const a = tasksForMonth(plan, 0, "en");
  const b = tasksForMonth(plan, 0, "en", {});
  const sharedA = a.find((t) => t.key === "0:generic:0")!;
  const sharedB = b.find((t) => t.key === "0:generic:0")!;
  expect(sharedA.title).toBe(sharedB.title);
  // A positive-PnL "mistake" is not a leak — no campaign.
  const c = tasksForMonth(plan, 0, "en", {
    topMistake: { name: "won anyway", totalPnl: 120, count: 2 },
  });
  expect(c.find((t) => t.key === "0:generic:0")!.title).toBe(sharedA.title);
});
