import { test, expect } from "bun:test";
import { pickJarvisVoice, toSpeechSegments, stripForSpeech } from "../src/modules/voice";

function voice(name: string, lang = "en-GB", localService = true): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

test("the deepest available male neural voice wins", () => {
  const picked = pickJarvisVoice([
    voice("Microsoft Zira - English (United States)", "en-US"),
    voice("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB", false),
    voice("Google US English", "en-US", false),
  ]);
  expect(picked?.name).toContain("Ryan");
});

test("audibly female voices are never chosen when a male one exists", () => {
  const picked = pickJarvisVoice([
    voice("Samantha", "en-US"),
    voice("Daniel", "en-GB"),
    voice("Karen", "en-AU"),
  ]);
  expect(picked?.name).toBe("Daniel");
});

test("non-English voices are ignored entirely", () => {
  const picked = pickJarvisVoice([voice("Thomas", "fr-FR"), voice("Amelie", "fr-CA")]);
  expect(picked).toBeNull();
});

test("markdown is never spoken out loud", () => {
  const spoken = stripForSpeech("## 🎯 Plan\n- **Cut** `overtrading` — see [stats](/analytics)");
  expect(spoken).not.toContain("*");
  expect(spoken).not.toContain("#");
  expect(spoken).not.toContain("`");
  expect(spoken).not.toContain("🎯");
  expect(spoken).toContain("overtrading");
  expect(spoken).toContain("stats");
});

test("a line is broken into clauses with a pause after each, and none after the last", () => {
  const segments = toSpeechSegments(
    "Your win rate drops to 38% on Fridays. Cut your size, then stop after one loss.",
  );
  expect(segments.length).toBeGreaterThan(1);
  expect(segments[0].pauseMs).toBeGreaterThan(0);
  expect(segments[segments.length - 1].pauseMs).toBe(0);
  // Nothing is lost in the split.
  expect(segments.map((s) => s.text).join(" ")).toContain("38%");
  expect(segments.map((s) => s.text).join(" ")).toContain("one loss");
});

test("an empty or markdown-only line produces no speech at all", () => {
  expect(toSpeechSegments("   ")).toHaveLength(0);
  expect(toSpeechSegments("## ---")).toHaveLength(0);
});
