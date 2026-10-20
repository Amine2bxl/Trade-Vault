import { describe, expect, test } from "bun:test";
import {
  JARVIS_MODES,
  MODE_LOOK,
  canvasDpr,
  easeInOut,
  mixColor,
  particleBudget,
  type DeviceProfile,
} from "../src/shared/ui/neural/modes";
import { buildLinks, buildParticles } from "../src/shared/ui/neural/engine";
import { POINT_VERTEX, LINE_VERTEX } from "../src/shared/ui/neural/shaders";
import { jarvisMode, thinkingPhase, MODE_LABEL } from "../src/app/features/jarvis/neuralMode";
import { en } from "../src/app/i18n/translations";
import fr from "../src/app/i18n/locales/fr";

/**
 * LE CŒUR NEURONAL — huit modes, un budget qui ne fait jamais ramer, et un
 * mode toujours juste par rapport à ce que fait Jarvis.
 */

const desktop: DeviceProfile = { cores: 8, memoryGb: 8, coarse: false, saveData: false };
const phone: DeviceProfile = { cores: 6, memoryGb: 4, coarse: true, saveData: false };
const weak: DeviceProfile = { cores: 4, memoryGb: 2, coarse: true, saveData: true };

describe("les modes", () => {
  test("huit modes, chacun avec sa forme (index unique), ses couleurs et sa cadence", () => {
    expect(JARVIS_MODES.length).toBe(8);
    const indexes = JARVIS_MODES.map((m) => MODE_LOOK[m].index);
    expect(new Set(indexes).size).toBe(8);
    for (const m of JARVIS_MODES) {
      expect(MODE_LOOK[m].fps === 30 || MODE_LOOK[m].fps === 60).toBe(true);
      expect(MODE_LOOK[m].colorA).toHaveLength(3);
    }
    // Respirer est lent : pas besoin de la pleine cadence.
    expect(MODE_LOOK.breathing.fps).toBe(30);
  });

  test("chaque mode a son libellé, en anglais et en français", () => {
    for (const m of JARVIS_MODES) {
      expect((en[MODE_LABEL[m]] ?? "").length).toBeGreaterThan(0);
      expect((fr[MODE_LABEL[m]] ?? "").length).toBeGreaterThan(0);
    }
  });

  test("le shader connaît les huit formes", () => {
    // Sept seuils séparent huit formes : m < 0.5 … m < 6.5, puis la dernière.
    for (let i = 0; i < 7; i++) expect(POINT_VERTEX).toContain(`m < ${i}.5`);
    expect(LINE_VERTEX).toContain("morph(aSeedB");
  });
});

describe("le budget — jamais assez pour ramer", () => {
  test("la densité suit la surface affichée", () => {
    expect(particleBudget(36, desktop)).toBe(400);
    expect(particleBudget(200, desktop)).toBeGreaterThan(3_000);
    expect(particleBudget(380, desktop)).toBeGreaterThan(particleBudget(200, desktop));
  });

  test("plafonnée par l'appareil : un téléphone, un appareil faible, l'économie de données", () => {
    expect(particleBudget(380, desktop)).toBeLessThanOrEqual(14_000);
    expect(particleBudget(380, phone)).toBeLessThanOrEqual(6_000);
    expect(particleBudget(380, weak)).toBeLessThanOrEqual(3_000);
  });

  test("la densité de pixels ne dépasse jamais 2 (1,5 sur appareil faible)", () => {
    expect(canvasDpr(3, desktop)).toBe(2);
    expect(canvasDpr(3, weak)).toBe(1.5);
    expect(canvasDpr(Number.NaN, desktop)).toBe(1);
  });
});

describe("les particules et les liaisons", () => {
  test("graines stables d'une visite à l'autre, noyau entrelacé (1 sur 9)", () => {
    const a = buildParticles(900);
    const b = buildParticles(900);
    expect(Array.from(a.seeds.slice(0, 16))).toEqual(Array.from(b.seeds.slice(0, 16)));
    const cores = Array.from(a.kinds).filter((k) => k === 1).length;
    expect(cores).toBe(100);
    // Un tirage réduit garde la proportion : le moteur dégradé reste beau.
    expect(Array.from(a.kinds.slice(0, 90)).filter((k) => k === 1).length).toBe(10);
  });

  test("liaisons : paires uniques entre particules d'enveloppe, bornées", () => {
    const { seeds } = buildParticles(3_000);
    const links = buildLinks(seeds, 3_000);
    expect(links.length % 2).toBe(0);
    const seen = new Set<string>();
    for (let i = 0; i < links.length; i += 2) {
      const [a, b] = [links[i], links[i + 1]];
      expect(a).not.toBe(b);
      expect(a % 9).not.toBe(0);
      expect(b % 9).not.toBe(0);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(links.length / 2).toBeLessThanOrEqual(260 * 3);
  });
});

describe("les transitions", () => {
  test("courbe douce, bornée, sans dépassement", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });

  test("les teintes se mélangent", () => {
    expect(mixColor([0, 0, 0], [1, 1, 1], 0.5)).toEqual([0.5, 0.5, 0.5]);
    expect(mixColor([0, 0, 0], [1, 1, 1], 3)).toEqual([1, 1, 1]);
  });
});

describe("le mode affiché suit ce que fait Jarvis", () => {
  const idle = { speaking: false, writing: false, loading: false, loadingMs: 0, listening: false };

  test("au repos il respire, micro ouvert il écoute", () => {
    expect(jarvisMode(idle)).toBe("breathing");
    expect(jarvisMode({ ...idle, listening: true })).toBe("listening");
  });

  test("la réflexion passe par comprendre, analyser, réfléchir, réviser", () => {
    expect(thinkingPhase(300)).toBe("understanding");
    expect(thinkingPhase(2_000)).toBe("analyzing");
    expect(thinkingPhase(8_000)).toBe("thinking");
    expect(thinkingPhase(12_000)).toBe("revising");
    expect(thinkingPhase(16_000)).toBe("thinking");
    expect(jarvisMode({ ...idle, loading: true, loadingMs: 2_000 })).toBe("analyzing");
  });

  test("la voix prime sur l'écriture, l'écriture sur la réflexion", () => {
    expect(jarvisMode({ ...idle, writing: true, loading: true })).toBe("writing");
    expect(jarvisMode({ ...idle, speaking: true, writing: true })).toBe("speaking");
  });
});
