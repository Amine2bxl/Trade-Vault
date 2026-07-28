/**
 * Local voice — Jarvis without a network call, a vendor or an API key.
 *
 * Two things separate this from a naive `speechSynthesis.speak(text)`:
 *
 *  1. **Voice selection.** Browsers expose anything from a 1990s formant
 *     synthesiser to a modern neural voice under the same API. The scoring
 *     table below ranks the deep male English voices that actually ship on
 *     Windows, macOS, iOS, Android and Chrome, so the trader gets the best one
 *     their device has rather than the first one in the list.
 *  2. **Cadence.** The line is spoken clause by clause with deliberate pauses
 *     (see `prosody.ts`) instead of as one flat block.
 *
 * Pure scoring, so the chosen voice is deterministic and unit-testable.
 */

/**
 * Names of the deep male voices worth targeting, in descending preference.
 * Matching by name is unavoidable: the Web Speech API exposes no gender or
 * timbre metadata, only `name`, `lang` and `localService`.
 */
const PREFERRED = [
  // Microsoft Edge / Windows 11 neural voices — the closest local match.
  { re: /ryan.*(neural|online|natural)/i, score: 60 },
  { re: /(guy|christopher|eric|brandon).*(neural|online|natural)/i, score: 55 },
  { re: /thomas.*(neural|online|natural)/i, score: 50 },
  // Chrome's bundled Google voices.
  { re: /google uk english male/i, score: 48 },
  { re: /google us english/i, score: 34 },
  // Apple — Daniel is the classic deep en-GB voice; Oliver/Arthur on newer OS.
  { re: /\b(daniel|arthur|oliver)\b/i, score: 46 },
  { re: /\balex\b/i, score: 38 },
  // Generic neural/enhanced male voices on any platform.
  { re: /\b(male)\b.*(neural|natural|enhanced|premium)/i, score: 36 },
] as const;

/** Voices that are audibly female or notably thin — never the coach. */
const AVOID =
  /\b(zira|hazel|susan|linda|samantha|karen|moira|tessa|fiona|victoria|amelie|female|aria|jenny|michelle|sonia|libby|caroline|eloise|serena|catherine)\b/i;

/**
 * Pick the closest deep male English voice from the browser's list.
 * Deterministic for a given list, so the voice never changes between sessions
 * on the same device.
 */
export function pickJarvisVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;

  for (const v of voices) {
    if (!v.lang?.toLowerCase().startsWith("en")) continue;
    const name = v.name ?? "";
    let score = 0;

    for (const p of PREFERRED) {
      if (p.re.test(name)) {
        score += p.score;
        break;
      }
    }
    // Generic quality signals, for devices with none of the known voices.
    if (/neural|natural/i.test(name)) score += 12;
    if (/premium|enhanced|multilingual/i.test(name)) score += 6;
    if (/online/i.test(name)) score += 4;
    // Cloud voices generally beat the offline built-ins.
    if (v.localService === false) score += 3;
    // British English carries the composed register the profile targets.
    if (/^en-GB/i.test(v.lang)) score += 5;
    if (AVOID.test(name)) score -= 40;

    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}
