import { expect, test } from "bun:test";
import { generateChecklist } from "../src/app/pages/checklistDefaults";

test("generates a short, capped list (<=6 items)", () => {
  const r = generateChecklist(
    {
      style: "swing",
      pain: "risk",
      experience: "funded",
      goal: "prop_challenge",
      assets: ["forex"],
      usesIct: true,
    },
    "en",
  );
  expect(r.items.length).toBeGreaterThan(0);
  expect(r.items.length).toBeLessThanOrEqual(6);
  // no duplicate titles
  const titles = r.items.map((i) => i.title);
  expect(new Set(titles).size).toBe(titles.length);
});

test("forex market anchors the London session", () => {
  const r = generateChecklist({ assets: ["forex"] }, "en");
  expect(r.startTime).toBe("08:00");
  expect(r.timeZone).toBe("Europe/London");
});

test("overtrading pain injects a hard one-trade rule", () => {
  const r = generateChecklist({ pain: "overtrading" }, "en");
  expect(r.items.some((i) => /max 1 trade/i.test(i.title))).toBe(true);
});

test("ICT profile yields an ICT setup item; non-ICT yields a plan item", () => {
  const ict = generateChecklist({ usesIct: true }, "en");
  expect(ict.items.some((i) => /ICT setup/i.test(i.title))).toBe(true);
  const plan = generateChecklist({ usesIct: false }, "en");
  expect(plan.items.some((i) => /exact setup/i.test(i.title))).toBe(true);
});

test("localizes to French", () => {
  const r = generateChecklist({ pain: "emotions" }, "fr");
  expect(r.items[0].title.length).toBeGreaterThan(0);
  expect(r.items.some((i) => /prouver/i.test(i.title))).toBe(true);
});
