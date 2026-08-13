import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Le chemin d'acceptation est un `createServerFn` : l'exécuter ici demanderait
 * un runtime TanStack Start et une base. Ce que ce test protège, ce sont les
 * INVARIANTS du fichier — ceux dont la violation ne casserait aucun autre test
 * et passerait inaperçue en revue.
 *
 * Ce n'est pas un test d'intégration et il ne prétend pas l'être : les
 * garanties d'exécution (RLS, trigger de budget, contrainte `evidence`) sont
 * portées par la base, et c'est la branche de préversion Supabase qui les
 * vérifie.
 */

const SOURCE = readFileSync(
  resolve(import.meta.dir, "../src/backend/proposals.functions.ts"),
  "utf8",
);

test("the payload is re-validated at acceptance, not trusted from the row", () => {
  // Un payload écrit hier n'a aucune autorité sur ce qu'on crée aujourd'hui :
  // le schéma a pu se resserrer entre-temps.
  expect(SOURCE).toContain("validateProposal({");
});

test("a rejected proposal creates nothing and is logged", () => {
  const rejectBlock = SOURCE.slice(SOURCE.indexOf("if (!check.ok)"));
  expect(rejectBlock).toContain("console.error");
  // Le retour d'échec précède toute création.
  expect(rejectBlock.indexOf("return { ok: false")).toBeLessThan(
    rejectBlock.indexOf("applyAction"),
  );
});

test("acceptance writes applied_ref pointing at the object it created", () => {
  expect(SOURCE).toContain("applied_ref: appliedRef");
  // L'identifiant est préfixé par son type : « Jarvis a créé ceci » doit
  // pouvoir être suivi jusqu'à l'objet.
  expect(SOURCE).toContain("`trading_rule:${id}`");
  expect(SOURCE).toContain("`checklist_item:${id}`");
});

test("an expired proposal is never applied", () => {
  const idx = SOURCE.indexOf("expires_at");
  expect(idx).toBeGreaterThan(0);
  expect(SOURCE).toContain('status: "expired"');
  // Le contrôle d'expiration passe AVANT la validation et la création.
  expect(SOURCE.indexOf("new Date(proposal.expires_at)")).toBeLessThan(
    SOURCE.indexOf("applyAction(sb"),
  );
});

test("only a pending proposal can be accepted", () => {
  expect(SOURCE).toContain('proposal.status !== "pending"');
});

test("unsupported action types return null rather than pretending to create", () => {
  const apply = SOURCE.slice(
    SOURCE.indexOf("async function applyAction"),
    SOURCE.indexOf("Passe les propositions échues"),
  );
  // Les deux seuls types implémentés, puis un refus franc pour le reste.
  expect(apply).toContain('actionType === "create_rule"');
  expect(apply).toContain('actionType === "add_checklist_item"');
  expect(apply.lastIndexOf("return null;")).toBeGreaterThan(apply.lastIndexOf("return `"));
});

test("the accept path is the only place that writes user objects", () => {
  // Aucun autre appel d'écriture ne doit exister dans ce fichier en dehors de
  // `applyAction` et de la mise à jour de la proposition elle-même.
  const updates = [...SOURCE.matchAll(/\.update\(/g)].length;
  expect(updates).toBe(5); // expired, accepted, rules, checklist, expiry sweep
});
