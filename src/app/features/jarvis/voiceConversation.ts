import { useCallback, useEffect, useRef, useState } from "react";

/**
 * LA CONVERSATION VOCALE AVEC JARVIS — parler, écouter, enchaîner.
 *
 * Le micro du compositeur n'était qu'une DICTÉE : il remplissait le champ, et
 * il fallait encore relire, appuyer sur « envoyer », puis sur « écouter ». On
 * ne parle pas à quelqu'un comme ça. Le mode vocal fait la boucle complète :
 *
 *   écoute → la phrase finie part toute seule → Jarvis réfléchit → il répond
 *   À VOIX HAUTE, en deux ou trois phrases → le micro se rouvre.
 *
 * Ce module ne gère que la reconnaissance (navigateur, Web Speech API) et ses
 * garde-fous ; l'orchestration du tour (question, réponse, voix) vit dans le
 * workspace de conversation, qui possède déjà la question et la voix.
 *
 * ── GARDE-FOUS ─────────────────────────────────────────────────────────────
 *   • Le micro n'écoute JAMAIS pendant que Jarvis parle : il s'entendrait.
 *   • Deux silences d'affilée ferment le mode — un micro laissé ouvert dans
 *     une poche n'est pas une conversation.
 *   • « Stop », « c'est tout », « merci Jarvis »… ferment le mode sans rien
 *     envoyer (`isEndCommand`).
 *   • Micro refusé : le mode se ferme et le DIT (`error: "denied"`).
 */

// Typage minimal de la Web Speech API — absente de lib.dom.d.ts.
export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

interface SpeechResultEvent {
  resultIndex?: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
}

export function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return ((w.SpeechRecognition || w.webkitSpeechRecognition) ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/** « fr » → « fr-FR », « en » → « en-US » : la reconnaissance veut une région. */
export function speechLangTag(lang: string): string {
  const l = (lang || "en").toLowerCase();
  if (l.includes("-")) return lang;
  if (l.startsWith("fr")) return "fr-FR";
  return "en-US";
}

/** Les phrases qui ferment la conversation — seules, jamais au milieu d'une question. */
const END =
  /^(stop|stoppe?|arrete|arrete[- ]toi|c'est tout|c'est bon|termine|fin|fini|au revoir|bye|bye bye|goodbye|that'?s all|that'?s it|end|end conversation|merci jarvis|thanks jarvis|thank you jarvis|ok merci|ok thanks)( jarvis)?$/;

export function isEndCommand(text: string): boolean {
  const t = (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > 0 && t.length <= 40 && END.test(t);
}

/** La transcription d'un événement : ce qui est acquis, et ce qui s'écrit encore. */
export function readTranscript(e: SpeechResultEvent): { final: string; interim: string } {
  let final = "";
  let interim = "";
  const results = Array.from(e.results ?? []);
  for (const r of results) {
    const text = r?.[0]?.transcript ?? "";
    if (r.isFinal) final += text;
    else interim += text;
  }
  return { final: final.trim(), interim: interim.trim() };
}

export type VoiceError = "denied" | "unsupported" | null;

export interface VoiceConversation {
  supported: boolean;
  /** Le mode vocal est ouvert (quel que soit le tour). */
  active: boolean;
  /** Le micro écoute en ce moment. */
  listening: boolean;
  /** Ce que le trader est en train de dire (transcription provisoire). */
  interim: string;
  error: VoiceError;
  /** Ouvre le mode vocal et écoute. À appeler depuis un geste (clic). */
  start: () => void;
  /** Ferme le mode vocal. */
  stop: () => void;
  /** Rouvre le micro pour le tour suivant. */
  listen: () => void;
  /** Termine l'écoute en cours : ce qui a été dit part tout de suite. */
  finish: () => void;
}

const MAX_SILENCES = 2;

export function useVoiceConversation(opts: {
  lang: string;
  /** Une phrase finie (jamais vide, jamais une commande de fin). */
  onUtterance: (text: string) => void;
}): VoiceConversation {
  const Ctor = getSpeechRecognition();
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceError>(null);
  const activeRef = useRef(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const silencesRef = useRef(0);
  // La dernière version du rappel — la reconnaissance vit plus longtemps qu'un rendu.
  const onUtteranceRef = useRef(opts.onUtterance);
  const langRef = useRef(opts.lang);
  useEffect(() => {
    onUtteranceRef.current = opts.onUtterance;
    langRef.current = opts.lang;
  });

  const close = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setListening(false);
    setInterim("");
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        (rec.abort ?? rec.stop).call(rec);
      } catch {
        /* déjà arrêtée */
      }
    }
  }, []);

  const listen = useCallback(() => {
    if (!Ctor || !activeRef.current || recRef.current) return;
    const rec = new Ctor();
    rec.lang = speechLangTag(langRef.current);
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let heard = "";
    let denied = false;
    rec.onresult = (e) => {
      const { final, interim: live } = readTranscript(e);
      if (final) heard = final;
      setInterim(final || live);
    };
    rec.onerror = (e) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") denied = true;
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      setInterim("");
      if (!activeRef.current) return;
      if (denied) {
        setError("denied");
        close();
        return;
      }
      const text = heard.trim();
      if (!text) {
        // Silence : on retente une fois, puis on ferme.
        silencesRef.current += 1;
        if (silencesRef.current >= MAX_SILENCES) close();
        else window.setTimeout(() => listen(), 150);
        return;
      }
      silencesRef.current = 0;
      if (isEndCommand(text)) {
        close();
        return;
      }
      onUtteranceRef.current(text);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      // `start()` lève si une reconnaissance tourne encore : on laisse la
      // main au prochain tour plutôt que de bloquer le mode.
      recRef.current = null;
      setListening(false);
    }
  }, [Ctor, close]);

  const start = useCallback(() => {
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    setError(null);
    silencesRef.current = 0;
    activeRef.current = true;
    setActive(true);
    // Déverrouille la synthèse vocale DANS le geste de l'utilisateur : iOS
    // refuse sinon de parler plus tard, quand la réponse arrive.
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    } catch {
      /* best-effort */
    }
    listen();
  }, [Ctor, listen]);

  const finish = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* déjà arrêtée */
    }
  }, []);

  // Le mode vocal meurt avec le composant : jamais de micro orphelin.
  useEffect(() => close, [close]);

  return {
    supported: !!Ctor,
    active,
    listening,
    interim,
    error,
    start,
    stop: close,
    listen,
    finish,
  };
}
