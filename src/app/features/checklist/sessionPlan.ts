/**
 * Le plan de séance — moteur PUR de la checklist.
 *
 * POURQUOI CE MODULE REMPLACE LES CASES À COCHER
 * ----------------------------------------------
 * L'ancienne checklist demandait de cocher « J'ai une DoL claire ». Au bout de
 * quelques semaines, la case se coche toute seule : elle ne contient rien, elle
 * ne protège donc de rien. Les journaux montrent le même enchaînement, jour
 * après jour : la bonne lecture le matin, puis une décision prise EN SÉANCE
 * (retourner son biais, chasser une entrée, reprendre un trade) qui la défait.
 *
 * Le moteur déplace donc la décision AVANT l'ouverture et la rend vérifiable :
 *
 *   1. le trader ÉCRIT des valeurs (sens, cible, zone, invalidation, risque),
 *      pas des « oui » ;
 *   2. une fois verrouillé, le plan est GELÉ : le modifier en séance reste
 *      possible, mais passe par une action nommée qui est horodatée ;
 *   3. les faits observables (trades du jour, pertes, fenêtre) sont lus, pas
 *      demandés ;
 *   4. chaque trade du jour est comparé au plan écrit, sans interprétation.
 *
 * Le module ne fait aucune IO et ne lit aucune horloge : l'heure est passée par
 * l'appelant. C'est ce qui permet de tester chaque transition.
 */

import { measuredR, type Trade } from "@/domain/trade";
import { MIN_BUCKET_SAMPLE } from "@/domain/quantStats";
import { isEmotionalState, type EmotionalState } from "@/app/trading/readiness";

/* ══ Modèle ══ */

export type Bias = "long" | "short" | "none";

export interface SessionPlan {
  /** `none` = journée d'observation : décider de ne pas trader EST un plan. */
  bias: Bias | null;
  /** La liquidité visée (DoL), dans les mots du trader : « 21 450 EQH ». */
  target: string;
  /** Le niveau clé / la zone où l'entrée est autorisée. */
  entry: string;
  /** Le prix qui invalide le plan. Touché = séance finie, pas de retournement. */
  invalidation: string;
  /** Risque par trade, en devise du compte, saisi tel quel (« 250 », « 1 000 »). */
  risk: string;
  /** Nombre maximal de trades pour la séance. */
  maxTrades: number;
}

/** Plan → Séance → Bilan → Close. Une seule direction, sauf les deux retours nommés. */
export type Phase = "plan" | "live" | "review" | "closed";

/** Pourquoi la séance s'est arrêtée — trois sorties, toutes volontaires. */
export type EndReason = "missed" | "invalidated" | "done";

/** Écarts déclarés au bilan. Vocabulaire fermé : il doit se compter. */
export const BREACHES = [
  "direction",
  "chased",
  "size",
  "extra",
  "window",
  "stopMoved",
  "planChanged",
] as const;
export type Breach = (typeof BREACHES)[number];

export interface SessionReview {
  /** `null` tant que le trader n'a pas répondu. */
  respected: boolean | null;
  breaches: Breach[];
  note: string;
}

export interface SessionDay {
  v: 2;
  phase: Phase;
  plan: SessionPlan;
  mood: EmotionalState | null;
  /** Heure locale (`HH:MM`) du dernier verrouillage. */
  lockedAt: string | null;
  /** Heures des réouvertures du plan EN SÉANCE — la trace des changements de biais. */
  planChanges: string[];
  endReason: EndReason | null;
  endedAt: string | null;
  review: SessionReview;
  /**
   * CONTRAT DE LECTURE — ne pas renommer. La série (`checklistStreak`), l'Edge
   * Score (`useEdgeScore`) et le tableau de bord lisent `locked` et `checked`
   * sous `tv-chk-{uid}-{date}`. `locked` = le plan a été verrouillé ce jour-là ;
   * `checked` = l'avancement du plan, élément par élément.
   */
  locked: boolean;
  checked: boolean[];
}

export type PlanField = "bias" | "target" | "entry" | "invalidation" | "risk" | "mood";

export interface DayDefaults {
  risk: string;
  maxTrades: number;
}

export const MAX_TRADES_CHOICES = [1, 2, 3] as const;

const clampTrades = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : 1;
  return Math.min(MAX_TRADES_CHOICES[MAX_TRADES_CHOICES.length - 1], Math.max(1, v));
};

export function emptyPlan(defaults: DayDefaults): SessionPlan {
  return {
    bias: null,
    target: "",
    entry: "",
    invalidation: "",
    risk: defaults.risk,
    maxTrades: clampTrades(defaults.maxTrades),
  };
}

export function emptyDay(defaults: DayDefaults): SessionDay {
  const plan = emptyPlan(defaults);
  return {
    v: 2,
    phase: "plan",
    plan,
    mood: null,
    lockedAt: null,
    planChanges: [],
    endReason: null,
    endedAt: null,
    review: { respected: null, breaches: [], note: "" },
    locked: false,
    checked: planSteps(plan, null),
  };
}

/* ══ Validation du plan ══ */

/**
 * Un montant saisi à la main : « 250 », « 1 000 », « 250,5 ». `null` si ce
 * n'est pas un nombre strictement positif — un risque nul n'est pas un risque
 * défini.
 */
export function parseAmount(raw: string): number | null {
  // `\s` couvre aussi les espaces insécables que `Intl` insère dans « 1 000 ».
  const v = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

const filled = (s: string) => s.trim().length > 0;

/** Ce qui manque pour verrouiller, dans l'ordre de saisie. */
export function missingFields(plan: SessionPlan, mood: EmotionalState | null): PlanField[] {
  const out: PlanField[] = [];
  if (plan.bias === null) out.push("bias");
  // Journée d'observation : ni cible, ni zone, ni risque — il n'y aura pas
  // d'entrée. Seul l'état reste demandé : c'est aussi un fait de la journée.
  if (plan.bias !== "none") {
    if (!filled(plan.target)) out.push("target");
    if (!filled(plan.entry)) out.push("entry");
    if (!filled(plan.invalidation)) out.push("invalidation");
    if (parseAmount(plan.risk) === null) out.push("risk");
  }
  if (mood === null) out.push("mood");
  return out;
}

export const canLock = (plan: SessionPlan, mood: EmotionalState | null) =>
  missingFields(plan, mood).length === 0;

/**
 * L'avancement, élément par élément — la valeur écrite dans `checked`.
 * Une journée d'observation n'a que deux éléments : le choix et l'état.
 */
export function planSteps(plan: SessionPlan, mood: EmotionalState | null): boolean[] {
  if (plan.bias === "none") return [true, mood !== null];
  return [
    plan.bias !== null,
    filled(plan.target),
    filled(plan.entry),
    filled(plan.invalidation),
    parseAmount(plan.risk) !== null,
    mood !== null,
  ];
}

/** États qui justifient de réduire la taille ou d'observer. Jugement produit, en un seul endroit. */
export const RISKY_MOODS: readonly EmotionalState[] = [
  "tired",
  "anxious",
  "frustrated",
  "overconfident",
];

/* ══ Transitions ══ */

export type DayAction =
  | { type: "setPlan"; patch: Partial<SessionPlan> }
  | { type: "setMood"; mood: EmotionalState | null }
  | { type: "lock"; at: string }
  | { type: "reopenPlan"; at: string }
  | { type: "end"; reason: EndReason; at: string }
  | { type: "setReview"; patch: Partial<SessionReview> }
  | { type: "close" }
  | { type: "reopenReview" }
  | { type: "reset"; defaults: DayDefaults };

const withSteps = (d: SessionDay): SessionDay => ({ ...d, checked: planSteps(d.plan, d.mood) });

/**
 * Le réducteur de la journée. Toute écriture de l'écran passe par lui.
 *
 * LA RÈGLE QUI COMPTE : hors de la phase « plan », le plan et l'état sont
 * GELÉS — `setPlan` et `setMood` ne font rien. Changer de biais en séance
 * exige `reopenPlan`, qui rouvre sans rien effacer et horodate le changement.
 * Le trader garde la main ; il ne peut simplement plus le faire sans le voir.
 */
export function reduceDay(day: SessionDay, action: DayAction): SessionDay {
  switch (action.type) {
    case "setPlan": {
      if (day.phase !== "plan") return day;
      const plan = { ...day.plan, ...action.patch };
      plan.maxTrades = clampTrades(plan.maxTrades);
      return withSteps({ ...day, plan });
    }
    case "setMood":
      if (day.phase !== "plan") return day;
      return withSteps({ ...day, mood: action.mood });
    case "lock":
      if (day.phase !== "plan" || !canLock(day.plan, day.mood)) return day;
      return { ...day, phase: "live", locked: true, lockedAt: action.at };
    case "reopenPlan":
      if (day.phase !== "live") return day;
      return {
        ...day,
        phase: "plan",
        locked: false,
        planChanges: [...day.planChanges, action.at],
      };
    case "end":
      if (day.phase !== "live") return day;
      return { ...day, phase: "review", endReason: action.reason, endedAt: action.at };
    case "setReview": {
      if (day.phase !== "review") return day;
      const review = { ...day.review, ...action.patch };
      // Plan respecté : aucun écart à déclarer.
      if (review.respected === true) review.breaches = [];
      return { ...day, review };
    }
    case "close":
      if (day.phase !== "review" || day.review.respected === null) return day;
      return { ...day, phase: "closed" };
    case "reopenReview":
      if (day.phase !== "closed") return day;
      return { ...day, phase: "review" };
    case "reset":
      return emptyDay(action.defaults);
  }
}

/* ══ Persistance ══ */

const str = (v: unknown) => (typeof v === "string" ? v : "");
const isPhase = (v: unknown): v is Phase =>
  v === "plan" || v === "live" || v === "review" || v === "closed";
const isBias = (v: unknown): v is Bias => v === "long" || v === "short" || v === "none";
const isEndReason = (v: unknown): v is EndReason =>
  v === "missed" || v === "invalidated" || v === "done";
const isBreach = (v: unknown): v is Breach => (BREACHES as readonly unknown[]).includes(v);

function readPlan(raw: unknown, defaults: DayDefaults): SessionPlan {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    bias: isBias(p.bias) ? p.bias : null,
    target: str(p.target),
    entry: str(p.entry),
    invalidation: str(p.invalidation),
    risk: typeof p.risk === "string" ? p.risk : defaults.risk,
    maxTrades: clampTrades(p.maxTrades ?? defaults.maxTrades),
  };
}

/**
 * Relit une journée stockée. Tout ce qui n'est pas une journée v2 — l'ancien
 * format à motivations et états FOMO, une entrée corrompue — repart d'une
 * journée vide : un plan ne se reconstruit pas à partir de cases cochées.
 */
export function normalizeDay(raw: unknown, defaults: DayDefaults): SessionDay {
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 2) {
    return emptyDay(defaults);
  }
  const r = raw as Record<string, unknown>;
  const plan = readPlan(r.plan, defaults);
  const mood = isEmotionalState(r.mood) ? r.mood : null;
  const rev = (r.review && typeof r.review === "object" ? r.review : {}) as Record<string, unknown>;
  let phase: Phase = isPhase(r.phase) ? r.phase : "plan";
  // Un plan incomplet ne peut pas être en séance, quelle que soit la source.
  if (phase !== "plan" && !canLock(plan, mood)) phase = "plan";
  return {
    v: 2,
    phase,
    plan,
    mood,
    lockedAt: typeof r.lockedAt === "string" ? r.lockedAt : null,
    planChanges: Array.isArray(r.planChanges)
      ? r.planChanges.filter((x): x is string => typeof x === "string")
      : [],
    endReason: isEndReason(r.endReason) ? r.endReason : null,
    endedAt: typeof r.endedAt === "string" ? r.endedAt : null,
    review: {
      respected: typeof rev.respected === "boolean" ? rev.respected : null,
      breaches: Array.isArray(rev.breaches) ? rev.breaches.filter(isBreach) : [],
      note: str(rev.note),
    },
    locked: phase !== "plan",
    checked: planSteps(plan, mood),
  };
}

/** Ce qui part dans `trading_sessions.checklist_snapshot` : la photo de la journée. */
export function toSnapshot(day: SessionDay): Record<string, unknown> {
  return {
    v: 2,
    phase: day.phase,
    plan: day.plan,
    mood: day.mood,
    lockedAt: day.lockedAt,
    planChanges: day.planChanges,
    endReason: day.endReason,
    endedAt: day.endedAt,
    review: day.review,
  };
}

/** Le plan d'une séance stockée, ou `null` si elle n'a pas été préparée avec ce moteur. */
export function planFromSnapshot(snapshot: unknown): SessionPlan | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as { v?: unknown; plan?: unknown; phase?: unknown };
  if (s.v !== 2 || s.phase === "plan") return null;
  const plan = readPlan(s.plan, { risk: "", maxTrades: 1 });
  return plan.bias === null ? null : plan;
}

/* ══ Faits du jour — lus, jamais demandés ══ */

export interface DayFacts {
  /** Trades du jour, dans l'ordre d'entrée. Les exemples d'onboarding sont exclus. */
  trades: Trade[];
  count: number;
  losses: number;
  /** Somme des R mesurés ; `null` dès qu'un trade n'a pas de risque connu. */
  r: number | null;
}

const byEntry = (a: Trade, b: Trade) =>
  (a.entryTime || "99:99").localeCompare(b.entryTime || "99:99");

export function dayFacts(trades: readonly Trade[], date: string): DayFacts {
  const day = trades.filter((t) => t.date === date && !t.isExample).sort(byEntry);
  let r: number | null = day.length > 0 ? 0 : null;
  for (const t of day) {
    const m = measuredR(t);
    r = r === null || m === null ? null : r + m;
  }
  return { trades: day, count: day.length, losses: day.filter((t) => t.pnl < 0).length, r };
}

/** Ce qui interdit une nouvelle entrée, du plus fort au plus faible. */
export type Blocker = "observation" | "maxTrades" | "stopAfterLosses" | "window";

export function entryBlockers(input: {
  plan: SessionPlan;
  facts: DayFacts;
  windowOpen: boolean;
  /** `limits.stopAfterLosses` du plan de trading ; 0 = pas de règle. */
  stopAfterLosses: number;
}): Blocker[] {
  const out: Blocker[] = [];
  if (input.plan.bias === "none") out.push("observation");
  if (input.facts.count >= input.plan.maxTrades) out.push("maxTrades");
  if (input.stopAfterLosses > 0 && input.facts.losses >= input.stopAfterLosses) {
    out.push("stopAfterLosses");
  }
  if (!input.windowOpen) out.push("window");
  return out;
}

/* ══ Conformité d'un trade au plan écrit ══ */

/**
 * Écarts OBSERVABLES entre un trade et le plan du jour. Volontairement
 * restreints à ce que les données prouvent :
 *
 * - `direction` : un long un jour de plan short, ou l'inverse ;
 * - `extra` : un trade au-delà du maximum fixé le matin ;
 * - `observation` : un trade un jour déclaré sans trade.
 *
 * L'heure d'entrée n'est PAS comparée à la fenêtre : la fenêtre est réglée
 * dans un fuseau choisi, l'heure d'un trade est saisie ou importée dans un
 * autre, et un écart « avant l'ouverture » faux serait pire que pas d'écart.
 * Le trader le déclare lui-même au bilan (`window`).
 */
export type TradeBreach = "direction" | "extra" | "observation";

export function tradeBreaches(trade: Trade, index: number, plan: SessionPlan): TradeBreach[] {
  if (plan.bias === "none") return ["observation"];
  const out: TradeBreach[] = [];
  if ((trade.direction === "long" || trade.direction === "short") && trade.direction !== plan.bias)
    out.push("direction");
  if (index >= plan.maxTrades) out.push("extra");
  return out;
}

/* ══ Historique : dans le plan / hors plan ══ */

export interface PlanBucket {
  /** Trades au R mesurable dans ce groupe. */
  n: number;
  /** R moyen — `null` sous l'échantillon minimum : on n'affiche pas de chiffre sur 3 trades. */
  avgR: number | null;
}

export interface PlanHistory {
  inPlan: PlanBucket;
  offPlan: PlanBucket;
  minSample: number;
}

/**
 * Le R moyen des trades conformes au plan écrit, face à celui des autres, sur
 * les journées passées préparées avec ce moteur. C'est le chiffre qui donne sa
 * valeur au rituel : il est calculé, il porte son `n`, et il ne dit rien de
 * plus qu'une association.
 */
export function planHistory(
  days: readonly { date: string; plan: SessionPlan }[],
  trades: readonly Trade[],
): PlanHistory {
  const sums = { in: { n: 0, s: 0 }, off: { n: 0, s: 0 } };
  const seen = new Set<string>();
  for (const { date, plan } of days) {
    if (seen.has(date)) continue;
    seen.add(date);
    dayFacts(trades, date).trades.forEach((t, i) => {
      const r = measuredR(t);
      if (r === null) return;
      const bucket = tradeBreaches(t, i, plan).length === 0 ? sums.in : sums.off;
      bucket.n += 1;
      bucket.s += r;
    });
  }
  const out = (b: { n: number; s: number }): PlanBucket => ({
    n: b.n,
    avgR: b.n >= MIN_BUCKET_SAMPLE ? b.s / b.n : null,
  });
  return { inPlan: out(sums.in), offPlan: out(sums.off), minSample: MIN_BUCKET_SAMPLE };
}

/* ══ La porte d'entrée ══ */

/**
 * Les questions posées au moment d'entrer. Les quatre premières reprennent le
 * plan ÉCRIT — l'écran les formule avec les valeurs du trader, ce qui les
 * empêche de devenir machinales : on compare le prix à un chiffre, on ne
 * répond pas « oui » par réflexe. Les critères personnels suivent.
 */
export type GateKind = "direction" | "entry" | "stop" | "size" | "custom";

export interface GateQuestion {
  id: string;
  kind: GateKind;
  /** Pour `custom` : le critère tel que le trader l'a écrit. */
  text?: string;
}

export function gateQuestions(customTitles: readonly string[]): GateQuestion[] {
  const fixed: GateQuestion[] = [
    { id: "direction", kind: "direction" },
    { id: "entry", kind: "entry" },
    { id: "stop", kind: "stop" },
    { id: "size", kind: "size" },
  ];
  const custom = customTitles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `custom-${i}`, kind: "custom" as const, text }));
  return [...fixed, ...custom];
}

export type GateVerdict = "pending" | "go" | "no";

/** Un seul « non » suffit : la porte ne négocie pas. */
export function gateVerdict(
  questions: readonly GateQuestion[],
  answers: Readonly<Record<string, boolean | undefined>>,
): GateVerdict {
  if (questions.some((q) => answers[q.id] === false)) return "no";
  return questions.every((q) => answers[q.id] === true) ? "go" : "pending";
}
