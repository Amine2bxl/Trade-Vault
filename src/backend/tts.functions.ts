import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Text-to-speech — ONE voice for the whole product.
 *
 * The browser's speechSynthesis gives a different voice on every OS/browser, so
 * it can never satisfy "the same voice everywhere". This function renders the
 * coach's lines with a single hosted voice instead, so a trader on Windows,
 * macOS, Android or iOS hears the exact same coach.
 *
 * Gated on ELEVENLABS_API_KEY: with no key configured the function reports
 * `available: false` and the client silently falls back to the locked-down
 * browser voice — the feature degrades, it never errors.
 *
 * The voice id is fixed server-side: users cannot switch voices.
 */

/** Deep, calm, charismatic male voice — the product's single coach voice. */
const VOICE_ID = "IKne3meq5aSn9XLyUdCD";
const MODEL_ID = "eleven_multilingual_v2";

const SpeakInput = z.object({
  /** The line to speak. Always English — see the checklist voice engine. */
  text: z.string().min(1).max(600),
});

export const ttsSpeak = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return { available: false as const };

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            model_id: MODEL_ID,
            // Tuned for an executive-coach delivery: stable and composed,
            // with enough style to stay human rather than robotic.
            voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3 },
          }),
        },
      );
      if (!res.ok) {
        console.error("[tts] provider returned", res.status);
        return { available: false as const };
      }
      const buf = await res.arrayBuffer();
      // Base64 data URL — small (64 kbps mono, one short line at a time) and
      // playable directly by an <audio> element with no extra storage.
      const b64 = Buffer.from(buf).toString("base64");
      return { available: true as const, audio: `data:audio/mpeg;base64,${b64}` };
    } catch (e) {
      console.error("[tts] request failed", e);
      return { available: false as const };
    }
  });
