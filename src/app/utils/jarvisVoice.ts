import { useCallback, useEffect, useRef, useState } from "react";
import { ttsCapabilities, ttsSpeak } from "@/backend/tts.functions";
import { clipFor, loadVoiceClips } from "@/modules/voice/clips";
import { JARVIS_VOICE, pickJarvisVoice, toSpeechSegments } from "@/modules/voice";

/**
 * Jarvis voice — the product's ONE voice, shared by every surface (the
 * pre-market Checklist and the Jarvis coaching page).
 *
 * Contract, identical everywhere:
 *   1. Speak LOCALLY by default — `modules/voice` picks the closest deep male
 *      English voice on the device and shapes the delivery clause by clause.
 *      No key, no vendor, no network: this works the moment main is deployed.
 *   2. If a hosted neural voice is configured server-side, use it instead so
 *      every trader hears the identical voice on every OS. Availability is
 *      probed once per session, never per line.
 *   3. Any hosted failure (network, quota, autoplay refusal) falls back to the
 *      local voice mid-sentence — the trader hears a voice, never an error.
 *   4. Spoken text is ALWAYS English, whatever the UI language, so the single
 *      voice never has to mispronounce another locale.
 */

/** Probed once per page load and shared by every hook instance. */
let hostedProbe: Promise<boolean> | null = null;

function hostedAvailable(): Promise<boolean> {
  if (!hostedProbe) {
    hostedProbe = ttsCapabilities()
      .then((r) => !!r.hosted)
      .catch(() => false);
  }
  return hostedProbe;
}

/** Back-compat alias — the Checklist imports the picker under this name. */
export { pickJarvisVoice as pickEnglishMaleVoice } from "@/modules/voice";

export interface JarvisVoice {
  /** Speak a line (English). Resolves once playback has started. */
  speak: (text: string) => Promise<void>;
  /** Stop any current playback immediately. */
  stop: () => void;
  /** True while Jarvis is talking — drive a subtle "speaking" indicator. */
  speaking: boolean;
}

export function useJarvisVoice(): JarvisVoice {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // Incremented on every stop/new line so a queued segment from a cancelled
  // line can tell it is stale and drop itself instead of talking over the next.
  const runRef = useRef(0);

  // Keep the browser voice list warm (it populates asynchronously, and on some
  // browsers only after the first `getVoices()` call).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      voicesRef.current = speechSynthesis.getVoices();
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Preload the cloned-voice clip map — fixed lines play the exact voice.
  useEffect(() => {
    void loadVoiceClips();
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  /**
   * Local delivery: one utterance per clause, with the pause the prosody
   * engine asked for between them. That cadence is most of what makes the
   * browser engine read as a composed coach rather than a screen reader.
   */
  const speakLocal = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    const segments = toSpeechSegments(text);
    if (!segments.length) return;

    const run = ++runRef.current;
    try {
      speechSynthesis.cancel();
      const voice = pickJarvisVoice(voicesRef.current);
      setSpeaking(true);

      const sayFrom = (i: number) => {
        if (run !== runRef.current) return; // superseded by a newer line
        if (i >= segments.length) {
          setSpeaking(false);
          return;
        }
        const seg = segments[i];
        const u = new SpeechSynthesisUtterance(seg.text);
        u.lang = JARVIS_VOICE.lang;
        u.rate = JARVIS_VOICE.rate;
        u.pitch = JARVIS_VOICE.pitch;
        u.volume = JARVIS_VOICE.volume;
        if (voice) u.voice = voice;
        u.onend = () => {
          if (run !== runRef.current) return;
          if (seg.pauseMs > 0) window.setTimeout(() => sayFrom(i + 1), seg.pauseMs);
          else sayFrom(i + 1);
        };
        u.onerror = () => {
          if (run === runRef.current) setSpeaking(false);
        };
        speechSynthesis.speak(u);
      };
      sayFrom(0);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const line = text.trim();
      if (!line) return;

      // Cloned voice first: pre-rendered fixed lines play their static clip —
      // exact identity, zero network, zero per-utterance cost.
      await loadVoiceClips();
      const clip = clipFor(line);
      if (clip) {
        const played = await new Promise<boolean>((resolve) => {
          const run = ++runRef.current;
          audioRef.current?.pause();
          const el = new Audio(clip);
          audioRef.current = el;
          el.volume = 0.95;
          const done = (started: boolean) => {
            if (run === runRef.current && !started) setSpeaking(false);
            resolve(started);
          };
          el.onended = () => {
            if (run === runRef.current) setSpeaking(false);
            resolve(true);
          };
          el.onerror = () => done(false);
          setSpeaking(true);
          el.play()
            .then(() => done(true))
            .catch(() => done(false));
        });
        if (played) return;
        // Autoplay refusal or missing file → fall through to hosted/local.
      }

      if (!(await hostedAvailable())) {
        speakLocal(line);
        return;
      }
      try {
        const res = await ttsSpeak({ data: { text: line.slice(0, 600) } });
        if (!res.available || !("audio" in res) || !res.audio) {
          hostedProbe = Promise.resolve(false);
          speakLocal(line);
          return;
        }
        const run = ++runRef.current;
        audioRef.current?.pause();
        const el = new Audio(res.audio);
        audioRef.current = el;
        el.volume = 0.95;
        el.onended = () => {
          if (run === runRef.current) setSpeaking(false);
        };
        el.onerror = () => {
          if (run === runRef.current) setSpeaking(false);
        };
        setSpeaking(true);
        await el.play();
      } catch {
        // Network or autoplay refusal → local voice, never an error.
        hostedProbe = Promise.resolve(false);
        speakLocal(line);
      }
    },
    [speakLocal],
  );

  // Silence Jarvis when the component using the hook unmounts.
  useEffect(() => stop, [stop]);

  return { speak, stop, speaking };
}
