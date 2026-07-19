/* Voice lines (JARVIS) — extrait de Checklist.tsx (Phase D). */

export type Tone = "calm" | "firm" | "alert";
// Deeper, more measured delivery = a more premium, composed JARVIS.
export const TONES: Record<Tone, { rate: number; pitch: number }> = {
  calm: { rate: 0.9, pitch: 0.88 },
  firm: { rate: 0.96, pitch: 0.84 },
  alert: { rate: 1.04, pitch: 0.8 },
};
export const LINES: Record<string, { tone: Tone; fr: string[]; en: string[] }> = {
  activate: {
    tone: "calm",
    fr: [
      "%G. Systèmes en ligne. Mon protocole est actif.",
      "%G. Tout est nominal. Je surveille.",
      "Systèmes en ligne. Personne ne trade sans mon accord.",
    ],
    en: [
      "%G, sir. Systems online. My protocol is active.",
      "%G. All nominal. I am watching.",
      "Systems online. Nobody trades without my clearance.",
    ],
  },
  checkDone: {
    tone: "firm",
    fr: ["Checklist complète. Validé.", "Tout est coché. C'est propre."],
    en: ["Checklist complete. Confirmed.", "All boxes ticked. Clean."],
  },
  discipline: {
    tone: "calm",
    fr: [
      "Tout est vert. Discipline vérifiée.",
      "Vérification terminée. Tu es prêt.",
      "Paramètres alignés. Je t'autorise à continuer.",
    ],
    en: [
      "All green. Discipline verified.",
      "Verification done. You are ready.",
      "Parameters aligned. You may proceed.",
    ],
  },
  initiate: {
    tone: "firm",
    fr: ["Séquence de verrouillage lancée.", "Verrouillage. Dernière vérification."],
    en: ["Locking sequence engaged.", "Locking. Final check."],
  },
  lock: {
    tone: "firm",
    fr: [
      "Edge confirmé. Exécution mécanique. Rien d'autre.",
      "Edge verrouillé. Le plan décide. Pas toi.",
    ],
    en: [
      "Edge confirmed. Mechanical execution. Nothing else.",
      "Edge locked. The plan decides. Not you.",
    ],
  },
  interference: {
    tone: "alert",
    fr: [
      "Interférence émotionnelle. Ferme ce chart.",
      "Non. C'est exactement comme ça qu'on détruit un compte.",
      "Tes émotions veulent trader. Refusé.",
    ],
    en: [
      "Emotional interference. Close the chart.",
      "No. This is exactly how accounts die.",
      "Your emotions want to trade. Denied.",
    ],
  },
  patience: {
    tone: "calm",
    fr: ["Protocole patience amélioré. Mode sniper.", "Bonne rétention. Mon edge travaille."],
    en: ["Patience protocol upgraded. Sniper mode.", "Good restraint. My edge is working."],
  },
  editor: {
    tone: "firm",
    fr: ["Mode éditeur activé.", "Accès configuration accordé."],
    en: ["Editor mode engaged.", "Configuration access granted."],
  },
};
