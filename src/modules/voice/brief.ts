/**
 * Jarvis's fixed spoken lines — the finite catalog that the cloned voice is
 * rendered for. Anything in here is pre-synthesized once into `public/voices`
 * (see `scripts/voices/generate.ts`) and played as a static audio clip, so the
 * SaaS never pays a per-utterance TTS cost and every user hears the same voice.
 *
 * The browser voice (and the hosted path) remain as fallbacks for the lines
 * that are genuinely dynamic — they must not drift from what the voice speaks.
 */

/** Greetings the single voice uses, ordered by time of day. */
export const JARVIS_GREETINGS = ["Good morning", "Good afternoon", "Good evening"] as const;

/** Fixed English brief sentences (the dynamic "Your priority…" stays a fallback). */
export const JARVIS_BRIEF_LOG =
  "Log your trades and I will read your edge from the data." as const;
export const JARVIS_BRIEF_KEEP =
  "No recurring leak. Protect the streak — run the same process today." as const;

/** Fixed spoken lines shared with the page, greeting-expanded. */
export function briefLines(): string[] {
  return JARVIS_GREETINGS.flatMap((greet) => [
    `${greet}. ${JARVIS_BRIEF_LOG}`,
    `${greet}. ${JARVIS_BRIEF_KEEP}`,
  ]);
}
