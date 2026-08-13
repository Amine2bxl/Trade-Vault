import { expect, test } from "bun:test";
import {
  PROPOSAL_PAYLOAD_SCHEMAS,
  isProposalActionType,
  validateProposal,
} from "../src/modules/patterns/proposalSchemas";

const RATIONALE = "Sur 32 trades perdants, la famille risque represente 41% (n=32, 4 familles).";

test("a well-formed proposal passes and comes back cleaned by zod", () => {
  const out = validateProposal({
    actionType: "create_rule",
    payload: {
      text: "  Pas plus de 3 trades par jour  ",
      metric: "max_trades_per_day",
      threshold: 3,
    },
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(true);
  // La valeur rendue est celle de zod, pas l'objet brut du modele.
  expect((out.value as { text: string }).text).toBe("Pas plus de 3 trades par jour");
});

test("an unknown action type creates nothing", () => {
  const out = validateProposal({
    actionType: "delete_all_trades",
    payload: {},
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(false);
  expect(out.reason).toContain("unknown action_type");
});

test("a payload with the wrong shape is rejected and the reason names the field", () => {
  const out = validateProposal({
    actionType: "create_goal",
    payload: { text: "Objectif", deadline: "next friday" },
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(false);
  expect(out.reason).toContain("deadline");
});

test("extra keys the model invented do not survive", () => {
  const out = validateProposal({
    actionType: "add_note",
    payload: { text: "Note utile", sqlToRun: "drop table trades" },
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(true);
  expect(out.value).toEqual({ text: "Note utile" });
});

test("a rationale that promises a cause is refused on the write path", () => {
  // Le test statique sur les locales ne verra jamais cette chaine : elle est
  // ecrite a l'execution. C'est ce controle-ci, et lui seul, qui l'arrete.
  const out = validateProposal({
    actionType: "create_rule",
    payload: { text: "Checklist avant chaque trade", metric: "none" },
    rationale: "Ta preparation ameliore ton expectancy, donc impose-toi la checklist.",
  });
  expect(out.ok).toBe(false);
  expect(out.reason).toContain("causal wording");
});

test("a missing or trivial rationale is refused", () => {
  expect(
    validateProposal({ actionType: "add_tag", payload: { tag: "revenge" }, rationale: "" }).ok,
  ).toBe(false);
  expect(
    validateProposal({ actionType: "add_tag", payload: { tag: "revenge" }, rationale: "ok" }).ok,
  ).toBe(false);
});

test("unbounded text cannot get through", () => {
  const out = validateProposal({
    actionType: "add_note",
    payload: { text: "x".repeat(5000) },
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(false);
});

test("a tag carrying markup is refused", () => {
  const out = validateProposal({
    actionType: "add_tag",
    payload: { tag: "<img src=x onerror=1>" },
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(false);
});

test("every action type declared in the schema map is recognised", () => {
  for (const key of Object.keys(PROPOSAL_PAYLOAD_SCHEMAS)) {
    expect(isProposalActionType(key)).toBe(true);
  }
  expect(isProposalActionType("create_rule ")).toBe(false);
});

test("a mission cannot smuggle in fifty steps", () => {
  const out = validateProposal({
    actionType: "create_mission",
    payload: { title: "Semaine disciplinee", items: Array.from({ length: 50 }, () => "item") },
    rationale: RATIONALE,
  });
  expect(out.ok).toBe(false);
});
