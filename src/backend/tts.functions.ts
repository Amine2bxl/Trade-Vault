import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { JARVIS_VOICE } from "@/modules/voice";

/**
 * Text-to-speech — the OPTIONAL hosted half of Jarvis's voice.
 *
 * The product no longer depends on this: `modules/voice` speaks locally in the
 * browser, with no key, no vendor and no network. This function is a pure
 * upgrade path — when an ElevenLabs key is configured, every trader hears the
 * exact same neural voice on every OS instead of the closest local one.
 *
 * Two switches, both server-side, both fail-safe:
 *   - no `ELEVENLABS_API_KEY`      → `available: false`, the app speaks locally
 *   - `TTS_PROVIDER=local`         → hosted is force-disabled even with a key
 *
 * The voice id is fixed: traders cannot switch voices, there is one Jarvis.
 */

function hostedEnabled(): boolean {
  if ((process.env.TTS_PROVIDER ?? "").toLowerCase() === "local") return false;
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * Cheap capability probe. The client asks once per session so it can go
 * straight to the local voice instead of paying a failed audio round-trip on
 * the first thing Jarvis ever says.
 */
export const ttsCapabilities = createServerFn({ method: "GET" }).handler(async () => ({
  hosted: hostedEnabled(),
}));

const SpeakInput = z.object({
  /** The line to speak. Always English — see the voice module. */
  text: z.string().min(1).max(600),
});

export const ttsSpeak = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data }) => {
    if (!hostedEnabled()) return { available: false as const };
    const apiKey = process.env.ELEVENLABS_API_KEY as string;

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${JARVIS_VOICE.hostedVoiceId}?output_format=mp3_44100_64`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            model_id: JARVIS_VOICE.hostedModelId,
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
