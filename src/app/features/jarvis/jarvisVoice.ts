import { useCallback, useEffect, useRef, useState } from "react";
import { hostedAudio, hostedAvailable, markHostedDown } from "./hostedVoice";
import { clipFor, loadVoiceClips, refreshVoiceClips } from "@/modules/voice/clips";
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
 *   4. Fixed lines (checklist, greetings) are English. A conversation answer is
 *      spoken in the language it was WRITTEN in (`opts.lang`): the hosted
 *      voice is multilingual (same timbre), and the local fallback picks a
 *      voice of that language instead of reading French with an English one.
 */

/** Back-compat alias — the Checklist imports the picker under this name. */
export { pickJarvisVoice as pickEnglishMaleVoice } from "@/modules/voice";

export interface SpeakOptions {
  /** Langue de la réplique (« fr », « en »…). Absente : anglais. */
  lang?: string;
}

/** « fr » → « fr-FR » ; tout le reste garde la voix anglaise du profil. */
function utteranceLang(lang?: string): string {
  return lang?.toLowerCase().startsWith("fr") ? "fr-FR" : JARVIS_VOICE.lang;
}

export interface JarvisVoice {
  /** Speak a line (English unless `opts.lang`). Resolves once playback has started. */
  speak: (text: string, opts?: SpeakOptions) => Promise<void>;
  /** Speak STRICTLY with the local browser voice — no clips, no hosted TTS,
   *  no network, zero cost. Used for ambient greetings (never counted). */
  speakLocal: (text: string, lang?: string) => void;
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
  // Incrémenté par `stop()` SEULEMENT. Une réplique hébergée met une seconde
  // à arriver : sans ce ticket, couper la parole à Jarvis pendant ce temps
  // n'empêchait pas l'audio de partir ensuite — par-dessus le micro rouvert.
  const cancelRef = useRef(0);

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
    cancelRef.current++;
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
  const speakLocal = useCallback((text: string, lang?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    const segments = toSpeechSegments(text);
    if (!segments.length) return;

    const run = ++runRef.current;
    try {
      speechSynthesis.cancel();
      const voice = pickJarvisVoice(voicesRef.current, lang);
      setSpeaking(true);

      const sayFrom = (i: number) => {
        if (run !== runRef.current) return; // superseded by a newer line
        if (i >= segments.length) {
          setSpeaking(false);
          return;
        }
        const seg = segments[i];
        const u = new SpeechSynthesisUtterance(seg.text);
        u.lang = utteranceLang(lang);
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
    async (text: string, opts?: SpeakOptions) => {
      const line = text.trim();
      if (!line) return;
      const english = !opts?.lang || opts.lang.toLowerCase().startsWith("en");
      const ticket = cancelRef.current;
      const cancelled = () => cancelRef.current !== ticket;

      /** Joue une URL audio ; `true` si la lecture a démarré. */
      const play = (url: string) =>
        new Promise<boolean>((resolve) => {
          const run = ++runRef.current;
          audioRef.current?.pause();
          const el = new Audio(url);
          audioRef.current = el;
          el.volume = 0.95;
          el.playbackRate = 1;
          el.preservesPitch = true;
          el.onended = () => {
            if (run === runRef.current) setSpeaking(false);
          };
          el.onerror = () => {
            if (run === runRef.current) setSpeaking(false);
            resolve(false);
          };
          setSpeaking(true);
          el.play()
            .then(() => resolve(true))
            .catch(() => {
              if (run === runRef.current) setSpeaking(false);
              resolve(false);
            });
        });

      // 1. LA voix de Jarvis — la même sur tous les écrans (voir hostedVoice).
      if (await hostedAvailable()) {
        const audio = await hostedAudio(line);
        if (cancelled()) return;
        if (audio && (await play(audio))) return;
        if (!audio) markHostedDown();
      }

      // 2. Secours : le clip pré-rendu de la réplique, s'il existe — clips
      //    anglais uniquement : inutile d'en chercher pour une réponse française.
      if (cancelled()) return;
      if (!english) {
        speakLocal(line, opts?.lang);
        return;
      }
      await loadVoiceClips();
      if (cancelled()) return;
      const clip = clipFor(line);
      if (clip && (await play(clip))) return;
      if (clip) {
        // Manifeste périmé (cache navigateur/CDN) ? On le rafraîchit une fois.
        await refreshVoiceClips();
        const healed = clipFor(line);
        if (healed && healed !== clip && (await play(healed))) return;
      }

      // 3. Dernier secours : la voix du navigateur — jamais une erreur.
      speakLocal(line);
    },
    [speakLocal],
  );

  // Silence Jarvis when the component using the hook unmounts.
  useEffect(() => stop, [stop]);

  return { speak, speakLocal, stop, speaking };
}
