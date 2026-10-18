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
  // LA voix de Jarvis — « Daniel » (ElevenLabs) depuis le 18/10, à la demande
  // du fondateur : britannique, grave, posé, le timbre d'un Jarvis de film.
  // Historique, pour ne pas refaire le chemin : la voix créée sur mesure
  // (`PEuehAGHRfRnnYqUDPCo`, celle des clips pré-rendus de la checklist) puis,
  // brièvement, « Brian » (27/09), retiré parce que trop générique. Revenir à
  // la voix sur mesure = remettre son identifiant ici, rien d'autre.
  hostedVoiceId: "onwK4e9ZLuTAKqWW03F9",
  hostedModelId: "eleven_multilingual_v2",
  // Slightly under natural pace: a coach lands the number, then moves on.
  rate: 0.94,
  // Meaningfully below neutral — this is most of what makes a browser voice
  // read as "deep" rather than "assistant".
  pitch: 0.85,
  volume: 1,
  lang: "en-GB",
};
