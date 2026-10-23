import { expect, test } from "bun:test";
import { readStrategyCsv } from "../src/app/features/monte-carlo/strategyCsv";

test("le laboratoire accepte des R seuls sans inventer du P&L ni des lignes", () => {
  const m = readStrategyCsv("R Multiple\n-1\n2\n0\n-0.5\n3\ninvalid\n1");
  expect(m.sampleSize).toBe(6);
  expect(m.estimated).toBe(0);
  expect(m.excluded).toBe(1);
  expect(m.values).toEqual([-1, 2, 0, -0.5, 3, 1]);
});
test("P&L seul : échelle estimée signalée et lignes illisibles comptées", () => {
  const m = readStrategyCsv("P&L\n-100\n200\n0\n-100\n300\n-50\ninvalid");
  expect(m.sampleSize).toBe(6);
  expect(m.estimated).toBe(5);
  expect(m.excluded).toBe(1);
});
test("ni une colonne inconnue ni des valeurs manquantes ne deviennent une stratégie plate", () => {
  expect(() => readStrategyCsv("Result\n1\n2")).toThrow();
  expect(() => readStrategyCsv("R Multiple\n\n\n")).toThrow();
});
test("sans R ou risque ni aucune perte, aucune unité de risque n'est inventée", () => {
  expect(() => readStrategyCsv("P&L\n100\n200\n300\n400\n500")).toThrow("TOO_FEW");
});
