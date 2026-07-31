/**
 * Voice catalogue generator — renders every fixed Jarvis line with the cloned
 * voice (XTTS-v2) and ships it as a static MP3, so the SaaS plays the exact
 * voice with zero per-utterance cost and no vendor token.
 *
 * Run:  bun run scripts/voices/generate.ts
 *
 * Inputs:
 *   - src/modules/voice/Jarvis.mp3  the reference voice sample
 *   - src/app/pages/checklist/voice.ts  the Checklist LINES catalog (single source)
 *   - src/modules/voice/brief.ts        the Jarvis brief fixed lines (single source)
 *
 * Outputs (committed, served statically):
 *   - public/voices/<hash>.mp3     one MP3 per unique spoken line
 *   - public/voices/manifest.json  text -> file, used by the runtime lookup
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LINES } from "../../src/app/pages/checklist/voice";
import { briefLines } from "../../src/modules/voice/brief";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REFERENCE = join(ROOT, "src/modules/voice/Jarvis.mp3");
const OUT_DIR = join(ROOT, "public/voices");
const TMP_DIR = join(ROOT, "scripts/voices/.gen-tmp");
const PYTHON = join(ROOT, "scripts/voices/.venv/bin/python");
const SYNTH = join(ROOT, "scripts/voices/synthesize.py");

const GREETINGS = ["Good morning", "Good afternoon", "Good evening"] as const;

/** Expand a %G placeholder into the three greeting variants. */
export function expand(line: string): string[] {
  if (!line.includes("%G")) return [line];
  return GREETINGS.map((g) => line.replace("%G", g));
}

/** Build the full set of unique spoken lines from every source. */
export function buildCatalog(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of Object.values(LINES)) {
    for (const en of entry.en) {
      for (const expanded of expand(en)) {
        const text = expanded.trim();
        if (!seen.has(text)) {
          seen.add(text);
          out.push(text);
        }
      }
    }
  }

  for (const line of briefLines()) {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }

  return out;
}

function idFor(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function main(): void {
  if (!existsSync(REFERENCE)) {
    throw new Error(`missing reference voice: ${REFERENCE}`);
  }
  const catalog = buildCatalog();
  console.log(`[voices] catalog: ${catalog.length} unique lines`);

  const lines = catalog.map((text) => ({ id: idFor(text), text }));
  const manifest: Record<string, string> = {};
  const need: typeof lines = [];

  for (const item of lines) {
    const file = `voice-${item.id}.mp3`;
    manifest[item.text] = file;
    if (!existsSync(join(OUT_DIR, file))) need.push(item);
  }

  mkdirSync(TMP_DIR, { recursive: true });
  const linesJson = join(TMP_DIR, "lines.json");
  writeFileSync(linesJson, JSON.stringify(lines, null, 2));

  if (need.length) {
    console.log(`[voices] generating ${need.length} new clips with XTTS…`);
    const toDo = join(TMP_DIR, "todo.json");
    writeFileSync(toDo, JSON.stringify(need, null, 2));
    execFileSync(PYTHON, [SYNTH, toDo, TMP_DIR, "--ref", REFERENCE, "--device", "auto"], {
      stdio: "inherit",
      env: { ...process.env, COQUI_TOS_AGREED: "1" },
    });

    mkdirSync(OUT_DIR, { recursive: true });
    for (const item of need) {
      const wav = join(TMP_DIR, `${item.id}.wav`);
      const mp3 = join(OUT_DIR, `voice-${item.id}.mp3`);
      execFileSync("ffmpeg", ["-y", "-i", wav, "-ar", "24000", "-ac", "1", "-b:a", "64k", mp3], {
        stdio: "ignore",
      });
      rmSync(wav);
    }
  } else {
    console.log("[voices] all clips already up to date");
  }

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[voices] manifest written: ${Object.keys(manifest).length} clips`);
}

// Guard so importing this module in tests builds the catalog without running
// the (heavy) synthesis pipeline.
export { main as generateVoices };

if (import.meta.main) main();
