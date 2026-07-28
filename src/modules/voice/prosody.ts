import type { SpeechSegment } from "./types";

/**
 * Prosody shaping — the difference between "a browser reading a string" and
 * "a coach talking to you".
 *
 * A single `SpeechSynthesisUtterance` renders a whole paragraph at one flat
 * pace: no breath after a verdict, no beat before a number. Splitting the line
 * into clauses and inserting deliberate silences buys most of the perceived
 * quality gap to a hosted neural voice, for zero bytes and zero dependency.
 *
 * Pure and deterministic — the same line always gets the same cadence.
 */

/** Pause after a full stop: the sentence has landed, let it. */
const PAUSE_SENTENCE = 340;
/** Pause after a comma / clause break: a breath, not a stop. */
const PAUSE_CLAUSE = 160;
/** A colon or dash announces something — the beat before it does the work. */
const PAUSE_ANNOUNCE = 260;

/**
 * Strip what should never be spoken. Coaching answers are Markdown, and a
 * voice reading "asterisk asterisk" out loud instantly breaks the illusion.
 */
export function stripForSpeech(text: string): string {
  const clean = text
    // fenced code and inline code
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    // links: keep the label, drop the target
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // emphasis, headings, list bullets, table pipes
    .replace(/[*_#>]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\|/g, " ")
    // emoji and pictographs
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  // A horizontal rule or a row of separators survives the passes above and
  // would otherwise be handed to the synthesiser as literal punctuation.
  return /[\p{L}\p{N}]/u.test(clean) ? clean : "";
}

/**
 * Split a spoken line into segments with the silence that should follow each.
 * Segments shorter than a few characters are merged into their neighbour, so a
 * stray "3." never becomes its own utterance.
 */
export function toSpeechSegments(text: string): SpeechSegment[] {
  const clean = stripForSpeech(text);
  if (!clean) return [];

  const segments: SpeechSegment[] = [];
  // Keep the delimiter so we know which pause to apply after each piece.
  const parts = clean.split(/([.!?]+\s+|[,;]\s+|\s+[—–-]\s+|:\s+)/);

  let buffer = "";
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = (parts[i] ?? "").trim();
    const delimiter = parts[i + 1] ?? "";
    if (!chunk) continue;

    buffer = buffer ? `${buffer} ${chunk}` : chunk;
    // Too short to stand alone — carry it into the next chunk.
    if (buffer.length < 12 && i + 2 < parts.length) continue;

    const pauseMs = /[.!?]/.test(delimiter)
      ? PAUSE_SENTENCE
      : /:/.test(delimiter) || /[—–-]/.test(delimiter)
        ? PAUSE_ANNOUNCE
        : delimiter
          ? PAUSE_CLAUSE
          : 0;

    segments.push({ text: buffer, pauseMs });
    buffer = "";
  }
  if (buffer) segments.push({ text: buffer, pauseMs: 0 });

  // The last segment never trails silence.
  if (segments.length) segments[segments.length - 1].pauseMs = 0;
  return segments;
}
