import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isEntitled } from "../src/domain/entitlement";

/**
 * Le contrat historique de `require-pro`, conservé tel quel.
 *
 * L'import vient désormais de `domain/entitlement` et non plus de
 * `backend/require-pro` : la définition a été déplacée là pour que le serveur
 * et l'application partagent le MÊME prédicat. Le déplacement a un effet de
 * bord bienvenu — `require-pro` importe `@tanstack/react-start` et le client
 * Supabase, donc ce fichier de test ne pouvait pas s'exécuter sans un
 * `node_modules` complet, et il était silencieusement compté comme « erreur
 * entre les tests » plutôt que comme un échec.
 *
 * Les scénarios d'expiration de période (crypto, comp, délai Stripe) vivent
 * dans `tests/entitlement.test.ts`.
 */

describe("require-pro", () => {
  it("denies null subscription", () => {
    expect(isEntitled(null)).toBe(false);
  });

  it("allows active subscription", () => {
    expect(isEntitled({ status: "active", trial_ends_at: null })).toBe(true);
  });

  it("denies cancelled subscription", () => {
    expect(isEntitled({ status: "canceled", trial_ends_at: null })).toBe(false);
  });

  it("allows active trial", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isEntitled({ status: "trialing", trial_ends_at: future })).toBe(true);
  });

  it("denies expired trial", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isEntitled({ status: "trialing", trial_ends_at: past })).toBe(false);
  });
});

/**
 * Le middleware lui-même ne peut pas être exécuté ici (il lui faudrait un
 * runtime TanStack Start et une base). Ce qui est vérifié, ce sont ses
 * INVARIANTS de source : ceux dont la violation ne casserait aucun autre test.
 */
const REQUIRE_PRO = readFileSync(resolve(import.meta.dir, "../src/backend/require-pro.ts"), "utf8");

describe("require-pro — invariants de la garde serveur", () => {
  it("lit les colonnes dont dépend l'expiration de période", () => {
    // Sans `source` ni `current_period_end`, `isEntitled` ne peut PAS voir
    // qu'une période est écoulée : la requête doit les demander.
    expect(REQUIRE_PRO).toContain("current_period_end");
    expect(REQUIRE_PRO).toContain("source");
  });

  it("délègue la décision au module partagé plutôt que de la recalculer", () => {
    expect(REQUIRE_PRO).toContain('from "@/domain/entitlement"');
    // Aucune redéfinition locale : une seconde définition rouvrirait la
    // divergence que ce module vient de fermer.
    expect(REQUIRE_PRO).not.toMatch(/function isEntitled\s*\(/);
  });

  it("échoue FERMÉ quand la base est illisible", () => {
    // `error || !isEntitled(data)` — l'erreur de lecture doit refuser l'accès,
    // jamais l'accorder. Un paywall qui s'ouvre pendant une panne n'est pas un
    // paywall.
    expect(REQUIRE_PRO).toContain(
      "if (rowError || !isEntitled(row)) throw new ProRequiredError();",
    );
  });
});
