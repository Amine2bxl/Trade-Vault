import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";
import { emptyDay, reduceDay, type SessionDay } from "../src/app/features/checklist/sessionPlan";

/**
 * LE VERROU DU PLAN : FERME, MAIS JAMAIS UNE IMPASSE.
 *
 * ── CE QUI A CHANGÉ ─────────────────────────────────────────────────────────
 *
 * L'ancienne checklist rouvrait son verrou dès qu'on décochait une case. Le
 * plan de séance fait l'inverse, et c'est voulu : une fois verrouillé, le plan
 * ne se modifie plus au fil de l'eau. Les journaux montrent pourquoi — la perte
 * typique commence par un biais retourné EN SÉANCE, « pour voir ».
 *
 * ── LES DEUX RÈGLES QUI RESTENT ─────────────────────────────────────────────
 *
 *   1. Il existe toujours une porte de sortie SUR la page : « Changer de
 *      plan » rouvre le plan sans rien effacer — et horodate le changement.
 *   2. Rouvrir et recommencer restent deux gestes distincts : confondre les
 *      deux ferait perdre toute sa préparation pour corriger un chiffre.
 */

const SRC = stripComments(
  readSource(import.meta.dir, "../src/app/features/checklist/Checklist.tsx"),
);

const DEF = { risk: "250", maxTrades: 1 };

function liveDay(): SessionDay {
  let d = emptyDay(DEF);
  d = reduceDay(d, {
    type: "setPlan",
    patch: { bias: "short", target: "EQL", entry: "FVG", invalidation: "21 580" },
  });
  d = reduceDay(d, { type: "setMood", mood: "calm" });
  return reduceDay(d, { type: "lock", at: "09:20" });
}

describe("le plan verrouillé est gelé", () => {
  test("aucune saisie ne le modifie en séance", () => {
    const live = liveDay();
    expect(reduceDay(live, { type: "setPlan", patch: { bias: "long" } }).plan.bias).toBe("short");
  });

  test("l'écran n'écrit la journée que par le réducteur", () => {
    // Une écriture directe de `day` contournerait le gel du plan. Les seuls
    // `setSt` admis : le chargement d'une journée et `act`.
    const writes = SRC.match(/setSt\(/g) ?? [];
    expect(SRC).toContain("const next = reduceDay(cur.day, a)");
    expect(writes.length).toBeLessThanOrEqual(3);
    expect(SRC).not.toMatch(/setSt\(\s*\{\s*key:[^}]*day:\s*\{\s*\.\.\./);
  });
});

describe("la porte de sortie explicite", () => {
  test("elle rouvre sans rien effacer, et laisse une trace", () => {
    const live = liveDay();
    const reopened = reduceDay(live, { type: "reopenPlan", at: "09:52" });
    expect(reopened.locked).toBe(false);
    expect(reopened.plan).toEqual(live.plan);
    expect(reopened.planChanges).toEqual(["09:52"]);
  });

  test("elle est atteignable depuis l'écran de séance", () => {
    expect(SRC).toContain('act({ type: "reopenPlan"');
    const seance = SRC.slice(SRC.indexOf('day.phase === "live" && ('));
    expect(seance.slice(0, 4000)).toContain("chk.changePlan");
  });
});

describe("rouvrir et recommencer restent distincts", () => {
  test("recommencer vide la journée, rouvrir non", () => {
    const live = liveDay();
    const reset = reduceDay(live, { type: "reset", defaults: DEF });
    expect(reset.plan.bias).toBeNull();
    expect(reduceDay(live, { type: "reopenPlan", at: "10:00" }).plan.bias).toBe("short");
  });

  test("recommencer ne vit que dans les réglages", () => {
    const hits = SRC.match(/type: "reset"/g) ?? [];
    expect(hits.length).toBe(1);
    const i = SRC.indexOf('type: "reset"');
    expect(SRC.slice(Math.max(0, i - 200), i)).toContain("onResetDay");
  });
});
