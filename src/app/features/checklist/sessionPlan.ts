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
 *   1. le trader ÉCRIT des valeurs (pourquoi, sens, cible, zone, invalidation,
 *      risque) et, s'il le veut, un scénario B avec sa condition ;
 *   2. une fois verrouillé, le plan est GELÉ. Passer au scénario B écrit le
 *      matin reste immédiat ; tout autre changement exige un motif écrit, et
 *      il est horodaté ;
 *   3. les faits observables (trades du jour, pertes, fenêtre, R:R des
 *      niveaux) sont lus ou calculés, jamais demandés ;
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
export type Direction = "long" | "short";

/**
 * Le scénario B : écrit AVANT l'open, avec la condition qui le déclenche.
 * C'est ce qui distingue une adaptation prévue d'un retournement impulsif —
 * « si le prix clôture au-dessus de 21 600, je vise les EQH » n'est pas un
 * changement de plan, c'est le plan.
 */
export interface AltScenario {
  condition: string;
  bias: Direction | null;
  target: string;
  /** Facultative : sans zone propre, le scénario B reprend celle du A. */
  entry: string;
}

export interface SessionPlan {
  /** `none` = journée d'observation : décider de ne pas trader EST un plan. */
  bias: Bias | null;
  /**
   * POURQUOI ce biais — narratif HTF, contexte, PDA. Demandé parce qu'un biais
   * sans raison écrite se retourne au premier mouvement contraire.
   */
  narrative: string;
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
  alt: AltScenario;
}

/** Plan → Séance → Bilan → Close. Une seule direction, sauf les retours nommés. */
export type Phase = "plan" | "live" | "review" | "closed";

export type Scenario = "A" | "B";

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

/** Une réouverture du plan en séance : quand, et pourquoi — le motif est obligatoire. */
export interface PlanChange {
  at: string;
  reason: string;
}

export interface SessionDay {
  v: 2;
  phase: Phase;
  plan: SessionPlan;
  mood: EmotionalState | null;
  /** Heure locale (`HH:MM`) du dernier verrouillage. */
  lockedAt: string | null;
  /** Les réouvertures du plan EN SÉANCE — la trace des changements de biais. */
  planChanges: PlanChange[];
  /** Scénario actif ; B ne s'active qu'en séance, et seulement s'il était écrit. */
  scenario: Scenario;
  scenarioAt: string | null;
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

export type PlanField =
  | "bias"
  | "narrative"
  | "target"
  | "entry"
  | "invalidation"
  | "risk"
  | "altCondition"
  | "altBias"
  | "altTarget"
  | "mood";

export interface DayDefaults {
  risk: string;
  maxTrades: number;
}

export const MAX_TRADES_CHOICES = [1, 2, 3] as const;

/**
 * Longueur minimale du motif d'un changement de plan en séance. Assez pour
 * obliger une phrase (« le prix a clôturé au-dessus de l'invalidation »), trop
 * court pour devenir un pensum — le but est la pause, pas la punition.
 */
export const MIN_CHANGE_REASON = 12;

/** Secondes d'attente avant de pouvoir confirmer un changement de plan en séance. */
export const CHANGE_COOLDOWN_S = 15;

const clampTrades = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : 1;
  return Math.min(MAX_TRADES_CHOICES[MAX_TRADES_CHOICES.length - 1], Math.max(1, v));
};

const emptyAlt = (): AltScenario => ({ condition: "", bias: null, target: "", entry: "" });

export function emptyPlan(defaults: DayDefaults): SessionPlan {
  return {
    bias: null,
    narrative: "",
    target: "",
    entry: "",
    invalidation: "",
    risk: defaults.risk,
    maxTrades: clampTrades(defaults.maxTrades),
    alt: emptyAlt(),
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
    scenario: "A",
    scenarioAt: null,
    endReason: null,
    endedAt: null,
    review: { respected: null, breaches: [], note: "" },
    locked: false,
    checked: planSteps(plan, null),
  };
}

/* ══ Nombres saisis à la main ══ */

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

/**
 * Le premier prix d'un niveau écrit librement : « FVG 21 520 » → 21520,
 * « 21,450 EQL » → 21450, « 1.0850 » → 1.085. La virgule suivie d'exactement
 * trois chiffres est un séparateur de milliers (écriture anglaise), sinon une
 * décimale (écriture française). `null` quand le niveau ne contient pas de prix.
 */
export function levelPrice(raw: string): number | null {
  const m = raw.match(/\d[\d\s.,]*/);
  if (!m) return null;
  let s = m[0].replace(/\s/g, "").replace(/[.,]$/, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/* ══ Validation du plan ══ */

const filled = (s: string) => s.trim().length > 0;

/** Le scénario B est-il engagé ? Un seul champ rempli suffit à le rendre exigeant. */
export const altStarted = (alt: AltScenario) =>
  alt.bias !== null || filled(alt.condition) || filled(alt.target) || filled(alt.entry);

export const altComplete = (alt: AltScenario) =>
  alt.bias !== null && filled(alt.condition) && filled(alt.target);

/** Ce qui manque pour verrouiller, dans l'ordre de saisie. */
export function missingFields(plan: SessionPlan, mood: EmotionalState | null): PlanField[] {
  const out: PlanField[] = [];
  if (plan.bias === null) out.push("bias");
  // Journée d'observation : ni cible, ni zone, ni risque — il n'y aura pas
  // d'entrée. Seul l'état reste demandé : c'est aussi un fait de la journée.
  if (plan.bias === "long" || plan.bias === "short") {
    if (!filled(plan.narrative)) out.push("narrative");
    if (!filled(plan.target)) out.push("target");
    if (!filled(plan.entry)) out.push("entry");
    if (!filled(plan.invalidation)) out.push("invalidation");
    if (parseAmount(plan.risk) === null) out.push("risk");
    // Un scénario B à moitié écrit est pire que pas de scénario : c'est un
    // retournement déguisé. Commencé, il doit être complet.
    if (altStarted(plan.alt)) {
      if (!filled(plan.alt.condition)) out.push("altCondition");
      if (plan.alt.bias === null) out.push("altBias");
      if (!filled(plan.alt.target)) out.push("altTarget");
    }
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
    filled(plan.narrative),
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

/* ══ Lecture des niveaux : R:R et cohérence ══ */

/**
 * Le R:R que les niveaux ÉCRITS promettent : distance à la cible / distance à
 * l'invalidation. `null` dès qu'un des trois niveaux n'a pas de prix, ou que
 * l'entrée est collée à l'invalidation.
 */
export function planRR(plan: Pick<SessionPlan, "entry" | "target" | "invalidation">) {
  const e = levelPrice(plan.entry);
  const t = levelPrice(plan.target);
  const i = levelPrice(plan.invalidation);
  if (e === null || t === null || i === null || e === i) return null;
  return Math.abs(t - e) / Math.abs(e - i);
}

/**
 * Ce qui cloche dans les niveaux — signalé, jamais bloquant :
 * - `targetSide` / `invSide` : cible ou invalidation du mauvais côté de
 *   l'entrée pour le sens choisi (souvent une faute de frappe, parfois un plan
 *   qui n'en est pas un) ;
 * - `rrLow` : R:R sous le minimum du plan de trading.
 */
export type PlanWarning = "targetSide" | "invSide" | "rrLow";

export function planWarnings(plan: SessionPlan, minRR: number | null): PlanWarning[] {
  if (plan.bias !== "long" && plan.bias !== "short") return [];
  const e = levelPrice(plan.entry);
  const t = levelPrice(plan.target);
  const i = levelPrice(plan.invalidation);
  const up = plan.bias === "long";
  const out: PlanWarning[] = [];
  if (e !== null && t !== null && (up ? t <= e : t >= e)) out.push("targetSide");
  if (e !== null && i !== null && (up ? i >= e : i <= e)) out.push("invSide");
  const rr = planRR(plan);
  if (out.length === 0 && rr !== null && minRR !== null && minRR > 0 && rr < minRR) {
    out.push("rrLow");
  }
  return out;
}

/** Le plan en vigueur : le scénario B remplace sens, cible et (s'il en a une) zone. */
export function activePlan(day: Pick<SessionDay, "plan" | "scenario">): SessionPlan {
  const { plan } = day;
  if (day.scenario !== "B" || !altComplete(plan.alt)) return plan;
  return {
    ...plan,
    bias: plan.alt.bias,
    target: plan.alt.target,
    entry: filled(plan.alt.entry) ? plan.alt.entry : plan.entry,
  };
}

/* ══ Transitions ══ */

export type DayAction =
  | { type: "setPlan"; patch: Partial<SessionPlan> }
  | { type: "setAlt"; patch: Partial<AltScenario> }
  | { type: "setMood"; mood: EmotionalState | null }
  | { type: "lock"; at: string }
  | { type: "reopenPlan"; at: string; reason: string }
  | { type: "switchScenario"; at: string }
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
 * GELÉS — `setPlan`, `setAlt` et `setMood` ne font rien. En séance, deux
 * chemins seulement :
 *
 * - `switchScenario` : passer au B écrit le matin. Immédiat, car prévu.
 * - `reopenPlan` : tout autre changement. Refusé sans motif d'au moins
 *   `MIN_CHANGE_REASON` caractères ; rouvre sans rien effacer et garde le
 *   motif horodaté pour le bilan.
 */
export function reduceDay(day: SessionDay, action: DayAction): SessionDay {
  switch (action.type) {
    case "setPlan": {
      if (day.phase !== "plan") return day;
      const plan = { ...day.plan, ...action.patch };
      plan.maxTrades = clampTrades(plan.maxTrades);
      return withSteps({ ...day, plan });
    }
    case "setAlt":
      if (day.phase !== "plan") return day;
      return withSteps({
        ...day,
        plan: { ...day.plan, alt: { ...day.plan.alt, ...action.patch } },
      });
    case "setMood":
      if (day.phase !== "plan") return day;
      return withSteps({ ...day, mood: action.mood });
    case "lock":
      if (day.phase !== "plan" || !canLock(day.plan, day.mood)) return day;
      return { ...day, phase: "live", locked: true, lockedAt: action.at };
    case "reopenPlan":
      if (day.phase !== "live" || action.reason.trim().length < MIN_CHANGE_REASON) return day;
      return {
        ...day,
        phase: "plan",
        locked: false,
        // Le plan rouvert repart du A : un nouveau verrou, un nouveau point de départ.
        scenario: "A",
        scenarioAt: null,
        planChanges: [...day.planChanges, { at: action.at, reason: action.reason.trim() }],
      };
    case "switchScenario":
      if (day.phase !== "live" || day.scenario === "B" || !altComplete(day.plan.alt)) return day;
      return { ...day, scenario: "B", scenarioAt: action.at };
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
const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
const isPhase = (v: unknown): v is Phase =>
  v === "plan" || v === "live" || v === "review" || v === "closed";
const isBias = (v: unknown): v is Bias => v === "long" || v === "short" || v === "none";
const isDirection = (v: unknown): v is Direction => v === "long" || v === "short";
const isEndReason = (v: unknown): v is EndReason =>
  v === "missed" || v === "invalidated" || v === "done";
const isBreach = (v: unknown): v is Breach => (BREACHES as readonly unknown[]).includes(v);

function readPlan(raw: unknown, defaults: DayDefaults): SessionPlan {
  const p = obj(raw);
  const a = obj(p.alt);
  return {
    bias: isBias(p.bias) ? p.bias : null,
    narrative: str(p.narrative),
    target: str(p.target),
    entry: str(p.entry),
    invalidation: str(p.invalidation),
    risk: typeof p.risk === "string" ? p.risk : defaults.risk,
    maxTrades: clampTrades(p.maxTrades ?? defaults.maxTrades),
    alt: {
      condition: str(a.condition),
      bias: isDirection(a.bias) ? a.bias : null,
      target: str(a.target),
      entry: str(a.entry),
    },
  };
}

function readChanges(raw: unknown): PlanChange[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x): PlanChange[] => {
    // Première version : l'heure seule, sans motif.
    if (typeof x === "string") return [{ at: x, reason: "" }];
    const o = obj(x);
    return typeof o.at === "string" ? [{ at: o.at, reason: str(o.reason) }] : [];
  });
}

function readReview(raw: unknown): SessionReview {
  const rev = obj(raw);
  return {
    respected: typeof rev.respected === "boolean" ? rev.respected : null,
    breaches: Array.isArray(rev.breaches) ? rev.breaches.filter(isBreach) : [],
    note: str(rev.note),
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
  let phase: Phase = isPhase(r.phase) ? r.phase : "plan";
  // Un plan incomplet ne peut pas être en séance, quelle que soit la source.
  if (phase !== "plan" && !canLock(plan, mood)) phase = "plan";
  const scenario: Scenario =
    r.scenario === "B" && phase !== "plan" && altComplete(plan.alt) ? "B" : "A";
  return {
    v: 2,
    phase,
    plan,
    mood,
    lockedAt: typeof r.lockedAt === "string" ? r.lockedAt : null,
    planChanges: readChanges(r.planChanges),
    scenario,
    scenarioAt: scenario === "B" && typeof r.scenarioAt === "string" ? r.scenarioAt : null,
    endReason: isEndReason(r.endReason) ? r.endReason : null,
    endedAt: typeof r.endedAt === "string" ? r.endedAt : null,
    review: readReview(r.review),
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
    scenario: day.scenario,
    scenarioAt: day.scenarioAt,
    endReason: day.endReason,
    endedAt: day.endedAt,
    review: day.review,
  };
}

/** Ce qu'une séance passée apporte à l'historique et à la mémoire. */
export interface PastSession {
  date: string;
  plan: SessionPlan;
  scenario: Scenario;
  /** Le bilan, s'il a été clos ce jour-là. */
  review: SessionReview | null;
}

/**
 * Une séance stockée, ou `null` si elle n'a pas été préparée avec ce moteur
 * ou n'a jamais été verrouillée (un brouillon de plan n'est pas un plan).
 */
export function sessionFromSnapshot(date: string, snapshot: unknown): PastSession | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  if (s.v !== 2 || s.phase === "plan" || !isPhase(s.phase)) return null;
  const plan = readPlan(s.plan, { risk: "", maxTrades: 1 });
  if (plan.bias === null) return null;
  return {
    date,
    plan,
    scenario: s.scenario === "B" && altComplete(plan.alt) ? "B" : "A",
    review: s.phase === "closed" ? readReview(s.review) : null,
  };
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
 * - `direction` : un trade dans un sens qu'aucun scénario écrit ne prévoyait
 *   (une fois le B activé, ses deux sens sont prévus) ;
 * - `extra` : un trade au-delà du maximum fixé le matin ;
 * - `observation` : un trade un jour déclaré sans trade.
 *
 * L'heure d'entrée n'est PAS comparée à la fenêtre : la fenêtre est réglée
 * dans un fuseau choisi, l'heure d'un trade est saisie ou importée dans un
 * autre, et un écart « avant l'ouverture » faux serait pire que pas d'écart.
 * Le trader le déclare lui-même au bilan (`window`).
 */
export type TradeBreach = "direction" | "extra" | "observation";

export function tradeBreaches(
  trade: Trade,
  index: number,
  plan: SessionPlan,
  scenario: Scenario = "A",
): TradeBreach[] {
  if (plan.bias === "none") return ["observation"];
  const allowed = new Set<string>([plan.bias ?? ""]);
  if (scenario === "B" && plan.alt.bias) allowed.add(plan.alt.bias);
  const out: TradeBreach[] = [];
  if ((trade.direction === "long" || trade.direction === "short") && !allowed.has(trade.direction))
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
  days: readonly Pick<PastSession, "date" | "plan" | "scenario">[],
  trades: readonly Trade[],
): PlanHistory {
  const sums = { in: { n: 0, s: 0 }, off: { n: 0, s: 0 } };
  const seen = new Set<string>();
  for (const { date, plan, scenario } of days) {
    if (seen.has(date)) continue;
    seen.add(date);
    dayFacts(trades, date).trades.forEach((t, i) => {
      const r = measuredR(t);
      if (r === null) return;
      const bucket = tradeBreaches(t, i, plan, scenario).length === 0 ? sums.in : sums.off;
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

/* ══ Mémoire : ce que les séances passées ont à dire à celle-ci ══ */

export interface SessionMemory {
  /** La leçon écrite au dernier bilan clos — relue avant d'écrire le plan suivant. */
  lastLesson: { date: string; note: string } | null;
  /**
   * L'écart le plus souvent déclaré, sur les bilans clos. Un COMPTE, pas une
   * statistique : il n'est rendu qu'à partir de `MIN_BUCKET_SAMPLE` bilans.
   */
  topBreach: { breach: Breach; count: number; sessions: number } | null;
}

/**
 * Le contenu qui change d'un jour à l'autre : c'est ce qui empêche le plan de
 * devenir machinal. On n'écrit pas le même plan en relisant la leçon d'hier.
 */
export function sessionMemory(past: readonly PastSession[]): SessionMemory {
  const closed = past
    .filter((p): p is PastSession & { review: SessionReview } => p.review !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const withNote = closed.find((p) => p.review.note.trim().length > 0);
  const counts = new Map<Breach, number>();
  for (const p of closed)
    for (const b of new Set(p.review.breaches)) {
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
  let top: SessionMemory["topBreach"] = null;
  if (closed.length >= MIN_BUCKET_SAMPLE) {
    for (const b of BREACHES) {
      const c = counts.get(b) ?? 0;
      if (c > 0 && (top === null || c > top.count))
        top = { breach: b, count: c, sessions: closed.length };
    }
  }
  return {
    lastLesson: withNote ? { date: withNote.date, note: withNote.review.note.trim() } : null,
    topBreach: top,
  };
}

/* ══ La porte d'entrée ══ */

/**
 * Les variables qu'une question d'entrée peut citer. Elles sont remplacées par
 * les valeurs du plan EN VIGUEUR : « Prix dans ta zone : {entry} ? » devient
 * « Prix dans ta zone : FVG 21 520 ? ». C'est ce qui empêche la question de
 * devenir machinale — on compare le prix à un chiffre, on ne répond pas « oui »
 * par réflexe.
 */
export const GATE_TOKENS = ["bias", "target", "entry", "inv", "risk"] as const;
export type GateToken = (typeof GATE_TOKENS)[number];

export function fillGate(text: string, values: Readonly<Record<GateToken, string>>): string {
  return text.replace(/\{(bias|target|entry|inv|risk)\}/g, (_, k: GateToken) =>
    values[k].trim() ? values[k].trim() : "—",
  );
}

export interface GateQuestion {
  id: string;
  /** Le texte tel que le trader l'a écrit, variables comprises. */
  text: string;
}

export function gateQuestions(titles: readonly string[]): GateQuestion[] {
  return titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `q-${i}`, text }));
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
