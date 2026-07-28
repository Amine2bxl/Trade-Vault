/**
 * Voice engine contract — the same provider-agnostic shape the AI layer uses.
 *
 * The product has ONE voice (Jarvis). *How* that voice is produced is an
 * implementation detail: a hosted neural provider when one is configured, the
 * local browser engine otherwise. Nothing above this layer knows which.
 */

export type VoiceProviderId = "local" | "hosted";

/** A single spoken chunk with the pause that follows it, in milliseconds. */
export interface SpeechSegment {
  text: string;
  /** Silence after this segment — this is what gives the delivery its cadence. */
  pauseMs: number;
}

/**
 * The timbre Jarvis targets, expressed in terms every engine can honour.
 * The hosted provider reproduces it exactly; the local one approximates it as
 * closely as the browser's voice list allows.
 */
export interface VoiceProfile {
  /** Hosted provider voice id (ElevenLabs). */
  hostedVoiceId: string;
  /** Hosted model id. */
  hostedModelId: string;
  /** Speaking rate, 1 = the engine's natural pace. */
  rate: number;
  /** Pitch, 1 = neutral. Below 1 deepens the voice. */
  pitch: number;
  volume: number;
  /** BCP-47 tag the local engine speaks with. */
  lang: string;
}
