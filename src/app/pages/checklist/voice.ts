/* Voice lines (JARVIS) — extrait de Checklist.tsx (Phase D).
   Enriched catalogue: many variants per situation so Jarvis never repeats
   himself, each written for a composed, dry, confident coach persona.
   Spoken lines are always English (`en`); `fr` mirrors them for parity. */

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
      "%G. Systèmes en ligne. Tous les protocoles sont nominaux.",
      "%G. TradeVault est armé. On passe au drill.",
      "Mise sous tension terminée. Je surveille chaque mouvement.",
      "%G. Mes yeux sont sur le marché. À toi la checklist.",
      "Systèmes au vert. J'attends tes consignes.",
      "%G. Faisons compter cette journée. Checklist d'abord.",
    ],
    en: [
      "%G, sir. Systems online. All protocols nominal.",
      "%G. TradeVault is armed. Let's run the drill.",
      "Power-up complete. I'll be watching every move.",
      "%G. My eyes are on the market. You take the checklist.",
      "Systems check green. Standing by for your inputs, sir.",
      "%G. Let's make today count. Checklist first.",
    ],
  },
  checkDone: {
    tone: "firm",
    fr: [
      "Checklist complète. Validé.",
      "Tout est coché. C'est propre.",
      "Chaque élément vérifié. Bon travail.",
      "Checklist verrouillée et vérifiée. Impeccable.",
      "Feuille propre. Bien exécuté.",
      "Toutes les étapes confirmées. La discipline se voit.",
    ],
    en: [
      "Checklist complete. Confirmed.",
      "All boxes ticked. Clean.",
      "Every item verified. Good work.",
      "Checklist locked and verified. Nice and tidy.",
      "That's a clean sheet. Well executed.",
      "All steps confirmed. The discipline is showing.",
    ],
  },
  discipline: {
    tone: "calm",
    fr: [
      "Tout est vert. Discipline vérifiée.",
      "Tous les feux sont au vert. Tu as gagné le droit de trader.",
      "Accès complet accordé. Le process a payé.",
      "La discipline est bonne. L'edge du jour est protégé.",
      "Tu as fait le travail. Les règles sont respectées. Vas-y.",
      "Tout est aligné. Ton process est solide aujourd'hui.",
    ],
    en: [
      "All green. Discipline verified.",
      "Every gate is open. You've earned the right to trade.",
      "Full clearance granted. The process paid off.",
      "Discipline checks out. Today's edge is protected.",
      "You did the work. The rules are satisfied. Proceed.",
      "All systems aligned. Your process is sound today.",
    ],
  },
  initiate: {
    tone: "firm",
    fr: [
      "Séquence de verrouillage lancée.",
      "Compte à rebours démarré. Engage le plan.",
      "Verrouillage en cours. Le plan décide désormais.",
      "Séquence initiée. Plus de secondes pensées.",
      "Verrouillage engagé. Reste sur la checklist.",
    ],
    en: [
      "Locking sequence engaged.",
      "Countdown started. Commit to the plan.",
      "Locking in. The plan now decides.",
      "Sequence initiated. No second thoughts.",
      "Engaging lockdown. Stick to the checklist.",
    ],
  },
  lock: {
    tone: "firm",
    fr: [
      "Edge confirmé. Exécution mécanique. Rien d'autre.",
      "Edge verrouillé. Le plan décide. Pas toi.",
      "Verrouillé. C'est de l'exécution, plus d'émotion.",
      "Verrouillé. Le marché attendra ton setup.",
      "Plan verrouillé. La discipline avant l'impulsion.",
      "Verrouillé et chargé. Fais confiance au process.",
      "Journée verrouillée. Ton edge est désormais mécanique.",
    ],
    en: [
      "Edge confirmed. Mechanical execution. Nothing else.",
      "Edge locked. The plan decides. Not you.",
      "Locked in. Now it's execution, not emotion.",
      "Locked. The market will wait for your setup.",
      "Plan locked. Discipline over impulse.",
      "Locked and loaded. Trust the process.",
      "Day locked. Your edge is now mechanical.",
    ],
  },
  interference: {
    tone: "alert",
    fr: [
      "Interférence émotionnelle. Ferme ce chart.",
      "Non. C'est exactement comme ça qu'on détruit un compte.",
      "Tes émotions veulent trader. Refusé.",
      "C'est le FOMO qui parle. Éloigne-toi.",
      "Stop. La peur et la cupidité n'ont pas leur mot à dire.",
      "Arrête-toi. Vérifie-toi avant de regarder tes positions.",
      "Cette sensation est un signal pour ne rien faire.",
      "Alerte rouge : émotions sur le desk. Ferme tout.",
    ],
    en: [
      "Emotional interference. Close the chart.",
      "No. This is exactly how accounts die.",
      "Your emotions want to trade. Denied.",
      "That's the FOMO talking. Step away.",
      "Hold on. Fear and greed don't get a vote today.",
      "Stop. Check yourself before you check positions.",
      "That feeling is a signal to do nothing.",
      "Red alert: emotions on the desk. Close it.",
    ],
  },
  patience: {
    tone: "calm",
    fr: [
      "Protocole patience amélioré. Mode sniper.",
      "Bonne rétention. Mon edge travaille.",
      "La patience est récompensée. Les meilleurs setups attendent.",
      "Mode sniper actif. Un seul tir propre aujourd'hui.",
      "Mains stables. Plus tu attends, meilleur est le risque.",
      "Cette patience paiera en pips.",
      "Pas de précipitation. Le setup viendra à toi.",
    ],
    en: [
      "Patience protocol upgraded. Sniper mode.",
      "Good restraint. My edge is working.",
      "Patience rewarded. The best setups come to those who wait.",
      "Sniper mode active. One clean shot today.",
      "Steady hands. The longer you wait, the better the risk.",
      "That patience will pay in pips.",
      "No rush. The setup will present itself.",
    ],
  },
  editor: {
    tone: "firm",
    fr: [
      "Mode éditeur activé.",
      "Accès configuration accordé.",
      "Édition déverrouillée. Ajuste ton drill.",
      "Éditeur de templates ouvert. Règle-le à ton edge.",
      "Éditeur de checklist actif. Personnalise le protocole.",
    ],
    en: [
      "Editor mode engaged.",
      "Configuration access granted.",
      "Editing unlocked. Adjust your drill.",
      "Template editor open. Tune it to your edge.",
      "Checklist editor live. Make it yours.",
    ],
  },
  motivOk: {
    tone: "calm",
    fr: [
      "Bonne mentalité. C'est comme ça qu'on protège un compte.",
      "État d'esprit validé. Tu contrôles le récit.",
      "C'est exactement l'attitude qu'il faut.",
      "Mental verrouillé. Le plan peut avancer.",
    ],
    en: [
      "Right mindset. That's how accounts survive.",
      "Mindset checked. You control the narrative.",
      "That's the attitude. Exactly right.",
      "Mental state locked. The plan can move forward.",
    ],
  },
  fomo: {
    tone: "alert",
    fr: [
      "FOMO détecté. C'est l'ennemi de ton compte.",
      "Peur de manquer. L'émotion la plus coûteuse en trading.",
      "Cette envie d'entrer maintenant — c'est le piège.",
      "Rater un mouvement est plus sûr que de se faire piéger.",
      "Tiens la ligne. Le FOMO n'a jamais clôturé un trade gagnant.",
    ],
    en: [
      "FOMO detected. That's your account's enemy.",
      "Fear of missing out. The costliest emotion in trading.",
      "That urge to jump in now — it's the trap.",
      "Missing out is safer than getting trapped.",
      "Hold the line. FOMO has never closed a winning trade.",
    ],
  },
  win: {
    tone: "calm",
    fr: [
      "La fenêtre est ouverte. Setup d'abord, exécution ensuite.",
      "Le marché est vivant. La patience paie à partir d'ici.",
      "Fenêtre de trading ouverte. Laisse le plan trouver le trade.",
      "C'est l'heure — mais seulement pour ton edge.",
      "Fenêtre ouverte. Attends ton setup, rien d'autre.",
    ],
    en: [
      "The window is open. Setup first, then execution.",
      "Market's live. Patience pays from here.",
      "Trading window open. Let the plan find the trade.",
      "It's go time — but only for your edge.",
      "Window open. Wait for your setup, nothing else.",
    ],
  },
};
