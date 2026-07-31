/**
 * Voice catalogue generator — renders every fixed Jarvis line with the cloned
 * voice and ships it as a static MP3, so the SaaS plays the exact voice with
 * zero per-utterance cost and no vendor token.
 *
 * Run:  bun run scripts/voices/generate.ts
 *
 * Engines (switch freely, both offline and free):
 *   - f5  (default)  F5-TTS — MIT, natural, closest to a neural provider
 *   - xtts           XTTS-v2 — Coqui, heavier but well-known
 *
 * Inputs:
 *   - the reference voice sample   (env VOICE_REF, default src/modules/voice/Jarvis.mp3)
 *   - src/app/pages/checklist/voice.ts  the Checklist LINES catalog (single source)
 *   - src/modules/voice/brief.ts        the Jarvis brief fixed lines (single source)
 *
 * Outputs (committed, served statically):
 *   - public/voices/voice-<ref>-<text>.mp3   one MP3 per unique spoken line
 *   - public/voices/manifest.json            text -> file, used by the runtime lookup
 *
 * Changing the voice is one step: drop a new sample on the reference path and
 * re-run. The reference fingerprint is part of every filename, so old clips
 * are regenerated and stale files are pruned automatically.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LINES } from "../../src/app/pages/checklist/voice";
import { briefLines } from "../../src/modules/voice/brief";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(ROOT, "public/voices");
const TMP_DIR = join(ROOT, "scripts/voices/.gen-tmp");

const ENGINES = {
  f5: {
    python: join(ROOT, "scripts/voices/.venv-f5/bin/python"),
    synth: join(ROOT, "scripts/voices/synthesize_f5.py"),
    label: "F5-TTS",
  },
  xtts: {
    python: join(ROOT, "scripts/voices/.venv/bin/python"),
    synth: join(ROOT, "scripts/voices/synthesize.py"),
    label: "XTTS-v2",
  },
} as const;

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

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Fingerprint of the reference sample — changing it re-renders every line. */
function referenceHash(refPath: string): string {
  return sha256(readFileSync(refPath)).slice(0, 8);
}

function main(): void {
  const engine = (process.env.VOICE_ENGINE ?? "f5") as keyof typeof ENGINES;
  if (!ENGINES[engine]) throw new Error(`unknown VOICE_ENGINE: ${engine}`);
  const { python, synth, label } = ENGINES[engine];

  const reference = process.env.VOICE_REF ?? join(ROOT, "src/modules/voice/Jarvis.mp3");
  if (!existsSync(reference)) {
    throw new Error(`missing reference voice: ${reference}`);
  }
  const refHash = referenceHash(reference);
  // Render config is part of the filename: changing engine or speed re-renders
  // every line instead of silently reusing clips rendered with old settings.
  const speed = process.env.F5_SPEED ?? "0.80";
  const steps = process.env.F5_STEPS ?? "32";
  const cfg = process.env.F5_CFG ?? "3.0";
  const cfgHash = sha256(`${engine}:${speed}:${steps}:${cfg}`).slice(0, 4);
  console.log(
    `[voices] engine=${label} reference=${reference} (${refHash}) speed=${speed} steps=${steps} cfg=${cfg} cfg=${cfgHash}`,
  );

  const catalog = buildCatalog();
  console.log(`[voices] catalog: ${catalog.length} unique lines`);

  const lines = catalog.map((text) => ({ id: sha256(text).slice(0, 12), text }));
  const manifest: Record<string, string> = {};
  const need: typeof lines = [];

  for (const item of lines) {
    const file = `voice-${refHash}-${cfgHash}-${item.id}.mp3`;
    manifest[item.text] = file;
    if (!existsSync(join(OUT_DIR, file))) need.push(item);
  }

  mkdirSync(TMP_DIR, { recursive: true });
  const linesJson = join(TMP_DIR, "lines.json");
  writeFileSync(linesJson, JSON.stringify(lines, null, 2));

  if (need.length) {
    console.log(`[voices] generating ${need.length} new clips…`);
    const toDo = join(TMP_DIR, "todo.json");
    writeFileSync(toDo, JSON.stringify(need, null, 2));
    execFileSync(python, [synth, toDo, TMP_DIR, "--ref", reference, "--cache", TMP_DIR], {
      stdio: "inherit",
      env: { ...process.env, COQUI_TOS_AGREED: "1", PYTHONHASHSEED: "0" },
    });
    mkdirSync(OUT_DIR, { recursive: true });
    for (const item of need) {
      const wav = join(TMP_DIR, `${item.id}.wav`);
      const mp3 = join(OUT_DIR, `voice-${refHash}-${cfgHash}-${item.id}.mp3`);
      // Gentle edge trim (-50 dB, long window) so only true dead air is
      // removed — never a soft consonant — then even loudness.
      const filter =
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.2," +
        "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.2," +
        "areverse,loudnorm=I=-16:TP=-1.5:LRA=11";
      execFileSync(
        "ffmpeg",
        ["-y", "-i", wav, "-af", filter, "-ar", "24000", "-ac", "1", "-b:a", "64k", mp3],
        { stdio: "ignore" },
      );
      rmSync(wav);
    }
  } else {
    console.log("[voices] all clips already up to date");
  }

  // Prune stale clips from a previous reference/engine.
  const live = new Set(Object.values(manifest));
  for (const file of readdirSync(OUT_DIR)) {
    if (file.startsWith("voice-") && !live.has(file)) {
      rmSync(join(OUT_DIR, file));
      console.log(`[voices] pruned ${file}`);
    }
  }

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[voices] manifest written: ${Object.keys(manifest).length} clips`);
}

// Guard so importing this module in tests builds the catalog without running
// the (heavy) synthesis pipeline.
export { main as generateVoices };

if (import.meta.main) main();
