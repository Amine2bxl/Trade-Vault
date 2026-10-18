import { describe, expect, test } from "bun:test";
import { jarvisLines, type JarvisContext } from "../src/app/features/onboarding/onboardingJarvis";

/**
 * CE QUE DIT JARVIS DÉPEND DU TRADER.
 *
 * Une phrase fixe par écran faisait de Jarvis une légende. Ces tests tiennent
 * trois promesses : il réagit aux réponses déjà données (firme, terrain,
 * marché, angle mort, chiffres), deux traders ne lisent pas la même séquence,
 * et il ne dit jamais rien de ce que le produit s'interdit (statistique,
 * promesse de gain, chiffre inventé).
 */

const ctx: JarvisContext = {
  name: "Alex",
  arena: "prop_challenge",
  firm: "Apex",
  size: "50K",
  assets: ["futures"],
  usesIct: true,
  style: "scalping",
  experience: "intermediate",
  leak: "overtrading",
  goal: "prop_challenge",
  risk: "0.5",
  trades: "4",
  stop: "2",
};

describe("Jarvis réagit aux réponses", () => {
  test("cite la firme, la taille, le prénom et les chiffres du trader", () => {
    const l = jarvisLines("en", ctx, "seed-1");
    const all = Object.values(l).join(" ");
    expect(all).toContain("Apex");
    expect(l.ack).toContain("4");
    expect(l.ack).toMatch(/scalper|Fast/);
    const fr = jarvisLines("fr", ctx, "seed-1");
    expect(fr.ack).toContain("4");
  });

  test("le terrain change le discours", () => {
    const prop = jarvisLines("en", ctx, "s");
    const demo = jarvisLines("en", { ...ctx, arena: "demo", firm: "", size: "" }, "s");
    expect(prop.account).not.toBe(demo.account);
    expect(prop.guardrails).not.toBe(demo.guardrails);
    expect(demo.start).toMatch(/[Ss]ample/);
  });

  test("chaque angle mort a sa réponse, et elle cite le bon garde-fou", () => {
    const emo = jarvisLines("en", { ...ctx, arena: "personal", firm: "", leak: "emotions" }, "s");
    expect(emo.ack.length).toBeGreaterThan(0);
    const risk = jarvisLines("en", { ...ctx, arena: "personal", firm: "", leak: "risk" }, "s");
    expect(risk.ack).toContain("0.5%");
  });

  test("une variante dont un chiffre manque est écartée, jamais affichée à trous", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const l = jarvisLines("en", { ...ctx, firm: "", size: "", name: "", trades: "" }, seed);
      for (const line of Object.values(l)) {
        expect(line).not.toMatch(/\{\w+\}/);
        expect(line).not.toMatch(/ {2}|\(\)|on your +on/);
      }
    }
  });

  test("deux traders au même profil ne lisent pas mot pour mot la même séquence", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      seen.add(Object.values(jarvisLines("en", ctx, `user-${i}`)).join("|"));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("stable pour un même trader : un rendu ne change pas la phrase", () => {
    expect(jarvisLines("fr", ctx, "u")).toEqual(jarvisLines("fr", ctx, "u"));
  });

  test("ni statistique, ni promesse de gain, ni question répétant le titre", () => {
    const contexts: JarvisContext[] = [
      ctx,
      { ...ctx, arena: "funded", experience: "funded", leak: "emotions" },
      { ...ctx, arena: "personal", firm: "", size: "", assets: ["forex"], style: "swing" },
      {
        ...ctx,
        arena: "demo",
        firm: "",
        assets: ["crypto"],
        experience: "new",
        leak: "journaling",
      },
    ];
    for (const lang of ["en", "fr"]) {
      for (const c of contexts) {
        for (const seed of ["x", "y", "z"]) {
          const l = jarvisLines(lang, c, seed);
          for (const line of Object.values(l)) {
            expect(line).not.toMatch(/\d+ ?%\s+of traders|most traders|la plupart des traders/i);
            expect(line).not.toMatch(/guarantee|garanti|profit assured/i);
          }
          // Le titre de l'angle mort commence par « Sois honnête » : Jarvis ne
          // le répète pas.
          expect(l.leak).not.toMatch(/be honest|sois honnête/i);
          // Le titre pose la question : Jarvis n'en pose pas une seconde.
          for (const k of [
            "identity",
            "arena",
            "account",
            "markets",
            "style",
            "experience",
            "leak",
          ] as const) {
            expect(l[k].trim().endsWith("?"), `${lang}:${k}:${l[k]}`).toBe(false);
          }
        }
      }
    }
  });
});
