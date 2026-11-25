import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognition,
  readTranscript,
  speechLangTag,
  type SpeechRecognitionLike,
} from "@/app/features/jarvis/voiceConversation";

/**
 * La dictée d'une note — le reconnaisseur Web Speech déjà utilisé par Jarvis.
 * Rien n'est enregistré : seule la transcription, que le trader relit, part à
 * l'analyse. Indisponible (Firefox, micro refusé) : le bouton ne s'affiche pas
 * ou le dit.
 */
export function useDictation(lang: string) {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [denied, setDenied] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef("");
  const onDone = useRef<((text: string) => void) | null>(null);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(
    (done: (text: string) => void) => {
      const Ctor = getSpeechRecognition();
      if (!Ctor || rec.current) return;
      const r = new Ctor();
      r.lang = speechLangTag(lang);
      r.interimResults = true;
      r.continuous = true;
      finalText.current = "";
      onDone.current = done;
      r.onresult = (e) => {
        const { final, interim: live } = readTranscript(e);
        finalText.current = final;
        setInterim(live);
      };
      r.onerror = (e) => {
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setDenied(true);
      };
      r.onend = () => {
        rec.current = null;
        setListening(false);
        setInterim("");
        const text = finalText.current.trim();
        if (text) onDone.current?.(text);
      };
      rec.current = r;
      setDenied(false);
      setListening(true);
      try {
        r.start();
      } catch {
        rec.current = null;
        setListening(false);
      }
    },
    [lang],
  );

  useEffect(() => () => rec.current?.abort?.(), []);

  return { supported, listening, interim, denied, start, stop };
}
