/* ════════════════════════════════════════════════════════════════
   Pre-Market Checklist — data model, default content (FR + EN) and
   one-click templates. The page picks the default set matching the
   user's app language; everything stays fully editable afterwards.
   ════════════════════════════════════════════════════════════════ */

export interface ChkItem {
  title: string;
  desc: string;
  /**
   * Off-days it without deleting it. Optional so every previously stored
   * config keeps working (undefined === enabled). Disabled items are hidden
   * from the daily run and ignored by the gates.
   */
  enabled?: boolean;
}

/** An item counts for the daily run unless it was explicitly disabled. */
export const isItemOn = (it: ChkItem): boolean => it.enabled !== false;
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
  /**
   * Version des questions d'entrée. Absente ou < `GATE_VERSION` : la liste
   * date d'avant le plan de séance et passe par `migrateConfig`.
   */
  gateV?: number;
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
    items: templateItems("essential", lang),
    startTime: "09:49",
    timeZone: localTimeZone(),
    countdown: 5,
    gateV: GATE_VERSION,
  };
}

/* ════════════════════════════════════════════════════════════════
   Questions d'entrée — posées par la porte au moment d'entrer.

   Les quatre questions « du plan » citent les valeurs écrites le matin via
   des variables ({bias}, {target}, {entry}, {inv}, {risk}, voir
   `sessionPlan.fillGate`). Chaque modèle les reprend, puis ajoute les
   critères de sa méthode. Tout reste éditable : un modèle est un point de
   départ, pas un gabarit imposé.
   ════════════════════════════════════════════════════════════════ */

export const GATE_VERSION = 2;

export type GateTemplateId = "essential" | "ict" | "priceAction" | "orderFlow";
export const GATE_TEMPLATES: readonly GateTemplateId[] = [
  "essential",
  "ict",
  "priceAction",
  "orderFlow",
];

const q = (title: string): ChkItem => ({ title, desc: "" });

/** Les questions qui confrontent l'entrée au plan écrit — communes à tous les modèles. */
export function planQuestions(lang: string): ChkItem[] {
  return lang === "fr"
    ? [
        q("{bias} : dans le sens du plan ?"),
        q("Prix dans ta zone : {entry} ?"),
        q("Stop là où l'idée est fausse : {inv} ?"),
        q("Taille = {risk}, pas plus ?"),
      ]
    : [
        q("{bias}: in the plan's direction?"),
        q("Price in your zone: {entry}?"),
        q("Stop where the idea is wrong: {inv}?"),
        q("Size = {risk}, not more?"),
      ];
}

const METHOD: Record<GateTemplateId, { fr: string[]; en: string[] }> = {
  essential: {
    fr: ["Mon setup est complet, sans exception ?"],
    en: ["Is my setup complete, no exception?"],
  },
  ict: {
    fr: [
      "Liquidité prise (sweep) avant l'entrée ?",
      "Déplacement + MSS / CISD confirmé ?",
      "Entrée sur FVG / IFVG dans ma zone ?",
      "Dans la macro / l'heure prévue ?",
    ],
    en: [
      "Liquidity taken (sweep) before the entry?",
      "Displacement + MSS / CISD confirmed?",
      "Entry on an FVG / IFVG inside my zone?",
      "Inside the macro / planned time?",
    ],
  },
  priceAction: {
    fr: [
      "Niveau clé testé et rejeté ?",
      "Bougie de confirmation clôturée ?",
      "Structure dans le sens du biais ?",
    ],
    en: [
      "Key level tested and rejected?",
      "Confirmation candle closed?",
      "Structure in the bias direction?",
    ],
  },
  orderFlow: {
    fr: [
      "Absorption / delta dans le sens du plan ?",
      "Liquidité visée visible sur la heatmap ?",
      "VWAP / profil de volume en accord ?",
    ],
    en: [
      "Absorption / delta in the plan's direction?",
      "Targeted liquidity visible on the heatmap?",
      "VWAP / volume profile in agreement?",
    ],
  },
};

export function templateItems(id: GateTemplateId, lang: string): ChkItem[] {
  return [...planQuestions(lang), ...METHOD[id][lang === "fr" ? "fr" : "en"].map(q)];
}

/**
 * Critères de l'ancienne checklist que l'écran VÉRIFIE désormais lui-même
 * (fenêtre, pertes du jour) ou qui sont devenus des champs du plan (DoL).
 * Retirés à la migration — sur titre exact uniquement : un critère reformulé
 * par le trader lui appartient et reste.
 */
const AUTOMATED_TITLES = new Set([
  "Heure de début atteinte",
  "Heure de session atteinte",
  "J'ai une DoL claire identifiée",
  "Pas de loss déjà prise aujourd'hui",
  "Session start time reached",
  "Clear draw on liquidity identified",
  "No loss taken today",
]);

/** Amène une configuration d'avant le plan de séance au format des questions d'entrée. */
export function migrateConfig(cfg: ChkConfig, lang: string): ChkConfig {
  if ((cfg.gateV ?? 0) >= GATE_VERSION) return cfg;
  const kept = cfg.items.filter((it) => !AUTOMATED_TITLES.has(it.title.trim()));
  return { ...cfg, items: [...planQuestions(lang), ...kept], gateV: GATE_VERSION };
}

/* ════════════════════════════════════════════════════════════════
   Smart checklist generation.

   Instead of picking a fixed template, assemble a SHORT, bespoke list
   from the trader's onboarding profile — so it reads as written for
   *them*, never as a generic template. Deterministic (zero AI, can't
   fail), capped at 6 high-impact items, ordered prep → setup → risk →
   mindset, deduped by title.
   ════════════════════════════════════════════════════════════════ */

/** Onboarding subset the generator needs (matches OnboardingData). */
export interface ChkProfile {
  style?: string | null; // scalping | daytrading | swing | position
  experience?: string | null; // new | intermediate | seasoned | funded
  assets?: string[] | null; // forex | futures | stocks | options | crypto
  goal?: string | null; // consistency | prop_challenge | discipline | fulltime | side
  pain?: string | null; // emotions | consistency | overtrading | risk | journaling
  usesIct?: boolean | null;
  /* LES CHIFFRES DE L'ONBOARDING — facultatifs.
     Sans eux, la liste reste générique (« Max 1 trade »). Avec eux, chaque
     consigne reprend les limites que le trader vient de fixer : une checklist
     qui dit « max 4 trades » quand ses règles disent 4, pas 1. */
  /** Compte de prop firm (challenge ou financé) : le risque passe en tête. */
  prop?: boolean | null;
  riskPct?: number | null;
  maxTrades?: number | null;
  stopAfter?: number | null;
  /** Perte max du jour, DÉJÀ formatée dans la devise du compte. */
  dailyLoss?: string | null;
}

type Loc = { fr: ChkItem; en: ChkItem };
const pick = (l: Loc, fr: boolean) => (fr ? l.fr : l.en);

/** Market → sensible session start (falls back to the user's current config). */
function sessionTimeFor(primary?: string | null): { startTime: string; timeZone: string } {
  if (primary === "forex") return { startTime: "08:00", timeZone: "Europe/London" };
  if (primary === "futures" || primary === "stocks" || primary === "options")
    return { startTime: "09:30", timeZone: "America/New_York" };
  return { startTime: "09:30", timeZone: localTimeZone() };
}

export function generateChecklist(
  p: ChkProfile,
  lang: string,
): { items: ChkItem[]; startTime: string; timeZone: string } {
  const fr = lang === "fr";
  const style = p.style ?? "";
  const isSwing = style === "swing" || style === "position";
  const isScalp = style === "scalping";
  const funded = !!p.prop || p.experience === "funded" || p.goal === "prop_challenge";
  const primary = p.assets?.[0];
  // Les nombres s'écrivent dans la langue (« 0,5 » en français).
  const num = (n: number) => new Intl.NumberFormat(fr ? "fr" : "en").format(n);
  const riskTail =
    p.riskPct && p.riskPct > 0
      ? fr
        ? ` Max ${num(p.riskPct)} % du compte par trade.`
        : ` Max ${num(p.riskPct)}% of the account per trade.`
      : "";

  // Candidate blocks with a priority (higher = more important to keep).
  const candidates: { prio: number; item: ChkItem }[] = [];
  const add = (prio: number, loc: Loc) => candidates.push({ prio, item: pick(loc, fr) });

  // ── Prep: session start (always, phrased by market) ──
  add(100, {
    fr: {
      title: "Heure de session atteinte",
      desc: "Zéro entrée avant ce signal — même si le prix bouge. C'est la règle n°1.",
    },
    en: {
      title: "Session start time reached",
      desc: "No entry before this signal — even if price is moving. This is rule #1.",
    },
  });

  // ── Setup: the entry trigger (ICT-specific vs plan-specific) ──
  if (p.usesIct) {
    add(95, {
      fr: {
        title: "Draw on liquidity + setup ICT confirmé",
        desc: "DoL nette en HTF, puis CISD/FVG/MSS alignés. Si tu hésites sur la qualité → pas de trade.",
      },
      en: {
        title: "Draw on liquidity + ICT setup confirmed",
        desc: "Clear HTF DoL, then CISD/FVG/MSS aligned. If you hesitate on quality → no trade.",
      },
    });
  } else {
    add(95, {
      fr: {
        title: "Mon setup exact est présent",
        desc: "Tous les critères de MON plan sont réunis, sans exception. Un critère manquant = pas de trade.",
      },
      en: {
        title: "My exact setup is present",
        desc: "Every criterion of MY plan is met, no exceptions. One missing criterion = no trade.",
      },
    });
  }

  // ── Swing/position: HTF bias + news + alert (they don't sit at the screen) ──
  if (isSwing) {
    add(80, {
      fr: {
        title: "Biais HTF confirmé (D/W)",
        desc: "Daily et weekly pointent dans la même direction. Prix dans ma zone marquée à l'avance.",
      },
      en: {
        title: "HTF bias confirmed (D/W)",
        desc: "Daily and weekly agree. Price inside a zone I marked in advance, not after the fact.",
      },
    });
    add(60, {
      fr: {
        title: "Pas de news majeure sous 24h",
        desc: "FOMC, NFP, CPI : calendrier vérifié. Alerte posée, je peux fermer le chart.",
      },
      en: {
        title: "No major news within 24h",
        desc: "FOMC, NFP, CPI: calendar checked. Alert set — I can close the chart.",
      },
    });
  }

  // ── Scalping: pre-defined kill-time / no chasing ──
  if (isScalp) {
    add(58, {
      fr: {
        title: "Fenêtre d'exécution respectée",
        desc: "Je ne trade que ma plage horaire à edge. Hors fenêtre = zéro clic.",
      },
      en: {
        title: "Execution window respected",
        desc: "I only trade my edge time-window. Outside it = zero clicks.",
      },
    });
  }

  // ── Risk: always, sharpened by funded / risk pain ──
  if (funded || p.pain === "risk") {
    add(90, {
      fr: {
        title: "Risque défini AVANT l'entrée",
        desc: `SL sur la structure d'abord, taille calculée ensuite. Drawdown journalier vérifié.${riskTail}`,
      },
      en: {
        title: "Risk defined BEFORE the entry",
        desc: `SL on structure first, size computed after. Daily drawdown checked.${riskTail}`,
      },
    });
  } else {
    add(75, {
      fr: {
        title: "SL sur structure, taille calculée",
        desc: `Le risque est fixé avant l'entrée, jamais après. Le nombre de contrats suit le SL.${riskTail}`,
      },
      en: {
        title: "SL on structure, size computed",
        desc: `Risk is set before the entry, never after. Contract size follows the SL.${riskTail}`,
      },
    });
  }

  // ── Prop firm: the daily loss limit, in the account's own money ──
  if (funded && p.dailyLoss) {
    add(88, {
      fr: {
        title: `Perte max du jour connue : ${p.dailyLoss}`,
        desc: "Si je l'atteins, la journée est finie — avant que la firme ne décide pour moi.",
      },
      en: {
        title: `Daily loss limit known: ${p.dailyLoss}`,
        desc: "If I hit it, the day is over — before the firm decides for me.",
      },
    });
  }

  // ── Psychology block, keyed to the trader's stated weakness ──
  if (p.pain === "overtrading" || p.goal === "discipline") {
    const n = p.maxTrades && p.maxTrades > 0 ? p.maxTrades : null;
    add(
      85,
      n
        ? {
            fr: {
              title: `Max ${n} trade${n > 1 ? "s" : ""} aujourd'hui — je compte`,
              desc: `Au-delà de ${n}, le chart se ferme. Zéro trade est une position gagnante.`,
            },
            en: {
              title: `Max ${n} trade${n > 1 ? "s" : ""} today — I count them`,
              desc: `Past ${n}, the chart closes. Zero trades is a winning position.`,
            },
          }
        : {
            fr: {
              title: "Max 1 trade — pas de loss déjà prise",
              desc: "Une perte le matin = chart fermé, journée terminée. Zéro trade est une position gagnante.",
            },
            en: {
              title: "Max 1 trade — no loss taken yet",
              desc: "A morning loss = chart closed, day over. Zero trades is a winning position.",
            },
          },
    );
  }
  if (p.pain === "emotions") {
    const stop = p.stopAfter && p.stopAfter > 0 ? p.stopAfter : null;
    add(82, {
      fr: {
        title: "Je ne trade pas pour me prouver quelque chose",
        desc: `Si l'envie de trader est plus forte que le signal → c'est une alarme, pas une entrée.${
          stop ? ` Après ${stop} perte${stop > 1 ? "s" : ""}, j'arrête pour la journée.` : ""
        }`,
      },
      en: {
        title: "I'm not trading to prove something",
        desc: `If the urge to trade is stronger than the signal → it's an alarm, not an entry.${
          stop ? ` After ${stop} loss${stop > 1 ? "es" : ""}, I stop for the day.` : ""
        }`,
      },
    });
  }
  if (p.pain === "consistency" || p.goal === "consistency") {
    add(70, {
      fr: {
        title: "Je suis le plan, pas l'improvisation",
        desc: "Aujourd'hui = une copie propre de mon process. Aucune décision inventée en direct.",
      },
      en: {
        title: "I follow the plan, not improvisation",
        desc: "Today = a clean copy of my process. No decisions invented on the fly.",
      },
    });
  }
  if (p.pain === "journaling") {
    add(55, {
      fr: {
        title: "Trade précédent journalisé",
        desc: "Le dernier trade est loggé (raison, état, erreur) avant d'en envisager un nouveau.",
      },
      en: {
        title: "Previous trade journaled",
        desc: "The last trade is logged (reason, state, mistake) before considering a new one.",
      },
    });
  }

  // ── Mindset close: always the last line ──
  add(50, {
    fr: {
      title: "Calme, lucide, prêt à ne rien faire",
      desc: "Mon edge est prouvé. Mon seul travail aujourd'hui est de l'attendre sans forcer.",
    },
    en: {
      title: "Calm, lucid, ready to do nothing",
      desc: "My edge is proven. My only job today is to wait for it without forcing.",
    },
  });

  // Keep the 6 highest-priority, de-duplicated by title, in a stable
  // prep → setup → risk → mindset reading order (priority already encodes it).
  const seen = new Set<string>();
  const items = candidates
    .sort((a, b) => b.prio - a.prio)
    .filter(({ item }) => (seen.has(item.title) ? false : seen.add(item.title)))
    .slice(0, 6)
    .sort((a, b) => b.prio - a.prio)
    .map(({ item }) => item);

  return { items, ...sessionTimeFor(primary) };
}
