import { useCallback, useEffect, useRef, useState } from "react";
import { ttsSpeak } from "@/backend/tts.functions";

/**
 * Jarvis voice — the product's ONE voice, shared by every surface (the
 * pre-market Checklist and the Jarvis coaching page).
 *
 * Contract, identical everywhere:
 *   1. Speak with the hosted ElevenLabs voice (same deep, calm male voice on
 *      Windows, macOS, Android, iOS) — see `backend/tts.functions.ts`.
 *   2. If that is unavailable (no API key, network/autoplay refusal), fall back
 *      to the closest browser male voice — no error, no interruption.
 *   3. Spoken text is ALWAYS English, whatever the UI language, so the single
 *      voice never has to mispronounce another locale.
 *
 * The scoring below is the single source of truth for "closest male en-GB
 * voice"; the Checklist imports it too instead of keeping its own copy.
 */

/**
 * Pick the closest deep/male English voice from the browser's list.
 * Pure — deterministic for a given voice list, so the fallback voice is stable.
 */
export function pickEnglishMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -999;
  for (const v of voices) {
    if (!v.lang.startsWith("en")) continue;
    let s = 0;
    const n = v.name;
    // Prefer modern neural / cloud voices — dramatically more premium than
    // the legacy built-ins.
    if (/neural|natural/i.test(n)) s += 12;
    if (/premium|enhanced|multilingual/i.test(n)) s += 5;
    if (/online/i.test(n)) s += 4;
    if (/google/i.test(n)) s += 6;
    if (/microsoft/i.test(n)) s += 3;
    if (/ryan|george|daniel|thomas|uk english male|mark\b/i.test(n)) s += 3;
    if (v.lang === "en-GB") s += 2;
    // Deep male timbre suits the composed Jarvis delivery.
    if (/zira|hazel|susan|linda|female|caroline|eloise/i.test(n)) s -= 4;
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

export interface JarvisVoice {
  /** Speak a line (English). Resolves once playback has started (or fell back). */
  speak: (text: string) => Promise<void>;
  /** Stop any current playback immediately. */
  stop: () => void;
  /** True while Jarvis is talking — drive a subtle "speaking" indicator. */
  speaking: boolean;
}

/**
 * Lightweight Jarvis voice hook for the coaching page: hosted voice first,
 * browser male voice as the silent fallback. No page-specific HUD — callers
 * read `speaking` to render their own indicator.
 */
export function useJarvisVoice(): JarvisVoice {
  const [speaking, setSpeaking] = useState(false);
  // Remember hosted availability for the session so we probe the network once.
  const hostedRef = useRef<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Keep the browser voice list warm (it populates asynchronously).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      voicesRef.current = speechSynthesis.getVoices();
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speakBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.rate = 0.96;
      u.pitch = 0.92;
      u.volume = 0.9;
      const v = pickEnglishMaleVoice(voicesRef.current);
      if (v) u.voice = v;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const line = text.trim();
      if (!line) return;
      // Browser voice directly if the hosted one already proved unavailable.
      if (hostedRef.current === false) {
        speakBrowser(line);
        return;
      }
      try {
        const res = await ttsSpeak({ data: { text: line.slice(0, 600) } });
        if (!res.available || !("audio" in res) || !res.audio) {
          hostedRef.current = false;
          speakBrowser(line);
          return;
        }
        hostedRef.current = true;
        audioRef.current?.pause();
        const el = new Audio(res.audio);
        audioRef.current = el;
        el.volume = 0.95;
        el.onended = () => setSpeaking(false);
        el.onerror = () => setSpeaking(false);
        setSpeaking(true);
        await el.play();
      } catch {
        // Network or autoplay refusal → browser voice, never an error.
        hostedRef.current = false;
        speakBrowser(line);
      }
    },
    [speakBrowser],
  );

  // Silence Jarvis when the component using the hook unmounts.
  useEffect(() => stop, [stop]);

  return { speak, stop, speaking };
}
