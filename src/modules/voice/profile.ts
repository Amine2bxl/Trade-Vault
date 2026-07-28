import type { VoiceProfile } from "./types";

/**
 * Jarvis — the product's single voice.
 *
 * `hostedVoiceId` is the ElevenLabs voice the product is tuned against. The
 * local engine cannot *be* that voice — reproducing a specific neural voice
 * identity in-browser would mean shipping and running a cloned model, which we
 * neither ship nor have the right to clone. What it can do, and what these
 * numbers encode, is match its *character*: a deep, unhurried, composed male
 * British-English delivery. Rate and pitch below are the settings that bring
 * the browser engine closest to it.
 */
export const JARVIS_VOICE: VoiceProfile = {
  hostedVoiceId: "PEuehAGHRfRnnYqUDPCo",
  hostedModelId: "eleven_multilingual_v2",
  // Slightly under natural pace: a coach lands the number, then moves on.
  rate: 0.94,
  // Meaningfully below neutral — this is most of what makes a browser voice
  // read as "deep" rather than "assistant".
  pitch: 0.85,
  volume: 1,
  lang: "en-GB",
};
