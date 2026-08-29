import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
 *
 * ── AUTHENTIFICATION ET QUOTA ───────────────────────────────────────────────
 * `ttsSpeak` n'avait AUCUN middleware. Une server function est un point
 * d'entrée HTTP : n'importe qui, sans compte, pouvait la boucler et brûler le
 * quota ElevenLabs — payé par nous — six cents caractères à la fois. Le
 * limiteur d'IP de `server.ts` ne la couvrait pas non plus : il ne s'applique
 * qu'aux chemins `/api/`, et les server functions n'y sont pas.
 *
 * Deux barrières désormais : l'authentification, et un quota horaire par
 * compte compté en base (portée `tts`, distincte de celle du coach — griller
 * sa voix ne doit pas empêcher de poser une question).
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

/**
 * Répliques hébergées autorisées par heure et par compte.
 *
 * Jarvis parle par phrases courtes : deux cents lignes par heure couvrent très
 * largement une séance de trading commentée de bout en bout, et plafonnent le
 * coût d'un compte qui boucle. Réglable sans redéploiement.
 */
const TTS_LIMIT_PER_HOUR = Number(process.env.TTS_RATE_LIMIT_PER_HOUR ?? "200");

export const ttsSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!hostedEnabled()) return { available: false as const };
    const apiKey = process.env.ELEVENLABS_API_KEY as string;

    // Quota horaire par compte, compté atomiquement en base. Portée `tts` : le
    // compteur du coach et celui de la voix sont deux lignes distinctes.
    //
    // ÉCHOUE FERMÉ, contrairement au quota du coach. La différence est
    // délibérée : une voix qui ne se déclenche pas retombe sur la voix locale
    // du navigateur, donc l'utilisateur garde exactement la fonctionnalité. Il
    // n'y a aucune raison de laisser passer un appel facturé quand on ne sait
    // pas s'il est dans les clous.
    try {
      const { data: allowed, error } = await (context.supabase as unknown as SupabaseClient).rpc(
        "consume_ai_quota_scoped",
        {
          p_scope: "tts",
          p_limit: TTS_LIMIT_PER_HOUR,
          p_window_seconds: 3600,
        },
      );
      if (error || allowed === false) {
        if (error) console.error("[tts] quota check failed", error);
        return { available: false as const };
      }
    } catch (e) {
      console.error("[tts] quota check threw", e);
      return { available: false as const };
    }

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
