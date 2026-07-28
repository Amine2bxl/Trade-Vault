/**
 * Voice module — Jarvis's speech, provider-agnostic.
 *
 * `local` (the browser's speech engine, shaped by this module) is the default
 * and needs no key, no vendor and no network. `hosted` is an optional upgrade
 * that switches on by itself when an ElevenLabs key is configured server-side.
 * Callers use `useJarvisVoice()` and never learn which one spoke.
 */
export { JARVIS_VOICE } from "./profile";
export { pickJarvisVoice } from "./localVoice";
export { toSpeechSegments, stripForSpeech } from "./prosody";
export type { VoiceProfile, VoiceProviderId, SpeechSegment } from "./types";
