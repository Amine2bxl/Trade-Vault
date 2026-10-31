import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";
import {
  CHANGE_COOLDOWN_S,
  emptyDay,
  MIN_CHANGE_REASON,
  reduceDay,
  type SessionDay,
} from "../src/app/features/checklist/sessionPlan";

/**
 * LE VERROU DU PLAN : FERME, COÛTEUX À FORCER, MAIS JAMAIS UNE IMPASSE.
 *
 * ── CE QUI A CHANGÉ ─────────────────────────────────────────────────────────
 *
 * L'ancienne checklist rouvrait son verrou dès qu'on décochait une case. Le
 * plan de séance fait l'inverse, et c'est voulu : une fois verrouillé, le plan
 * ne se modifie plus au fil de l'eau. Les journaux montrent pourquoi — la perte
 * typique commence par un biais retourné EN SÉANCE, « pour voir ».
 *
 * ── LES RÈGLES ──────────────────────────────────────────────────────────────
 *
 *   1. Il existe toujours une porte de sortie SUR l'écran de séance :
 *      « Changer de plan » rouvre le plan sans rien effacer.
 *   2. Elle coûte : un motif écrit, puis une attente, avant de pouvoir
 *      confirmer. Le motif est gardé et relu au bilan.
 *   3. Rouvrir et recommencer restent deux gestes distincts : confondre les
 *      deux ferait perdre toute sa préparation pour corriger un chiffre.
 */

const PAGE = stripComments(
  readSource(import.meta.dir, "../src/app/features/checklist/Checklist.tsx"),
);
const LIVE = stripComments(
  readSource(import.meta.dir, "../src/app/features/checklist/LiveCard.tsx"),
);

const DEF = { risk: "250", maxTrades: 1 };
const REASON = "Clôture M15 au-dessus de l'invalidation";

function liveDay(): SessionDay {
  let d = emptyDay(DEF);
  d = reduceDay(d, {
    type: "setPlan",
    patch: {
      bias: "short",
      narrative: "DoL sell-side",
      target: "EQL",
      entry: "FVG",
      invalidation: "21 580",
    },
  });
  d = reduceDay(d, { type: "setMood", mood: "calm" });
  return reduceDay(d, { type: "lock", at: "09:20" });
}

describe("le plan verrouillé est gelé", () => {
  test("aucune saisie ne le modifie en séance", () => {
    const live = liveDay();
    expect(live.phase).toBe("live");
    expect(reduceDay(live, { type: "setPlan", patch: { bias: "long" } }).plan.bias).toBe("short");
  });

  test("l'écran n'écrit la journée que par le réducteur", () => {
    // Une écriture directe de `day` contournerait le gel du plan. Les seuls
    // `setSt` admis : le chargement d'une journée et `act`.
    const writes = PAGE.match(/setSt\(/g) ?? [];
    expect(PAGE).toContain("const next = reduceDay(cur.day, a)");
    expect(writes.length).toBeLessThanOrEqual(3);
    expect(PAGE).not.toMatch(/setSt\(\s*\{\s*key:[^}]*day:\s*\{\s*\.\.\./);
  });
});

describe("la porte de sortie explicite", () => {
  test("sans motif, elle reste fermée", () => {
    const live = liveDay();
    expect(reduceDay(live, { type: "reopenPlan", at: "09:52", reason: "parce que" })).toBe(live);
  });

  test("avec motif, elle rouvre sans rien effacer, et laisse une trace", () => {
    const live = liveDay();
    const reopened = reduceDay(live, { type: "reopenPlan", at: "09:52", reason: REASON });
    expect(reopened.locked).toBe(false);
    expect(reopened.plan).toEqual(live.plan);
    expect(reopened.planChanges).toEqual([{ at: "09:52", reason: REASON }]);
  });

  test("elle est atteignable depuis l'écran de séance, et branchée sur le réducteur", () => {
    expect(PAGE).toContain('act({ type: "reopenPlan"');
    expect(PAGE).toContain("onChangePlan={changePlan}");
    expect(LIVE).toContain("<ChangePlanPanel");
    expect(LIVE).toContain("chk.changePlan");
  });

  test("le bouton de confirmation attend le motif ET la fin du délai", () => {
    expect(MIN_CHANGE_REASON).toBeGreaterThanOrEqual(10);
    expect(CHANGE_COOLDOWN_S).toBeGreaterThanOrEqual(10);
    expect(LIVE).toContain("MIN_CHANGE_REASON - reason.trim().length");
    expect(LIVE).toContain("const ready = short <= 0 && left <= 0");
    expect(LIVE).toContain("disabled={!ready}");
  });
});

describe("rouvrir et recommencer restent distincts", () => {
  test("recommencer vide la journée, rouvrir non", () => {
    const live = liveDay();
    const reset = reduceDay(live, { type: "reset", defaults: DEF });
    expect(reset.plan.bias).toBeNull();
    expect(reduceDay(live, { type: "reopenPlan", at: "10:00", reason: REASON }).plan.bias).toBe(
      "short",
    );
  });

  test("recommencer ne vit que dans les réglages", () => {
    const hits = PAGE.match(/type: "reset"/g) ?? [];
    expect(hits.length).toBe(1);
    const i = PAGE.indexOf('type: "reset"');
    expect(PAGE.slice(Math.max(0, i - 200), i)).toContain("onResetDay");
  });
});
