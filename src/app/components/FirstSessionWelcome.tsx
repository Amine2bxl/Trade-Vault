import { useEffect, useRef } from "react";
import { useJarvisVoice } from "../utils/jarvisVoice";
import { useAuth } from "../contexts/AuthContext";
import { loadJarvisProfile, loadOnboarding } from "../store";

/**
 * FirstSessionWelcome — la voix de Jarvis, une seule fois, juste après
 * l'onboarding. Court, personnel, chiffré : prénom + LA faiblesse déclarée +
 * un objectif d'une action. 100 % local (speechSynthesis, 0 token), aucun UI
 * gadget — une phrase, un instant, puis plus jamais (flag localStorage).
 */

const FLAG = (uid: string) => `tv:first-session:${uid}`;

const PAIN_LABEL: Record<string, string> = {
  emotions: "emotions",
  consistency: "consistency",
  overtrading: "overtrading",
  risk: "risk management",
  journaling: "journaling",
};

export default function FirstSessionWelcome() {
  const { user } = useAuth();
  // Voix clonée (clips + ElevenLabs) — la même que partout ailleurs.
  const { speak } = useJarvisVoice();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user?.id || ranRef.current) return;
    ranRef.current = true;
    let done = false;
    try {
      done = !!localStorage.getItem(FLAG(user.id));
    } catch {
      /* best-effort */
    }
    if (done) return;

    let active = true;
    void (async () => {
      try {
        const [profile, onb] = await Promise.all([
          loadJarvisProfile(user.id).catch(() => null),
          loadOnboarding(user.id).catch(() => null),
        ]);
        if (!active) return;
        const firstName = profile?.firstName?.trim() || "trader";
        const pain = onb?.pain ? (PAIN_LABEL[onb.pain] ?? onb.pain) : null;
        const phrase = pain
          ? `Welcome, ${firstName}. I will keep an eye on your ${pain}. First objective: one clean trade.`
          : `Welcome, ${firstName}. First objective: one clean trade.`;
        // Petite attente : laisse la page se peindre avant de parler.
        window.setTimeout(() => void speak(phrase), 700);
      } catch {
        /* jamais bloquant */
      }
    })();
    // Marquer APRÈS avoir tenté — même si la voix est bloquée (autoplay),
    // on ne re-accueille pas l'utilisateur à chaque chargement.
    try {
      localStorage.setItem(FLAG(user.id), "1");
    } catch {
      /* best-effort */
    }
    return () => {
      active = false;
    };
  }, [user?.id, speak]);

  return null;
}
