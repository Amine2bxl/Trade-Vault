/* ════════════════════════════════════════════════════════════════
   Pre-Market Checklist — data model, default content (FR + EN) and
   one-click templates. The page picks the default set matching the
   user's app language; everything stays fully editable afterwards.
   ════════════════════════════════════════════════════════════════ */

export interface ChkItem {
  title: string;
  desc: string;
}
export interface MotivOpt {
  text: string;
  ok: boolean; // true = process-driven motivation (the only valid one)
  msg: string;
}
export interface Mantra {
  text: string;
  why: string;
}
export interface FomoState {
  label: string;
  msg: string;
}
export interface CycleStep {
  label: string;
  text: string;
  type: "ok" | "warn" | "bad";
}
export interface ChkConfig {
  items: ChkItem[];
  motivs: MotivOpt[];
  fomo: FomoState[]; // exactly 4 states: calm / focused / impatient / fomo
  mantras: Mantra[];
  quotes: string[];
  missions: string[];
  signalsGo: string[];
  signalsStop: string[];
  signalsWait: string[];
  cycle: CycleStep[];
  cycleAlert: string;
  startTime: string; // "HH:MM"
  timeZone: string;
  countdown: number; // lock countdown seconds
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/* ══ FR defaults ══ */
const FR: Omit<ChkConfig, "startTime" | "timeZone" | "countdown"> = {
  items: [
    {
      title: "Heure de début atteinte",
      desc: "Zéro entrée avant ce signal. Même si le setup semble parfait. Même si le prix bouge.",
    },
    {
      title: "J'ai une DoL claire identifiée",
      desc: "Direction de liquidité nette sur HTF. Pas de « peut-être ». Oui ou non.",
    },
    {
      title: "Setup qualité ≥ 4 confirmé",
      desc: "CISD + FVG + MSS alignés. Si j'hésite sur la qualité, c'est un 3 → pas de trade.",
    },
    {
      title: "SL placé sur la structure d'abord",
      desc: "Je place le SL sur le niveau PDA/STL/OB. Le nombre de contrats suit. Jamais l'inverse.",
    },
    {
      title: "Je ne trade pas pour me prouver quelque chose",
      desc: "Si l'envie de trader est plus forte que le signal → pas de trade. L'envie est un signal d'alarme.",
    },
    {
      title: "Pas de loss déjà prise aujourd'hui",
      desc: "1 trade par jour max. Si j'ai perdu ce matin → chart fermé. Journée terminée.",
    },
  ],
  motivs: [
    {
      text: "Setup A+ complet — tous mes critères sont alignés, je suis le plan.",
      ok: true,
      msg: "Motivation validée. C'est la seule raison acceptable d'entrer : le plan a parlé, tu exécutes. Rien d'autre.",
    },
    {
      text: "Le prix bouge fort, je ne veux pas rater le mouvement.",
      ok: false,
      msg: "INTERFÉRENCE DÉTECTÉE — FOMO. Le mouvement que tu as « raté » n'était pas le tien. Le prochain setup A+ le sera. Ferme le chart 5 minutes.",
    },
    {
      text: "Je veux récupérer ma perte / finir positif aujourd'hui.",
      ok: false,
      msg: "INTERFÉRENCE DÉTECTÉE — REVENGE TRADING. Le marché ne sait pas que tu as perdu. Tu ne récupères rien, tu recreuses. Journée terminée.",
    },
    {
      text: "Je n'ai pas encore tradé aujourd'hui, il me faut un trade.",
      ok: false,
      msg: "INTERFÉRENCE DÉTECTÉE — IMPATIENCE. Zéro trade est une position rentable. Ton edge n'a pas besoin de toi aujourd'hui si le setup n'existe pas.",
    },
    {
      text: "Je le sens bien — intuition, feeling.",
      ok: false,
      msg: "INTERFÉRENCE DÉTECTÉE — INTUITION ÉMOTIONNELLE. Ton « feeling » est statistiquement ton pire conseiller. Les critères, rien que les critères.",
    },
  ],
  fomo: [
    {
      label: "Calme",
      msg: "État idéal. Tu es dans l'observation froide. Chaque signal est analysé sans émotion. C'est ici que les bons trades naissent. Reste dans cet état.",
    },
    {
      label: "Attentif",
      msg: "Légère activation. Tu commences à t'intéresser à ce que le marché fait. Reste observateur. Ne te précipite pas — le setup n'est peut-être pas encore là.",
    },
    {
      label: "Impatient",
      msg: "Danger. Ton cerveau émotionnel s'active. STOP. Est-ce que tous mes critères sont cochés ? Si non → mains loin du clavier.",
    },
    {
      label: "FOMO",
      msg: "ALERTE ROUGE. C'est l'état dans lequel tu fais tes pires trades. L'urgence que tu ressens est exactement ce que tu ne dois PAS suivre. Ferme le chart immédiatement.",
    },
  ],
  mantras: [
    {
      text: "« Le trade raté est du capital mental préservé. »",
      why: "Chaque trade non-pris qui n'était pas A+ = argent économisé.",
    },
    {
      text: "« L'envie de trader est un signal d'alarme, pas d'entrée. »",
      why: "Si tu ressens l'urgence → c'est FOMO. Ferme le chart.",
    },
    {
      text: "« Je n'exécute pas pour gagner. J'exécute mon processus. »",
      why: "Le résultat est une conséquence, pas un verdict sur ta valeur.",
    },
    {
      text: "« Structure d'abord. SL ensuite. Contrats en dernier. »",
      why: "L'ordre de ces 3 étapes détermine la qualité du trade.",
    },
    {
      text: "« Mon edge est prouvé. Je dois juste l'attendre. »",
      why: "L'edge existe. Le seul travail est l'attente.",
    },
  ],
  quotes: [
    "Tu n'es pas payé pour trader. Tu es payé pour attendre le bon trade.",
    "Le marché transfère l'argent des impatients vers les patients.",
    "Un trade raté ne coûte rien. Un mauvais trade coûte deux fois : ton capital et ta confiance.",
    "La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.",
    "Ton edge ne fonctionne que si tu le laisses fonctionner.",
    "Le meilleur trader n'est pas celui qui gagne le plus, c'est celui qui viole le moins ses règles.",
    "Chaque règle respectée est un dépôt sur ton compte de confiance.",
    "Le marché sera encore là demain. Ton capital, seulement si tu le protèges aujourd'hui.",
    "N'importe qui peut entrer. Les professionnels savent quand ne pas entrer.",
    "La patience n'est pas l'art d'attendre. C'est l'art de rester lucide en attendant.",
  ],
  missions: [
    "Accepter de ne prendre aucun trade aujourd'hui si aucun setup A+ ne se présente.",
    "Attendre 2 minutes complètes après avoir identifié un setup avant d'agir.",
    "Ne pas regarder le PnL pendant le trade. Structure seulement.",
    "Fermer le chart immédiatement après le trade du jour — gagné ou perdu.",
    "Verbaliser à voix haute la raison d'entrée avant de cliquer.",
    "Zéro chart avant l'heure de début. Préparation mentale d'abord.",
    "Noter ton état émotionnel avant ET après le trade.",
    "Si le prix part sans toi : écrire « le marché ne me doit rien » et fermer.",
  ],
  signalsGo: [
    "Heure de début confirmée",
    "DoL nette HTF",
    "Setup ≥ 4 + confluence",
    "SL sur structure",
    "Calme / observateur",
    "Premier trade du jour",
  ],
  signalsStop: [
    "Prix parti sans toi",
    "Tu as déjà eu une loss",
    "Tu ressens du FOMO",
    "Avant l'heure de début",
    "« Envie » de trader",
    "Setup ≤ 3",
  ],
  signalsWait: [
    "DoL peu claire",
    "Confluences incomplètes",
    "Tu hésites sur la qualité",
    "SL pas sur niveau clé",
    "Tu te demandes si c'est bon",
    "Marché en range",
  ],
  cycle: [
    { label: "Analyse OK", text: "Bonne lecture pre-market", type: "ok" },
    { label: "Tension monte", text: "Prix bouge sans toi", type: "warn" },
    { label: "Micro-ratio", text: "« C'est si clair… »", type: "warn" },
    { label: "Entrée hors plan", text: "Trop tôt, SL serré", type: "bad" },
    { label: "Stop out", text: "Prix continue après", type: "bad" },
    { label: "Journal lucide", text: "Tu sais pourquoi. Retour à 1.", type: "ok" },
  ],
  cycleAlert:
    "Si tu reconnais être à l'étape 2 ou 3 → ferme le chart maintenant, pas dans 30 secondes.",
};

/* ══ EN defaults ══ */
const EN: Omit<ChkConfig, "startTime" | "timeZone" | "countdown"> = {
  items: [
    {
      title: "Session start time reached",
      desc: "Zero entries before this signal. Even if the setup looks perfect. Even if price is moving.",
    },
    {
      title: "Clear draw on liquidity identified",
      desc: 'Net liquidity direction on HTF. No "maybe". Yes or no.',
    },
    {
      title: "Setup quality ≥ 4 confirmed",
      desc: "CISD + FVG + MSS aligned. If I hesitate about the quality, it's a 3 → no trade.",
    },
    {
      title: "SL placed on structure first",
      desc: "I put the SL on the PDA/STL/OB level. Contract size follows. Never the other way around.",
    },
    {
      title: "I am not trading to prove something",
      desc: "If the urge to trade is stronger than the signal → no trade. The urge is an alarm signal.",
    },
    {
      title: "No loss taken today",
      desc: "1 trade per day max. If I lost this morning → chart closed. Day over.",
    },
  ],
  motivs: [
    {
      text: "Complete A+ setup — all my criteria are aligned, I follow the plan.",
      ok: true,
      msg: "Motivation validated. This is the only acceptable reason to enter: the plan spoke, you execute. Nothing else.",
    },
    {
      text: "Price is moving fast, I don't want to miss the move.",
      ok: false,
      msg: 'INTERFERENCE DETECTED — FOMO. The move you "missed" was not yours. The next A+ setup will be. Close the chart for 5 minutes.',
    },
    {
      text: "I want to recover my loss / finish green today.",
      ok: false,
      msg: "INTERFERENCE DETECTED — REVENGE TRADING. The market doesn't know you lost. You recover nothing, you dig deeper. Day over.",
    },
    {
      text: "I haven't traded yet today, I need a trade.",
      ok: false,
      msg: "INTERFERENCE DETECTED — IMPATIENCE. Zero trades is a profitable position. Your edge doesn't need you today if the setup doesn't exist.",
    },
    {
      text: "It feels right — intuition, gut feeling.",
      ok: false,
      msg: 'INTERFERENCE DETECTED — EMOTIONAL INTUITION. Your "feeling" is statistically your worst advisor. Criteria, nothing but criteria.',
    },
  ],
  fomo: [
    {
      label: "Calm",
      msg: "Ideal state. Cold observation mode. Every signal is analyzed without emotion. This is where good trades are born. Stay here.",
    },
    {
      label: "Focused",
      msg: "Slight activation. You're starting to care about what the market does. Stay an observer. Don't rush — the setup may not be there yet.",
    },
    {
      label: "Impatient",
      msg: "Danger. Your emotional brain is firing. STOP. Are all my criteria checked? If not → hands off the keyboard.",
    },
    {
      label: "FOMO",
      msg: "RED ALERT. This is the state where you take your worst trades. The urgency you feel is exactly what you must NOT follow. Close the chart now.",
    },
  ],
  mantras: [
    {
      text: '"A missed trade is preserved mental capital."',
      why: "Every skipped trade that wasn't A+ = money saved.",
    },
    {
      text: '"The urge to trade is an alarm signal, not an entry signal."',
      why: "If you feel urgency → it's FOMO. Close the chart.",
    },
    {
      text: '"I don\'t execute to win. I execute my process."',
      why: "The result is a consequence, not a verdict on your worth.",
    },
    {
      text: '"Structure first. SL second. Contracts last."',
      why: "The order of these 3 steps determines the quality of the trade.",
    },
    {
      text: '"My edge is proven. I just have to wait for it."',
      why: "The edge exists. The only job is the wait.",
    },
  ],
  quotes: [
    "You are not paid to trade. You are paid to wait for the right trade.",
    "The market transfers money from the impatient to the patient.",
    "A missed trade costs nothing. A bad trade costs twice: your capital and your confidence.",
    "Discipline is choosing between what you want now and what you want most.",
    "Your edge only works if you let it work.",
    "The best trader isn't the one who wins the most, it's the one who breaks his rules the least.",
    "Every rule respected is a deposit into your confidence account.",
    "The market will still be there tomorrow. Your capital, only if you protect it today.",
    "Anyone can enter. Professionals know when not to enter.",
    "Patience is not the art of waiting. It's the art of staying lucid while waiting.",
  ],
  missions: [
    "Accept taking zero trades today if no A+ setup shows up.",
    "Wait 2 full minutes after identifying a setup before acting.",
    "Don't look at PnL during the trade. Structure only.",
    "Close the chart immediately after the trade of the day — win or lose.",
    "Say the entry reason out loud before clicking.",
    "Zero charts before the start time. Mental preparation first.",
    "Write down your emotional state before AND after the trade.",
    'If price leaves without you: write "the market owes me nothing" and close.',
  ],
  signalsGo: [
    "Start time confirmed",
    "Clear HTF draw on liquidity",
    "Setup ≥ 4 + confluence",
    "SL on structure",
    "Calm / observing",
    "First trade of the day",
  ],
  signalsStop: [
    "Price left without you",
    "You already took a loss",
    "You feel FOMO",
    "Before the start time",
    '"Urge" to trade',
    "Setup ≤ 3",
  ],
  signalsWait: [
    "Unclear draw on liquidity",
    "Incomplete confluences",
    "You hesitate on quality",
    "SL not on a key level",
    "You wonder if it's good",
    "Ranging market",
  ],
  cycle: [
    { label: "Analysis OK", text: "Good pre-market read", type: "ok" },
    { label: "Tension rises", text: "Price moves without you", type: "warn" },
    { label: "Rationalizing", text: '"It\'s so clear…"', type: "warn" },
    { label: "Off-plan entry", text: "Too early, tight SL", type: "bad" },
    { label: "Stopped out", text: "Price continues after", type: "bad" },
    { label: "Lucid journal", text: "You know why. Back to 1.", type: "ok" },
  ],
  cycleAlert: "If you recognize yourself at step 2 or 3 → close the chart now, not in 30 seconds.",
};

export function defaultConfigFor(lang: string): ChkConfig {
  const base = lang === "fr" ? FR : EN;
  return {
    ...structuredClone(base),
    startTime: "09:49",
    timeZone: localTimeZone(),
    countdown: 5,
  };
}

/* ══ One-click templates ══ */
export interface ChkTemplate {
  id: string;
  name: string;
  items: ChkItem[];
}

export function templatesFor(lang: string): ChkTemplate[] {
  if (lang === "fr") {
    return [
      { id: "ict", name: "ICT / Smart Money", items: FR.items },
      {
        id: "simple",
        name: "Essentiel — 3 critères",
        items: [
          {
            title: "Mon setup exact est présent",
            desc: "Tous les critères de mon plan, sans exception.",
          },
          {
            title: "SL sur structure, taille calculée",
            desc: "Le risque est défini avant l'entrée, pas après.",
          },
          {
            title: "Je suis calme et je suis le plan",
            desc: "Aucune urgence, aucune émotion aux commandes.",
          },
        ],
      },
      {
        id: "swing",
        name: "Swing Trader",
        items: [
          {
            title: "Biais HTF confirmé (D/W)",
            desc: "La structure daily et weekly pointent dans la même direction.",
          },
          {
            title: "Prix dans ma zone d'intérêt",
            desc: "Zone marquée à l'avance — pas dessinée après coup.",
          },
          {
            title: "Pas de news majeure sous 24h",
            desc: "FOMC, NFP, CPI : je connais le calendrier.",
          },
          { title: "Plan d'entrée écrit", desc: "Entrée, SL, TP écrits AVANT de cliquer." },
          { title: "R:R ≥ 3", desc: "Sinon le trade ne paie pas son risque sur la durée." },
          {
            title: "Alerte posée, chart fermé",
            desc: "Le marché me préviendra. Pas besoin de fixer l'écran.",
          },
        ],
      },
      {
        id: "prop",
        name: "Prop Firm — Risque",
        items: [
          {
            title: "Drawdown journalier vérifié",
            desc: "Je connais ma marge restante exacte avant d'entrer.",
          },
          {
            title: "Risque ≤ 0.5% du compte",
            desc: "Taille calculée depuis le SL, jamais l'inverse.",
          },
          {
            title: "Pas de news rouge dans 15 min",
            desc: "Spread et slippage tuent les comptes fundés.",
          },
          {
            title: "Max 2 trades aujourd'hui",
            desc: "Au-delà, c'est de l'overtrading statistique.",
          },
          {
            title: "Journal à jour",
            desc: "Le trade précédent est loggé avant d'en prendre un nouveau.",
          },
          {
            title: "Perte acceptée à l'avance",
            desc: "Je peux perdre ce trade sans que ça change mon état.",
          },
        ],
      },
    ];
  }
  return [
    { id: "ict", name: "ICT / Smart Money", items: EN.items },
    {
      id: "simple",
      name: "Essential — 3 checks",
      items: [
        { title: "My exact setup is present", desc: "Every criterion of my plan, no exceptions." },
        {
          title: "SL on structure, size computed",
          desc: "Risk is defined before the entry, not after.",
        },
        {
          title: "I am calm and following the plan",
          desc: "No urgency, no emotion at the controls.",
        },
      ],
    },
    {
      id: "swing",
      name: "Swing Trader",
      items: [
        {
          title: "HTF bias confirmed (D/W)",
          desc: "Daily and weekly structure point the same way.",
        },
        {
          title: "Price inside my zone of interest",
          desc: "Zone marked in advance — not drawn after the fact.",
        },
        { title: "No major news within 24h", desc: "FOMC, NFP, CPI: I know the calendar." },
        { title: "Written entry plan", desc: "Entry, SL, TP written BEFORE clicking." },
        { title: "R:R ≥ 3", desc: "Otherwise the trade doesn't pay for its risk long-term." },
        {
          title: "Alert set, chart closed",
          desc: "The market will notify me. No screen-staring needed.",
        },
      ],
    },
    {
      id: "prop",
      name: "Prop Firm — Risk",
      items: [
        {
          title: "Daily drawdown checked",
          desc: "I know my exact remaining margin before entering.",
        },
        { title: "Risk ≤ 0.5% of account", desc: "Size computed from the SL, never the reverse." },
        { title: "No red news within 15 min", desc: "Spread and slippage kill funded accounts." },
        { title: "Max 2 trades today", desc: "Beyond that it's statistical overtrading." },
        { title: "Journal up to date", desc: "Previous trade logged before taking a new one." },
        {
          title: "Loss accepted in advance",
          desc: "I can lose this trade without it changing my state.",
        },
      ],
    },
  ];
}

/* ══ Patience ranks ══ */
export function ranksFor(lang: string): { ranks: [number, string][]; descs: string[] } {
  if (lang === "fr") {
    return {
      ranks: [
        [0, "NIVEAU 0 — INITIALISATION"],
        [3, "NIVEAU 1 — OBSERVATEUR"],
        [10, "NIVEAU 2 — SNIPER"],
        [20, "NIVEAU 3 — MACHINE"],
        [40, "NIVEAU MAX — EDGE INCARNÉ"],
      ],
      descs: [
        "Chaque minute passée à observer sans agir renforce ton edge. La patience est une position.",
        "Tu observes. Le marché ne te contrôle pas. Continue.",
        "Mode sniper actif. Tu ne tires qu'une fois, sur la cible parfaite.",
        "Exécution mécanique. L'émotion n'a plus accès au poste de pilotage.",
        "Tu es devenu l'attente elle-même. L'edge travaille pour toi.",
      ],
    };
  }
  return {
    ranks: [
      [0, "LEVEL 0 — INITIALIZATION"],
      [3, "LEVEL 1 — OBSERVER"],
      [10, "LEVEL 2 — SNIPER"],
      [20, "LEVEL 3 — MACHINE"],
      [40, "MAX LEVEL — EDGE EMBODIED"],
    ],
    descs: [
      "Every minute spent observing without acting strengthens your edge. Patience is a position.",
      "You observe. The market doesn't control you. Keep going.",
      "Sniper mode active. You only shoot once, at the perfect target.",
      "Mechanical execution. Emotion no longer has cockpit access.",
      "You have become the wait itself. The edge works for you.",
    ],
  };
}

/* ══ Coach prompts (sent to the in-app AI coach) ══ */
export function coachPromptsFor(lang: string) {
  if (lang === "fr") {
    return {
      analyze:
        "Analyse mon dernier trade et dis-moi quelle erreur de mon plan j'ai commise, en te basant sur mes trades.",
      fomo: "J'ai ressenti du FOMO aujourd'hui pendant ma préparation pre-market. Aide-moi à comprendre ce qui s'est passé dans ma tête et comment l'éviter la prochaine fois.",
      loss: "J'ai fait une loss aujourd'hui. Aide-moi à identifier l'erreur exacte et à éviter de la répéter.",
      errors:
        "Donne-moi un résumé de mes 3 erreurs les plus récurrentes dans mes trades et un plan d'action pour chacune.",
      interference:
        "Ma checklist pre-market vient de détecter une motivation émotionnelle (pas process). Aide-moi à me recentrer avant de faire une bêtise.",
    };
  }
  return {
    analyze:
      "Analyze my latest trade and tell me which mistake from my plan I made, based on my trades.",
    fomo: "I felt FOMO today during my pre-market prep. Help me understand what happened in my head and how to avoid it next time.",
    loss: "I took a loss today. Help me identify the exact mistake and avoid repeating it.",
    errors:
      "Give me a summary of my 3 most recurring mistakes in my trades and an action plan for each.",
    interference:
      "My pre-market checklist just flagged an emotional (non-process) motivation. Help me re-center before I do something stupid.",
  };
}
