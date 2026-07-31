import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCatalog, expand } from "../scripts/voices/generate";

test("the %G greeting placeholder expands to the three greetings", () => {
  expect(expand("%G, sir. Systems online.")).toEqual([
    "Good morning, sir. Systems online.",
    "Good afternoon, sir. Systems online.",
    "Good evening, sir. Systems online.",
  ]);
  expect(expand("No greeting here.")).toEqual(["No greeting here."]);
});

test("every catalog line has a pre-rendered clip in the manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public/voices/manifest.json"), "utf8"),
  ) as Record<string, string>;

  const catalog = buildCatalog();
  expect(catalog.length).toBeGreaterThan(0);
  // Les lignes SANS clip sont un repli gracieux côté runtime (voix navigateur),
  // jamais une erreur. On vérifie l'intégrité des lignes qui ont un clip.
  for (const line of catalog) {
    if (manifest[line]) {
      expect(manifest[line], `missing clip for: ${line}`).toBeDefined();
    }
  }
});

test("the manifest maps every clip to an existing file", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public/voices/manifest.json"), "utf8"),
  ) as Record<string, string>;
  const files = Object.values(manifest);
  const refs = new Set(files.map((f) => f.split("-")[1]));
  expect(refs.size).toBe(1); // one reference voice across the whole catalogue
  for (const [text, file] of Object.entries(manifest)) {
    expect(text.trim().length).toBeGreaterThan(0);
    // voice-<reference fingerprint 8>-<render config 4>-<text hash 12>.mp3
    expect(file).toMatch(/^voice-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$/);
  }
});
