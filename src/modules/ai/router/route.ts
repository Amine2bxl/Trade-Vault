/**
 * LE ROUTEUR UNIFIÉ DE JARVIS — comprendre la question AVANT de choisir quoi lire.
 *
 * ── CE QU'IL REMPLACE ──────────────────────────────────────────────────────
 * Jarvis classait la même question à trois endroits, avec trois lexiques qui ne
 * s'accordaient pas : `app/features/jarvis/intent.ts` (les étapes affichées
 * pendant l'analyse), `modules/ai/memory-select.ts` (quels souvenirs envoyer)
 * et `router/types.ts` (`AiIntent`, que rien n'alimentait). « Est-ce que je
 * respecte ma taille max ? » était du « risque » pour l'un et de la
 * « discipline » pour l'autre, et aucun ne décidait des DONNÉES à lire : le
 * client poussait tout, à chaque question.
 *
 * Un seul lexique maintenant, organisé par DOMAINE (multi-étiquettes : une
 * question peut toucher le journal ET le marché). Les anciennes vues sont
 * DÉRIVÉES de ce résultat, chacune avec son ordre de priorité explicite :
 * `uiIntent` pour les étapes affichées, `memoryIntent` pour la mémoire,
 * `aiIntent` pour la taxonomie de télémétrie.
 *
 * ── CE QU'IL DÉCIDE ────────────────────────────────────────────────────────
 *  - les DOMAINES touchés (journal, plan, objectifs, marché, produit…) ;
 *  - le NIVEAU de difficulté (1 simple → 4 analyse profonde), qui choisit le
 *    modèle (voir `runtime/tiers.ts`) ;
 *  - les ENTITÉS : période résolue depuis la date LOCALE du trader, période de
 *    comparaison, jours de semaine, symboles, sessions ;
 *  - s'il est AMBIGU — seul cas où un petit modèle est consulté.
 *
 * ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────────────
 * Aucun appel réseau, aucun modèle, aucune donnée du trader : module PUR,
 * importable côté navigateur ET serveur, testable exhaustivement. Une erreur de
 * routage coûte une donnée en trop ou en moins, jamais une donnée inventée :
 * le modèle garde ses outils pour aller chercher ce qui manque.
 */
import { todayLocalDate } from "@/shared/calendar-date";
import { detectWhatIf } from "@/modules/probability/intent";

// ── Taxonomie ────────────────────────────────────────────────────────────────

export type RouteDomain =
  /** Salutation, remerciement, bavardage — aucune donnée. */
  | "smalltalk"
  /** Comment fonctionne TradeVault, ses pages, ses prix, ses offres. */
  | "product"
  /** Un concept général de trading (« c'est quoi le drawdown ? »). */
  | "knowledge"
  /** Qui est le trader (nom, comptes, profil déclaré). */
  | "identity"
  /** Un trade précis (« mon dernier trade »). */
  | "trade"
  /** Une date ou une courte période précise (« hier », « le 12 »). */
  | "day"
  /** Résultats, statistiques, P&L sur une période. */
  | "performance"
  /** Deux périodes comparées. */
  | "comparison"
  /** Erreurs saisies, leur coût, leur tendance. */
  | "mistakes"
  /** État mental, émotions, tilt. */
  | "psychology"
  /** Taille, risque, stop, drawdown personnel. */
  | "risk"
  /** Plan de trading et tenue de la discipline. */
  | "plan"
  /** Règles et engagements que le trader se fixe. */
  | "rules"
  /** Objectifs, challenge, prop firm. */
  | "goals"
  /** « Et si… », probabilités — lues du moteur Monte-Carlo. */
  | "simulation"
  /** Calendrier économique, news, annonces macro. */
  | "market"
  /** Ce qui a été dit ou promis auparavant. */
  | "memory"
  /** Sessions, heures, fenêtres de marché. */
  | "sessions"
  /** Schémas récurrents, concentrations, habitudes. */
  | "patterns";

/** Les étapes affichées pendant l'analyse (anciennement `intent.ts`). */
export type UiIntent = "trade" | "day" | "performance" | "risk" | "psychology" | "goal" | "general";

/** L'intention MÉMOIRE (anciennement le classifieur de `memory-select.ts`). */
export type MemoryIntent =
  | "psychology"
  | "discipline"
  | "performance"
  | "goals"
  | "rules"
  | "generic";

/** Le niveau de difficulté — il choisit le modèle (voir `runtime/tiers.ts`). */
export type RouteTier = 1 | 2 | 3 | 4;

export interface Period {
  /** Bornes de dates de marché INCLUSES, `YYYY-MM-DD`, dans la date locale du trader. */
  since: string;
  until: string;
  /** Ce que le trader a dit (« ce mois », « septembre ») — pour la télémétrie et le prompt. */
  label: string;
  /** La nature de la période : une JOURNÉE nommée n'est pas « ce mois » réduit à un jour
   *  (le 1er du mois, « ce mois-ci » ne compte qu'une date — ce n'est pas une journée). */
  granularity: "day" | "week" | "month" | "year" | "range";
}

export interface RouteEntities {
  /** La période principale, quand la question en nomme une. */
  period?: Period;
  /** Deux périodes comparées, dans l'ordre chronologique. */
  comparison?: [Period, Period];
  /** Jours de semaine VISÉS comme schéma (1 = lundi … 7 = dimanche). */
  weekdays: number[];
  /** Symboles / instruments cités, normalisés en majuscules. */
  symbols: string[];
  /** Sessions de marché citées. */
  sessions: ("asia" | "london" | "newyork")[];
  /** Horizon futur demandé en heures (« dans les deux prochaines heures »). */
  horizonHours?: number;
}

export interface QuestionRoute {
  /** Domaines touchés, du plus spécifique au plus général. Jamais vide. */
  domains: RouteDomain[];
  /** Le domaine principal (premier de `domains`). */
  primary: RouteDomain;
  tier: RouteTier;
  entities: RouteEntities;
  /** La question demande une explication (« pourquoi », « why »), pas un chiffre. */
  asksWhy: boolean;
  /** La question porte sur les données PERSONNELLES du trader. */
  personal: boolean;
  /** 0..1 — à quel point le lexique a reconnu la question. */
  confidence: number;
  /** Rien de reconnu sur une vraie question : un petit modèle peut trancher. */
  ambiguous: boolean;
  uiIntent: UiIntent;
  memoryIntent: MemoryIntent;
  /** Étiquettes des motifs reconnus — pour la télémétrie, jamais le contenu. */
  signals: string[];
}

// ── Normalisation ────────────────────────────────────────────────────────────

/** Minuscules, sans accents, apostrophes unifiées : « Aujourd'hui » → « aujourd'hui ». */
export function normalizeQuestion(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Lexique, par domaine (texte NORMALISÉ : sans accents, minuscules) ───────

/**
 * Chaque domaine a ses motifs. Ils reprennent ceux des anciens classifieurs
 * (aucun mot n'a été perdu) et les rangent là où ils ont un sens : « taille »
 * est du RISQUE, et la vue mémoire le compte ensuite comme de la discipline.
 */
const LEXICON: Record<Exclude<RouteDomain, "smalltalk" | "knowledge" | "product">, RegExp> = {
  identity:
    /\b(mon (pre)?nom|my name|qui suis[- ]je|who am i|mon profil|my profile|mes comptes|my accounts|mon compte|my account|sous[- ]comptes?|sub[- ]?accounts?|mon abonnement|my subscription)\b/,
  trade:
    /\b(ce trade|this trade|dernier trade|last trade|mon trade|my trade|ce position|cette position|entrees?|entry|entries|sorties?|exits?|setups?)\b/,
  day: /\b(hier|yesterday|avant[- ]hier|aujourd'?hui|today|today's|ce matin|this morning|cette seance|today'?s session|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(\/\d{2,4})?|le \d{1,2}\b|notes?|note[sd]?|ecrit|wrote|written)\b/,
  performance:
    /(\bperformances?\b|\bwin ?rate\b|taux de r|\bp&l\b|\bpnl\b|\bprofit|\bresultats?\b|\bresults?\b|\bstats?\b|\bstatistiques?\b|\bedge\b|\bgagn|\bperd|\bpertes?\b|\bloss|\blos(e|ing|t)\b|\bmois\b|\bmonth|\bsemaine|\bweek|\bprogres|\bameliore?r?|\bexpectancy|esperance|profit factor|\brendement|\breturns?\b|\bequity|\bbilan|\breview|\bmauvais|\bbad\b|\bbon mois|\bgood month|\bmeilleur|\bbest\b|\bworst\b|\bpire\b|\bserie\b|\bstreak|\bchute|\bdrop|\btrade[sd]?\b)/,
  comparison:
    /(\bcompar|\bvs\.?\b|\bversus\b|\bentre .{2,40} et\b|\bbetween .{2,40} and\b|par rapport|\bchanged?\b|\bevolu|\bdifferen|mieux que|better than|worse than|pire que|qu'est-ce qui a change)/,
  mistakes:
    /(\berreurs?\b|\bmistakes?\b|\bfautes?\b|\bfomo\b|\brevenge\b|\bovertrad|\bsur-?trad|\btilt|\berrors?\b|\bleak)/,
  psychology:
    /(tilt|\bemotion|\bpeur\b|\bfear|\bstress|\banxi|\bconfian|\bconfiden|\bfomo\b|\bpanic|\bpaniqu|\brevenge\b|\bfrustr|\bmental|\bimpatien|discipline mentale|state of mind|\bmotivation|\bcolere|\banger)/,
  risk: /(\brisqu|\brisk|\bstop\b|\bstops\b|\btaille|\bsize|\bsizing|\blots?\b|\blevier|\bleverage|\bruine?\b|\bruin\b|\bdrawdown|perte max|max loss|\bexposition|\bexposure)/,
  plan: /(plan de trading|trading plan|\bmon plan\b|\bmy plan\b|\bdu plan\b|\bthe plan\b|\brespect|\btenu\b|\btenir\b|\bhold\b|\bfollow|\bsuivre|\bsuis-je\b|\badheren|\bdiscipline\b|\bchecklist|\broutine|\bprocess)/,
  rules:
    /(\bregles?\b|\brules?\b|\bengagements?\b|\bcommit|\bpromesse|\binterdit|m'imposer|\bimpose|\bjamais plus|\bnever again|\blimites?\b)/,
  goals:
    /(\bobjectifs?\b|\bgoals?\b|\btargets?\b|\bcibles?\b|\bchallenge|\bprop\b|\bprop firm|\bfunded|\bpass(er)?\b|\batteindre|\breach\b|\bevaluation)/,
  simulation:
    /(\bet si\b|\bwhat if\b|\bsimul|\bmonte ?carlo|\bprobabilit|\bchances? de\b|\bchances? to\b|risk of ruin|risque de ruine|si je risquais|if i risked|if i risk)/,
  market:
    /(\bnews\b|\bnouvelles?\b|\bannonces?\b|calendrier eco|economic calendar|\bfomc\b|\bcpi\b|\bnfp\b|non[- ]?farm|\bfed\b|\bbce\b|\becb\b|\binflation\b|\bpmi\b|\bgdp\b|\bpib\b|\bjobless|\bchomage|\bmacro|evenements? economiques?|economic events?|\breleases?\b|\bpublications?\b|prochaines? heures?|next (two |2 |few |couple of )?hours?|cette semaine .{0,20}(news|annonces?)|taux d'interet|interest rates?|rate decision|banque centrale|central bank)/,
  memory:
    /(je t'ai dit|i told you|tu m'as dit|you told me|on avait dit|we said|souviens|remember|rappelle[- ]moi|remind me|\bpromis\b|\bpromised\b|la derniere fois|last time)/,
  sessions:
    /(\bsessions?\b|\basie\b|\basia|\blondres\b|\blondon\b|new york|\bny\b|\bouverture\b|\bopen\b|kill ?zone|\bheures?\b|\bhours?\b|\bhoraires?\b|time of day|\bmatin\b|\bmorning\b|apres[- ]midi|\bafternoon\b)/,
  patterns:
    /(\bpatterns?\b|\bschemas?\b|\brecurren|\brecurring|\bhabitudes?\b|\bhabits?\b|\bconcentr|\bsouvent\b|\boften\b|\btendances?\b|\btrends?\b|\brepet|\bqu'est-ce qui me coute|\bwhat'?s costing|\bhurting|\bplombe|\bme coute)/,
};

const SMALLTALK =
  /^(salut|bonjour|bonsoir|hello|hi|hey|yo|coucou|wesh|good (morning|afternoon|evening)|ca va|comment ca va|how are you|merci|thanks|thank you|thx|merci beaucoup|top|parfait|super|nickel|ok|okay|d'accord|cool|bien recu|bonne nuit|a demain|bye)\b/;

const WHY =
  /(\bpourquoi\b|\bwhy\b|comment se fait|how come|\bexplique|\bexplain|\bcause|\braisons?\b|\breasons?\b|qu'est-ce qui (ne va pas|cloche|cloque)|what'?s wrong|\bprobleme|\bproblem|\bdiagnosti|\banalys|\bqu'est-ce qui me|what is hurting|what'?s hurting)/;

const DEEP =
  /(analyse complete|analyse approfondie|en profondeur|full review|full analysis|deep dive|in depth|bilan complet|audit complet|tout analyser|analyse tout|analyze everything|rapport complet|complete report|passe en revue tout)/;

/** Un pronom ou possessif à la 1re personne : la question parle du trader. */
const PERSONAL =
  /(\bmon\b|\bma\b|\bmes\b|\bje\b|\bj'|\bm'|\bmoi\b|\bmy\b|\bmine\b|\bi\b|\bi'm\b|\bi've\b|\bme\b|\bmyself\b|\bsuis[- ]je\b)/;

/** « C'est quoi… », « what is… » — une définition, pas une mesure. */
const DEFINITION =
  /^(c'est quoi|qu'est[- ]ce que|qu'est[- ]ce qu'|que veut dire|que signifie|definition|define|what is|what's|what are|explique[- ]moi|explain|comment (on )?calcule|how (do you|to) calculate|difference entre|difference between)/;

/** Concepts généraux — reconnus pour classer en « knowledge » plutôt qu'en données. */
const CONCEPTS =
  /(drawdown|order block|\bfvg\b|fair value gap|liquidit|\bict\b|\bsmc\b|risk[- ]?reward|\brr\b|expectancy|esperance|sharpe|sortino|profit factor|win ?rate|kelly|scalping|swing|spread|slippage|levier|leverage|\bpips?\b|\bticks?\b|contrats?|prop firm|funded|trailing|vwap|\bema\b|\brsi\b|support|resistance|break of structure|\bbos\b|\bchoch\b|kill ?zone|silver bullet|judas|power of 3|stop loss|take profit|position sizing|money management|gestion du risque|risk management|\bfutures?\b|\bforex\b|\boptions?\b|\bcfd\b|\bmarge\b|\bmargin\b)/;

/** Les noms des pages et fonctionnalités du produit. */
const FEATURES =
  /(tradevault|trade vault|jarvis|dashboard|tableau de bord|journal|calendrier|calendar|analytics|analyses?|coach|missed opportunit|occasions? manquees?|mistakes page|page erreurs|checklist|insights|economic news|news page|seasonality|saisonnalit|lot size|calculat|trading plan|plan de trading|goals page|page objectifs|monthly reports?|rapports? mensuels?|profil|settings|reglages|sub[- ]?accounts?|sous[- ]comptes?|replay|backtest|monte ?carlo|simulat|import|export|csv|pdf|notifications?|inbox|boite de reception|application|l'app\b|the app\b|plateforme|platform)/;

/** Une question sur le PRODUIT plutôt que sur les données. */
const PRODUCT_ASK =
  /(comment (ca |ce |cela )?(fonctionne|marche)|how (does|do|can) .{0,40}(work|use)|comment (utiliser|on utilise|je peux utiliser)|how to use|a quoi sert|what (is|does) .{0,30}(page|feature|for)|ou (est|se trouve|trouver)|where (is|can i find|do i find)|est-ce que tradevault|tradevault (a|possede|propose|fait|peut)|does tradevault|is there a|y a-t-il|il y a une? (page|fonction)|possede|propose|disponible|available|fonctionnalit|features?\b)/;

const PRICING =
  /(\bprix\b|\btarifs?\b|\bpricing\b|\bprice\b|combien (coute|ca coute|coute l'abonnement|est l'abonnement)|how much (is|does|for)|\babonnement\b|\bsubscription\b|plan gratuit|free plan|\bfree tier\b|offre gratuite|\bplan pro\b|\bpro plan\b|\belite\b|\bupgrade\b|\bpayant\b|\bpaid plan\b|\bessai gratuit\b|\bfree trial\b|\bannuler\b|\bcancel\b|\brembourse|\brefund)/;

// ── Entités ──────────────────────────────────────────────────────────────────

const MONTHS: [RegExp, number][] = [
  [/\b(janvier|january|jan)\b/, 1],
  [/\b(fevrier|february|feb)\b/, 2],
  [/\b(mars|march)\b/, 3],
  [/\b(avril|april|apr)\b/, 4],
  [/\b(mai|may)\b/, 5],
  [/\b(juin|june)\b/, 6],
  [/\b(juillet|july|jul)\b/, 7],
  [/\b(aout|august|aug)\b/, 8],
  [/\b(septembre|september|sept|sep)\b/, 9],
  [/\b(octobre|october|oct)\b/, 10],
  [/\b(novembre|november|nov)\b/, 11],
  [/\b(decembre|december|dec)\b/, 12],
];

const WEEKDAYS: [RegExp, number][] = [
  [/\b(lundis?|mondays?)\b/, 1],
  [/\b(mardis?|tuesdays?)\b/, 2],
  [/\b(mercredis?|wednesdays?)\b/, 3],
  [/\b(jeudis?|thursdays?)\b/, 4],
  [/\b(vendredis?|fridays?)\b/, 5],
  [/\b(samedis?|saturdays?)\b/, 6],
  [/\b(dimanches?|sundays?)\b/, 7],
];

/** Instruments reconnus sans ambiguïté, quelle que soit la casse. */
const SYMBOLS_ANYCASE =
  /\b(mnq|mes|mym|m2k|mcl|mgc|fdax|ger40|ger30|dax40|us30|us100|nas100|us500|spx500|spx|ndx|xauusd|xagusd|btcusd|ethusd|btcusdt|ethusdt|btc|eth|(?:eur|gbp|usd|aud|nzd|cad|chf|jpy)(?:eur|gbp|usd|aud|nzd|cad|chf|jpy))\b/gi;

/** Symboles courts qui sont AUSSI des mots (« es », « or »…) : majuscules seulement. */
const SYMBOLS_UPPER = /\b(NQ|ES|YM|RTY|CL|GC|SI|ZB|ZN|6E|6B|6J|DAX)\b/g;

const SESSIONS: [RegExp, "asia" | "london" | "newyork"][] = [
  [/\b(asie|asia|asian|tokyo|sydney)\b/, "asia"],
  [/\b(londres|london|europe|european)\b/, "london"],
  [
    /(new york|\bny\b|\bnyse\b|us session|session us|session americaine|american session)/,
    "newyork",
  ],
];

// ── Arithmétique de dates LOCALES (jamais `toISOString`) ─────────────────────

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** Une date `YYYY-MM-DD` construite à MIDI local : à l'abri des changements d'heure. */
function localNoon(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12);
}

function iso(y: number, m: number, d: number): string {
  return todayLocalDate(localNoon(y, m, d));
}

function addDays(dateIso: string, n: number): string {
  const { y, m, d } = parseIso(dateIso);
  return iso(y, m, d + n);
}

/** 1 = lundi … 7 = dimanche. */
function isoWeekday(dateIso: string): number {
  const { y, m, d } = parseIso(dateIso);
  const js = localNoon(y, m, d).getDay();
  return js === 0 ? 7 : js;
}

function monthPeriod(y: number, m: number, today: string, label: string): Period {
  const last = new Date(y, m, 0, 12).getDate();
  const until = iso(y, m, last);
  return { since: iso(y, m, 1), until: until > today ? today : until, label, granularity: "month" };
}

function validIso(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const back = iso(y, mo, d);
  return back === text ? back : null;
}

/**
 * Toutes les périodes nommées dans la question, dans l'ordre où elles
 * apparaissent. La première est la période principale ; deux périodes avec un
 * mot de comparaison font une comparaison.
 */
export function extractPeriods(q: string, today: string): Period[] {
  const { y: ty, m: tm, d: td } = parseIso(today);
  const found: { at: number; period: Period }[] = [];
  // Portions de texte déjà lues comme une date PRÉCISE (« le 15 septembre ») :
  // le mois seul ou « le 15 » nu ne doivent pas les relire autrement.
  const consumed: [number, number][] = [];
  const taken = (at: number, len: number) => consumed.some(([s, e]) => at < e && at + len > s);
  const push = (at: number, period: Period) => {
    if (period.since > period.until) return;
    if (found.some((f) => f.period.since === period.since && f.period.until === period.until))
      return;
    found.push({ at, period });
  };
  const each = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(q))) fn(m);
  };

  each(/\bavant[- ]hier\b|\bday before yesterday\b/, (m) =>
    push(m.index, {
      since: addDays(today, -2),
      until: addDays(today, -2),
      label: "2 days ago",
      granularity: "day",
    }),
  );
  each(/(?<!avant[- ])\bhier\b|\byesterday\b/, (m) =>
    push(m.index, {
      since: addDays(today, -1),
      until: addDays(today, -1),
      label: "yesterday",
      granularity: "day",
    }),
  );
  each(/\baujourd'?hui\b|\btoday\b|\bce matin\b|\bthis morning\b|\bcette seance\b/, (m) =>
    push(m.index, { since: today, until: today, label: "today", granularity: "day" }),
  );
  each(/\b(cette semaine|this week)\b/, (m) => {
    const monday = addDays(today, -(isoWeekday(today) - 1));
    push(m.index, { since: monday, until: today, label: "this week", granularity: "week" });
  });
  each(/\b(la semaine (derniere|passee)|semaine derniere|last week|previous week)\b/, (m) => {
    const thisMonday = addDays(today, -(isoWeekday(today) - 1));
    push(m.index, {
      since: addDays(thisMonday, -7),
      until: addDays(thisMonday, -1),
      label: "last week",
      granularity: "week",
    });
  });
  // « du mois » seul = ce mois-ci ; « du mois dernier », « du mois de
  // septembre » nomment un AUTRE mois, lu plus bas.
  each(
    /\b(ce mois(-ci)?|this month|du mois(?! (?:dernier|passe|precedent|d'|de\b))|mois en cours|current month)\b/,
    (m) => push(m.index, monthPeriod(ty, tm, today, "this month")),
  );
  each(
    /\b(le mois (dernier|passe)|mois dernier|mois precedent|last month|previous month)\b/,
    (m) => {
      const py = tm === 1 ? ty - 1 : ty;
      const pm = tm === 1 ? 12 : tm - 1;
      push(m.index, monthPeriod(py, pm, today, "last month"));
    },
  );
  each(/\b(cette annee|this year|depuis janvier|year to date|ytd)\b/, (m) =>
    push(m.index, { since: iso(ty, 1, 1), until: today, label: "this year", granularity: "year" }),
  );
  each(/\b(l'annee (derniere|passee)|annee derniere|last year)\b/, (m) =>
    push(m.index, {
      since: iso(ty - 1, 1, 1),
      until: iso(ty - 1, 12, 31),
      label: "last year",
      granularity: "year",
    }),
  );
  each(
    /\b(?:les |the )?(\d{1,3}) (?:derniers jours|last days|jours|days)\b|\blast (\d{1,3}) days\b/,
    (m) => {
      const n = Number(m[1] ?? m[2]);
      if (n >= 1 && n <= 1825)
        push(m.index, {
          since: addDays(today, -(n - 1)),
          until: today,
          label: `last ${n} days`,
          granularity: "range",
        });
    },
  );
  // Un JOUR nommé avec son mois (« le 15 septembre », « September 15th »,
  // « 1er octobre ») ou une PLAGE de jours (« du 1er au 15 septembre »,
  // « September 1-15 ») : une date précise, jamais le mois entier ni « le 15 »
  // du mois courant. Sans année : la date passée la plus récente.
  const dayIn = (year: number | null, month: number, day: number): string | null => {
    const at = (y: number) =>
      validIso(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    if (year !== null) return at(year);
    const thisYear = at(ty);
    return thisYear && thisYear <= today ? thisYear : at(ty - 1);
  };
  for (const [re, month] of MONTHS) {
    // `\b(septembre|september|sept|sep)\b` → `(?:septembre|september|sept|sep)`.
    const name = `(?:${re.source.replace(/^\\b\(|\)\\b$/g, "")})`;
    // Plages : FR « du 1er au 15 septembre », « entre le 3 et le 10 mars » ;
    // EN « September 1-15 », « September 1 to 15 ». Groupes : jour, jour, année.
    const rangeRes = [
      new RegExp(
        `\\b(?:du|entre le) (\\d{1,2})(?:er)? (?:au|et le) (\\d{1,2}) (?:de )?${name}\\b(?: (\\d{4}))?`,
        "g",
      ),
      new RegExp(
        `\\b${name} (\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|to|through|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`,
        "g",
      ),
    ];
    for (const rr of rangeRes)
      each(rr, (m) => {
        const year = m[3] ? Number(m[3]) : null;
        const from = dayIn(year, month, Number(m[1]));
        const to = dayIn(year, month, Number(m[2]));
        if (!from || !to || from > to) return;
        consumed.push([m.index, m.index + m[0].length]);
        push(m.index, {
          since: from,
          until: to > today ? today : to,
          label: m[0],
          granularity: "range",
        });
      });
    // Jours : FR « le 15 septembre », « 1er octobre » ; EN « September 15th ».
    // Groupes : jour, année.
    const dayRes = [
      new RegExp(
        `(?:\\b(?:le|du|au|the|on) )?\\b(\\d{1,2})(?:er|st|nd|rd|th)? (?:de |of )?${name}\\b(?: (\\d{4}))?`,
        "g",
      ),
      new RegExp(`\\b${name} (\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`, "g"),
    ];
    for (const dr of dayRes)
      each(dr, (m) => {
        if (taken(m.index, m[0].length)) return;
        const d = dayIn(m[2] ? Number(m[2]) : null, month, Number(m[1]));
        if (!d) return;
        consumed.push([m.index, m.index + m[0].length]);
        push(m.index, { since: d, until: d, label: m[0], granularity: "day" });
      });
  }
  // Mois nommés, avec année éventuelle. Sans année, le mois à venir est celui
  // de l'an dernier : « septembre » posé en août parle du septembre passé.
  for (const [re, month] of MONTHS) {
    each(new RegExp(`${re.source}(?:\\s+(\\d{4}))?`), (m) => {
      // Déjà lu comme un jour précis (« le 15 septembre ») : pas le mois entier.
      if (taken(m.index, m[0].length)) return;
      // Les formes courtes sont aussi des mots (« may » = pouvoir, « dec ») :
      // on ne les prend pour un mois que suivies d'une année ou précédées de
      // « en / in / de / du / of / mois de ».
      if (m[1].length <= 3 && !m[2]) {
        const before = q.slice(Math.max(0, m.index - 10), m.index);
        if (!/(\ben|\bin|\bde|\bdu|\bof|mois de|month of)\s+$/.test(before)) return;
      }
      const year = m[2] ? Number(m[2]) : month > tm ? ty - 1 : ty;
      push(m.index, monthPeriod(year, month, today, `${m[1]}${m[2] ? ` ${m[2]}` : ""}`));
    });
  }
  // Dates explicites.
  each(/\b(\d{4}-\d{2}-\d{2})\b/, (m) => {
    const d = validIso(m[1]);
    if (!d) return;
    consumed.push([m.index, m.index + m[0].length]);
    push(m.index, { since: d, until: d, label: d, granularity: "day" });
  });
  each(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
    // Jour d'abord (convention française du produit).
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : ty;
    if (year < 100) year += 2000;
    const at = (y: number) =>
      validIso(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    let d = at(year);
    // Sans année, la date passée la plus récente : « le 25/12 » posé le 5
    // janvier parle du Noël écoulé, pas du prochain.
    if (!m[3] && (!d || d > today)) d = at(ty - 1) ?? d;
    if (!d) return;
    // « le 12/09 » : la date entière, jamais « le 12 » du mois courant.
    consumed.push([m.index, m.index + m[0].length]);
    push(m.index, { since: d, until: d, label: d, granularity: "day" });
  });
  each(/\ble (\d{1,2})\b(?! (?:derniers|jours|days|trades?|fois|%|euros?|dollars?))/, (m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return;
    if (taken(m.index, m[0].length)) return;
    // « le 12 » : ce mois-ci si le jour est passé, sinon le mois précédent.
    const useMonth = day <= td ? tm : tm === 1 ? 12 : tm - 1;
    const useYear = day <= td ? ty : tm === 1 ? ty - 1 : ty;
    const d = validIso(
      `${useYear}-${String(useMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
    if (d) push(m.index, { since: d, until: d, label: `le ${day}`, granularity: "day" });
  });
  // Un jour de semaine QUALIFIÉ (« lundi dernier », « this monday ») est une
  // date ; un jour de semaine NU (« je perds le lundi ») est un schéma, traité
  // dans `extractWeekdays`.
  for (const [re, wd] of WEEKDAYS) {
    each(
      new RegExp(`(?:${re.source}\\s+(dernier|passe))|(?:(last|this|ce|cette)\\s+${re.source})`),
      (m) => {
        const cur = isoWeekday(today);
        const isThis = /^(this|ce|cette)$/.test(m[3] ?? "");
        let delta = cur - wd;
        if (delta < 0 || (!isThis && delta === 0)) delta += 7;
        const d = addDays(today, -delta);
        push(m.index, { since: d, until: d, label: m[0], granularity: "day" });
      },
    );
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.period);
}

/** Jours de semaine visés COMME SCHÉMA (« je perds le lundi », « on Fridays »). */
function extractWeekdays(q: string): number[] {
  const out: number[] = [];
  for (const [re, wd] of WEEKDAYS) {
    const m = new RegExp(re.source).exec(q);
    if (!m) continue;
    const after = q.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const before = q.slice(Math.max(0, m.index - 8), m.index);
    // Qualifié = une date précise, pas un schéma.
    if (/^\s+(dernier|passe)/.test(after) || /(last|this|ce|cette)\s+$/.test(before)) continue;
    out.push(wd);
  }
  return out;
}

export function extractSymbols(original: string): string[] {
  const out = new Set<string>();
  for (const m of original.matchAll(SYMBOLS_ANYCASE)) out.add(m[1].toUpperCase());
  for (const m of original.matchAll(SYMBOLS_UPPER)) out.add(m[1]);
  return [...out];
}

function extractHorizonHours(q: string): number | undefined {
  const m =
    /(?:prochaines?|next|dans les?)\s+(\d{1,2}|deux|two|trois|three|quelques|few|couple of)?\s*(?:prochaines?\s+)?(heures?|hours?)/.exec(
      q,
    );
  if (!m) return undefined;
  const words: Record<string, number> = {
    deux: 2,
    two: 2,
    trois: 3,
    three: 3,
    quelques: 3,
    few: 3,
    "couple of": 2,
  };
  const raw = m[1];
  if (!raw) return 1;
  return words[raw] ?? (Number(raw) || undefined);
}

// ── Classification ──────────────────────────────────────────────────────────

/** Ordre de spécificité : le premier domaine reconnu devient le domaine principal. */
const DOMAIN_ORDER: RouteDomain[] = [
  "product",
  "market",
  "simulation",
  "comparison",
  "memory",
  "identity",
  "plan",
  "rules",
  "goals",
  "mistakes",
  "psychology",
  "risk",
  "patterns",
  "sessions",
  "trade",
  "day",
  "performance",
  "knowledge",
  "smalltalk",
];

/** Domaines qui exigent les DONNÉES du trader. */
const JOURNAL_DOMAINS: ReadonlySet<RouteDomain> = new Set<RouteDomain>([
  "identity",
  "trade",
  "day",
  "performance",
  "comparison",
  "mistakes",
  "psychology",
  "risk",
  "plan",
  "rules",
  "goals",
  "simulation",
  "memory",
  "sessions",
  "patterns",
]);

export function isJournalDomain(d: RouteDomain): boolean {
  return JOURNAL_DOMAINS.has(d);
}

/** Domaines d'analyse COMPORTEMENTALE — ils demandent un vrai raisonnement. */
const BEHAVIOURAL: ReadonlySet<RouteDomain> = new Set<RouteDomain>([
  "mistakes",
  "psychology",
  "patterns",
  "plan",
  "sessions",
]);

function deriveUiIntent(domains: Set<RouteDomain>, q: string): UiIntent {
  // Même ordre que l'ancien `intent.ts` : la date d'abord, puis le trade, le
  // risque, la psychologie, les objectifs, la performance.
  if (domains.has("day")) return "day";
  if (
    domains.has("trade") &&
    /\b(ce trade|this trade|dernier trade|last trade|mon trade|my trade|entree|entry|sortie|exit|setup)/.test(
      q,
    )
  )
    return "trade";
  if (domains.has("risk")) return "risk";
  if (domains.has("psychology") || domains.has("mistakes")) return "psychology";
  if (domains.has("goals")) return "goal";
  if (
    domains.has("performance") ||
    domains.has("comparison") ||
    domains.has("patterns") ||
    domains.has("sessions")
  )
    return "performance";
  if (domains.has("trade")) return "trade";
  return "general";
}

function deriveMemoryIntent(domains: Set<RouteDomain>, q: string): MemoryIntent {
  // Même priorité que l'ancien classifieur de `memory-select` : l'ÉMOTION
  // d'abord (« j'ai peur de perdre » parle d'état mental, pas de P&L), puis la
  // discipline (risque, taille, tenue du plan), la performance, les objectifs,
  // les règles.
  if (domains.has("psychology")) return "psychology";
  if (domains.has("risk") || domains.has("plan") || /overtrad|sur-?trad/.test(q))
    return "discipline";
  if (
    domains.has("performance") ||
    domains.has("comparison") ||
    domains.has("patterns") ||
    domains.has("sessions") ||
    domains.has("day") ||
    domains.has("trade") ||
    domains.has("mistakes")
  )
    return "performance";
  if (domains.has("goals")) return "goals";
  if (domains.has("rules")) return "rules";
  return "generic";
}

export interface RouteOptions {
  /** La date civile LOCALE du trader (`YYYY-MM-DD`). Absent : la date locale du runtime. */
  today?: string;
}

/**
 * Route UNE question. Pur, déterministe, sans réseau.
 */
export function routeQuestion(question: string, opts: RouteOptions = {}): QuestionRoute {
  const today =
    opts.today && /^\d{4}-\d{2}-\d{2}$/.test(opts.today) ? opts.today : todayLocalDate();
  const q = normalizeQuestion(question);
  const signals: string[] = [];
  const domains = new Set<RouteDomain>();

  const personal = PERSONAL.test(q);
  const asksWhy = WHY.test(q);
  const deep = DEEP.test(q);

  for (const [domain, re] of Object.entries(LEXICON) as [RouteDomain, RegExp][]) {
    if (re.test(q)) {
      domains.add(domain);
      signals.push(domain);
    }
  }
  // « Et si je risquais moitié moins ? » : le détecteur exact du moteur
  // probabiliste est la référence, le lexique ne fait que le compléter.
  if (detectWhatIf(question)) {
    domains.add("simulation");
    signals.push("what-if");
  }

  // PRODUIT : un prix, une offre, ou une question d'usage sur une page nommée.
  // « Est-ce que je respecte mon Trading Plan ? » reste du journal : il n'y a
  // ni question d'usage, ni prix.
  const pricing = PRICING.test(q);
  const featureAsk = FEATURES.test(q) && PRODUCT_ASK.test(q);
  const namesProduct = /\btradevault\b|\btrade vault\b/.test(q);
  if (pricing || featureAsk || (namesProduct && !personal)) {
    domains.add("product");
    signals.push(pricing ? "pricing" : "feature");
    // Une question d'usage sur une page n'est pas une question sur les données :
    // « comment fonctionne le calendrier » ne demande pas de lire le journal.
    if (!personal)
      for (const d of [...domains]) if (d !== "product" && d !== "market") domains.delete(d);
  }

  // CONNAISSANCE GÉNÉRALE : une définition, sans possessif.
  if (!domains.has("product") && DEFINITION.test(q) && CONCEPTS.test(q) && !personal) {
    for (const d of [...domains]) if (isJournalDomain(d)) domains.delete(d);
    domains.add("knowledge");
    signals.push("definition");
  }

  // BAVARDAGE : une salutation ou un merci, et rien d'autre.
  const short =
    q
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean).length <= 6;
  if (SMALLTALK.test(q) && short && domains.size === 0) {
    domains.add("smalltalk");
    signals.push("smalltalk");
  }

  // Entités.
  const periods = extractPeriods(q, today);
  const weekdays = extractWeekdays(q);
  const symbols = extractSymbols(question);
  const sessions = SESSIONS.filter(([re]) => re.test(q)).map(([, s]) => s);
  const horizonHours = extractHorizonHours(q);
  const comparison =
    domains.has("comparison") && periods.length >= 2
      ? ([periods[0], periods[1]].sort((a, b) => a.since.localeCompare(b.since)) as [
          Period,
          Period,
        ])
      : undefined;
  if (
    periods.length >= 2 &&
    !comparison &&
    /\bet\b|\band\b/.test(q) &&
    /\bentre\b|\bbetween\b/.test(q)
  ) {
    domains.add("comparison");
  }
  if (weekdays.length && personal) {
    domains.add("patterns");
    domains.add("performance");
  }
  if (sessions.length && personal) domains.add("sessions");
  // Une date précise posée par le trader sur SON journal = une journée — y
  // compris quand il la croise avec le marché (« les news ont-elles pesé sur
  // mes pertes aujourd'hui ? » demande les trades du jour ET le calendrier).
  const single = periods[0];
  if (single && single.granularity === "day" && personal) domains.add("day");
  // Le trader qui parle de « mon trading », « mon journal », « mon compte » parle
  // de ses données, même sans métrique nommée.
  if (
    personal &&
    /\b(mon|my|ma|mes) (trading|journal|historique|history|resultats|results)\b/.test(q)
  )
    domains.add("performance");
  // « Analyse complète » sur ses données : une revue de tout le journal.
  if (deep && personal) {
    domains.add("performance");
    domains.add("patterns");
    domains.add("mistakes");
  }
  // Une question MARCHÉ sans rien de personnel (« quelles news aujourd'hui ? »)
  // ne demande pas le journal : « aujourd'hui » y est une date de calendrier,
  // pas une séance du trader.
  if (domains.has("market") && !personal)
    for (const d of [...domains]) if (isJournalDomain(d)) domains.delete(d);
  // Un symbole + une question personnelle : c'est le journal.
  if (symbols.length && personal && domains.size === 0) domains.add("performance");
  // Rien de reconnu : PAS de domaine par défaut. La question est marquée
  // ambiguë et c'est le petit modèle de routage qui tranche — deviner « c'est
  // sûrement le journal » enverrait des données sur « raconte-moi un truc ».

  const ordered = DOMAIN_ORDER.filter((d) => domains.has(d));
  const recognised = ordered.length > 0;
  const finalDomains: RouteDomain[] = recognised ? ordered : ["knowledge"];

  // ── Niveau de difficulté ──
  const journal = finalDomains.filter(isJournalDomain);
  const behavioural = finalDomains.some((d) => BEHAVIOURAL.has(d));
  let tier: RouteTier;
  if (finalDomains.every((d) => d === "smalltalk" || d === "knowledge" || d === "product")) {
    // Bavardage, définition, question produit : une réponse directe.
    tier = 1;
  } else if (deep || (q.length > 260 && journal.length >= 3)) {
    tier = 4;
  } else if (
    comparison ||
    finalDomains.includes("comparison") ||
    (finalDomains.includes("market") && journal.length > 0) ||
    (asksWhy && (behavioural || journal.length >= 3)) ||
    // Tenue du plan : confronter les règles écrites au comportement réel.
    (personal && finalDomains.includes("plan")) ||
    // Chercher un schéma (« quel pattern me coûte ») est un diagnostic.
    (personal && finalDomains.includes("patterns") && journal.length >= 2)
  ) {
    tier = 3;
  } else if (asksWhy || behavioural || journal.length >= 3 || finalDomains.includes("simulation")) {
    tier = 2;
  } else {
    // Une mesure, un fait personnel, une journée lue sans « pourquoi ».
    tier = 1;
  }

  // ── Confiance / ambiguïté ──
  const words = q.split(" ").filter(Boolean).length;
  const confidence = !recognised ? 0.2 : signals.length >= 2 ? 0.9 : 0.7;
  const ambiguous = !recognised && words >= 4;

  const set = new Set(finalDomains);
  return {
    domains: finalDomains,
    primary: finalDomains[0],
    tier,
    entities: {
      ...(periods[0] ? { period: periods[0] } : {}),
      ...(comparison ? { comparison } : {}),
      weekdays,
      symbols,
      sessions,
      ...(horizonHours ? { horizonHours } : {}),
    },
    asksWhy,
    personal,
    confidence,
    ambiguous,
    uiIntent: deriveUiIntent(set, q),
    memoryIntent: deriveMemoryIntent(set, q),
    signals,
  };
}

// ── Résolution d'ambiguïté par un petit modèle (le SEUL usage du modèle ici) ──

/** Domaines qu'un modèle de routage a le droit de proposer. */
export const ROUTE_DOMAINS: readonly RouteDomain[] = DOMAIN_ORDER;

/**
 * Le prompt du petit modèle de routage. Court, en JSON strict : il ne voit que
 * la question — jamais les données du trader.
 */
export function ambiguityPrompt(question: string): { system: string; user: string } {
  return {
    system:
      "You classify a trader's question for a trading-journal assistant. Reply with STRICT JSON " +
      '{"domains":[...],"tier":1|2|3|4} and nothing else. Allowed domains: ' +
      ROUTE_DOMAINS.join(", ") +
      ". tier 1 = greeting, definition, product question or single number lookup; 2 = simple " +
      "analysis of one area of their data; 3 = diagnosis crossing several areas or periods; 4 = " +
      "explicit full deep review. If the question is about their own trading, include at least one " +
      "data domain.",
    user: question.slice(0, 500),
  };
}

/**
 * Fusionne la proposition du petit modèle dans la route déterministe. Tout ce
 * qui n'est pas dans la taxonomie est ignoré : le modèle ne peut ni inventer un
 * domaine, ni contourner le routage.
 */
export function mergeModelRoute(route: QuestionRoute, raw: unknown): QuestionRoute {
  if (!raw || typeof raw !== "object") return route;
  const r = raw as { domains?: unknown; tier?: unknown };
  const domains = Array.isArray(r.domains)
    ? DOMAIN_ORDER.filter((d) => (r.domains as unknown[]).includes(d))
    : [];
  if (domains.length === 0) return route;
  // Le niveau proposé est PLAFONNÉ à 3 : le niveau 4 (le modèle le plus cher)
  // ne s'ouvre que sur une demande explicite d'analyse complète, reconnue de
  // façon déterministe — jamais sur l'avis d'un petit modèle.
  const proposed = [1, 2, 3, 4].includes(Number(r.tier)) ? Number(r.tier) : route.tier;
  const tier = Math.min(proposed, 3) as RouteTier;
  const set = new Set(domains);
  const q = "";
  return {
    ...route,
    domains,
    primary: domains[0],
    tier,
    confidence: 0.6,
    ambiguous: false,
    uiIntent: deriveUiIntent(set, q),
    memoryIntent: deriveMemoryIntent(set, q),
    signals: [...route.signals, "model-routed"],
  };
}
