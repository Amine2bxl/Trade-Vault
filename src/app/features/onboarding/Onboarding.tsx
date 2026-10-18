import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SelectPicker, Sheet } from "@/shared/ui";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BellRing,
  Bitcoin,
  Building2,
  CalendarRange,
  CandlestickChart,
  Check,
  Crosshair,
  FlaskConical,
  Flame,
  Globe,
  Layers,
  Loader2,
  Lock,
  LockOpen,
  NotebookPen,
  PlayCircle,
  Radar,
  Repeat2,
  Route,
  Scale,
  ShieldCheck,
  Sprout,
  Sun,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
  type LucideIcon,
} from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";
import { useJarvisVoice } from "../jarvis/jarvisVoice";
import { LANG_NAMES, type Lang } from "@/app/i18n/translations";
import {
  saveOnboarding,
  saveCurrency,
  updateAccount,
  loadAccounts,
  loadChecklistConfig,
  saveChecklistConfig,
  saveAccountBalance,
  loadConfluences,
  saveConfluences,
} from "@/app/store";
import { loadTradingRules, saveTradingRules } from "@/app/trading/tradingRules";
import { loadTradingPlan, saveTradingPlan } from "@/app/trading/tradingPlan";
import { loadUserPref, saveUserPref } from "@/app/utils/userPrefs";
import { remember } from "@/modules/ai/memory";
import { DEFAULT_CONFLUENCES } from "@/app/types";
import { todayLocalDate } from "@/shared/calendar-date";
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from "@/app/utils/themes";
import {
  CURRENCIES,
  currencySymbol,
  formatMoney,
  getCurrency,
  parseCurrency,
  setCurrency,
  type CurrencyCode,
} from "@/shared/currency";
import logoSrc from "@/assets/tradevault-logo-128.png";
import tradovateLogo from "@/assets/brands/tradovate.png";
import { brokerCapabilities } from "@/backend/brokers.functions";
import { fmt, oc, type OnboardingCopy } from "./onboardingCopy";
import {
  CAPITAL_PRESETS,
  EMPTY_GUARDRAILS,
  PROP_FIRMS,
  PROP_SIZES,
  TARGET_PRESETS,
  accountName,
  accountType,
  armedCount,
  buildRules,
  checklistFromAnswers,
  defaultGoal,
  ICT_CONFLUENCES,
  lotCalcSeed,
  memoriesFromAnswers,
  planFromAnswers,
  guardrailForLeak,
  isProp,
  offersIct,
  profileFields,
  suggestGuardrails,
  type Arena,
  type Experience,
  type Goal,
  type Guardrails,
  type Leak,
  type Market,
  type OnboardingAnswers,
  type Style,
} from "./onboardingPlan";
import { play, releaseAudio, setSoundEnabled, soundEnabled, unlockAudio } from "./onboardingSound";
import {
  ChoiceChip,
  FileTicker,
  JarvisLine,
  LockSweep,
  OptionTile,
  SceneFrame,
  Stepper,
  ThemeCard,
  TraderFile,
} from "./OnboardingParts";
import { prefersReducedMotion, rise } from "./onboardingMotion";
import { jarvisLines } from "./onboardingJarvis";

/** Ce que le trader a choisi pour démarrer — `App.tsx` l'exécute. */
export type OnboardingAction = "import" | "demo" | "broker" | null;

/** Où se trouvait la carte finale (marges depuis les bords de l'écran) : le
 *  shell s'ouvre depuis ce rectangle — la carte DEVIENT l'application. */
export interface MorphOrigin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * L'ONBOARDING — la calibration de TradeVault autour d'UN trader.
 *
 * Ce n'est plus un questionnaire posé par-dessus l'application : chaque
 * réponse reconfigure quelque chose de réel, et le trader le voit se faire
 * (le « dossier trader » se remplit en direct). Ce que chaque réponse change
 * est décidé dans `onboardingPlan.ts` ; ce fichier met en scène et applique.
 *
 *   0. ALLUMAGE    — la promesse, le son, la voix de Jarvis
 *   1. IDENTITÉ    — prénom (Jarvis l'emploie) + langue, appliquée à chaud
 *   2. TERRAIN     — challenge, financé, capital propre, démo → tout le reste
 *   3. COMPTE      — prop firm + taille, OU capital ; devise → le compte réel
 *   4. MARCHÉS     — + ICT/SMC si pertinent → checklist, Jarvis
 *   5. STYLE       — durée de détention → limite de trades, checklist
 *   6. EXPÉRIENCE  — le ton de Jarvis
 *   7. ANGLE MORT  — LA fuite n°1 → ce que Jarvis surveille d'abord
 *   8. GARDE-FOUS  — des règles proposées, ajustées, vérifiées sur chaque trade
 *   9. MISSION     — 90 jours, + objectif mensuel facultatif
 *  10. APPARENCE   — la couleur, appliquée à la séquence elle-même
 *   → CALIBRATION (enregistrement réel) → DÉPART → LANCEMENT
 *
 * Le parcours n'est pas le même pour tous : l'écran du compte, les garde-fous
 * proposés, la mission présélectionnée, l'interrupteur ICT et les façons de
 * démarrer dépendent des réponses précédentes.
 */

type Scene =
  | "boot"
  | "identity"
  | "arena"
  | "account"
  | "markets"
  | "style"
  | "experience"
  | "leak"
  | "guardrails"
  | "mission"
  | "look"
  | "calibrate"
  | "start"
  | "launch";

const QUESTIONS = [
  "identity",
  "arena",
  "account",
  "markets",
  "style",
  "experience",
  "leak",
  "guardrails",
  "mission",
  "look",
] as const satisfies readonly Scene[];
type Question = (typeof QUESTIONS)[number];

/** Le code de chaque module, affiché comme sur un terminal. */
const STEP_CODES = [
  "ID-01",
  "ARN-02",
  "ACC-03",
  "MKT-04",
  "STY-05",
  "EXP-06",
  "LEK-07",
  "GRD-08",
  "MSN-09",
  "LOOK-10",
] as const;

/** Les répliques de Jarvis, prises dans ses clips enregistrés : la vraie voix. */
const VOICE_BOOT = "Power-up complete. I'll be watching every move.";
const VOICE_CALIBRATE = "Locking sequence engaged.";
const VOICE_LAUNCH = "Edge locked. The plan decides. Not you.";

/* ── Le décor : une trame, des points, et la courbe d'un marché ────────── */

function OnboardingField() {
  const stars = useMemo(() => {
    let seed = 17;
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: 86 }, () => ({
      x: random() * 100,
      y: random() * 100,
      opacity: 0.08 + random() * 0.24,
      radius: random() > 0.9 ? 1.1 : 0.55,
    }));
  }, []);

  return (
    <svg className="onb-data-field pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="onb-grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0H0V64" fill="none" stroke="white" strokeOpacity="0.025" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#onb-grid)" />
      {stars.map((star, index) => (
        <circle
          key={index}
          cx={`${star.x}%`}
          cy={`${star.y}%`}
          r={star.radius}
          fill="white"
          opacity={star.opacity}
        />
      ))}
    </svg>
  );
}

/** La courbe du bas d'écran : elle se redessine à chaque étape, et monte. */
function MarketPulse({ step }: { step: number }) {
  const path = useMemo(() => {
    let seed = step * 37 + 11;
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    let y = 66;
    const points: string[] = [];
    for (let index = 0; index <= 40; index += 1) {
      y = Math.max(18, Math.min(106, y + (random() - 0.48) * 20 - step * 0.11));
      points.push(`${index * 25},${y.toFixed(1)}`);
    }
    return `M${points.join(" L")}`;
  }, [step]);

  return (
    <svg
      key={step}
      className="onb-market-pulse pointer-events-none absolute inset-x-0 bottom-[7%] h-28 w-full"
      viewBox="0 0 1000 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={path} fill="none" stroke="white" strokeOpacity="0.055" strokeWidth="1" />
      <path
        d={path}
        fill="none"
        stroke="var(--tv-accent)"
        strokeOpacity="0.42"
        strokeWidth="1"
        pathLength={1}
        className="onb-pulse-trace"
      />
    </svg>
  );
}

/* ── Les libellés, tirés de la copie ──────────────────────────────────── */

function labelsOf(c: OnboardingCopy) {
  return {
    arena: {
      prop_challenge: { label: c.arProp, desc: c.arPropD, icon: Trophy },
      funded: { label: c.arFunded, desc: c.arFundedD, icon: ShieldCheck },
      personal: { label: c.arPersonal, desc: c.arPersonalD, icon: Wallet },
      demo: { label: c.arDemo, desc: c.arDemoD, icon: FlaskConical },
    } satisfies Record<Arena, { label: string; desc: string; icon: LucideIcon }>,
    market: {
      futures: { label: c.aFutures, desc: c.aFuturesD, icon: CandlestickChart },
      forex: { label: c.aForex, desc: c.aForexD, icon: Globe },
      stocks: { label: c.aStocks, desc: c.aStocksD, icon: Building2 },
      crypto: { label: c.aCrypto, desc: c.aCryptoD, icon: Bitcoin },
      options: { label: c.aOptions, desc: c.aOptionsD, icon: Layers },
    } satisfies Record<Market, { label: string; desc: string; icon: LucideIcon }>,
    style: {
      scalping: { label: c.sScalper, desc: c.sScalperD, icon: Zap },
      daytrading: { label: c.sDay, desc: c.sDayD, icon: Sun },
      swing: { label: c.sSwing, desc: c.sSwingD, icon: CalendarRange },
    } satisfies Record<Style, { label: string; desc: string; icon: LucideIcon }>,
    experience: {
      new: { label: c.eNew, desc: c.eNewD, icon: Sprout },
      intermediate: { label: c.eInt, desc: c.eIntD, icon: TrendingUp },
      seasoned: { label: c.eSea, desc: c.eSeaD, icon: Award },
      funded: { label: c.eFund, desc: c.eFundD, icon: BadgeCheck },
    } satisfies Record<Experience, { label: string; desc: string; icon: LucideIcon }>,
    leak: {
      emotions: { label: c.pEmo, desc: c.pEmoD, icon: Flame },
      overtrading: { label: c.pOver, desc: c.pOverD, icon: Repeat2 },
      risk: { label: c.pRisk, desc: c.pRiskD, icon: Scale },
      consistency: { label: c.pCons, desc: c.pConsD, icon: Route },
      journaling: { label: c.pJour, desc: c.pJourD, icon: NotebookPen },
    } satisfies Record<Leak, { label: string; desc: string; icon: LucideIcon }>,
    goal: {
      prop_challenge: { label: c.gProp, desc: c.gPropD, icon: Trophy },
      fulltime: { label: c.gFull, desc: c.gFullD, icon: BadgeCheck },
      consistency: { label: c.gCons, desc: c.gConsD, icon: TrendingUp },
      discipline: { label: c.gDisc, desc: c.gDiscD, icon: ShieldCheck },
      side: { label: c.gSide, desc: c.gSideD, icon: Wallet },
    } satisfies Record<Goal, { label: string; desc: string; icon: LucideIcon }>,
  };
}

/** L'ordre des missions : celle qui correspond au terrain d'abord. */
function goalOrder(arena: Arena | null): Goal[] {
  const first = defaultGoal(arena);
  const rest: Goal[] = ["prop_challenge", "fulltime", "consistency", "discipline", "side"];
  return [first, ...rest.filter((g) => g !== first)];
}

const initialAnswers = (firstName: string): OnboardingAnswers => ({
  firstName,
  arena: null,
  firm: null,
  capital: null,
  currency: getCurrency(),
  assets: [],
  usesIct: false,
  style: null,
  experience: null,
  leak: null,
  goal: null,
  monthlyTarget: null,
  guardrails: { ...EMPTY_GUARDRAILS },
});

/* ── Composant principal ────────────────────────────────────────────────── */

export default function Onboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (action?: OnboardingAction, origin?: MorphOrigin) => void;
}) {
  const { lang, setLang, t } = useT();
  const c = useMemo(() => oc(lang), [lang]);
  const L = useMemo(() => labelsOf(c), [c]);
  const { user } = useAuth();
  const { activeAccount, accounts, editAccount } = useAccounts();
  const { activeId: themeId, setActive: setTheme } = useTheme();
  const push = usePushNotifications();
  const voice = useJarvisVoice();

  const [scene, setScene] = useState<Scene>("boot");
  const [igniting, setIgniting] = useState(false);
  const [sound, setSound] = useState(() => soundEnabled());
  const [answers, setAnswers] = useState<OnboardingAnswers>(() =>
    initialAnswers((user?.name ?? "").split(" ")[0] ?? ""),
  );
  const [guardTouched, setGuardTouched] = useState(false);
  const [customCapital, setCustomCapital] = useState("");
  const [notify, setNotify] = useState<"off" | "busy" | "on" | "blocked">("off");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [calStep, setCalStep] = useState(0);
  const [launching, setLaunching] = useState<OnboardingAction | "fresh" | null>(null);
  const [fileOpen, setFileOpen] = useState(false);
  // La connexion Tradovate est-elle OUVERTE sur ce serveur ? `null` tant
  // qu'on ne sait pas : la carte s'affiche alors comme « en cours », jamais
  // comme un bouton qui mènerait à une impasse.
  const [brokerReady, setBrokerReady] = useState<boolean | null>(null);
  const getBrokerCaps = useServerFn(brokerCapabilities);
  const advanceTimer = useRef<number | undefined>(undefined);

  const set = useCallback(
    <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) =>
      setAnswers((a) => ({ ...a, [key]: value })),
    [],
  );

  const qIndex = QUESTIONS.indexOf(scene as Question);
  const prop = isProp(answers.arena);

  const speak = useCallback(
    (line: string, delay = 0) => {
      if (!soundEnabled()) return;
      window.setTimeout(() => void voice.speak(line).catch(() => {}), delay);
    },
    [voice],
  );

  /* ── Navigation ── */
  const goTo = useCallback(
    (target: Scene, sfx: "advance" | "back" = "advance") => {
      window.clearTimeout(advanceTimer.current);
      play(sfx);
      if (target === "guardrails" && !guardTouched) {
        setAnswers((a) => ({ ...a, guardrails: suggestGuardrails(a) }));
      }
      if (target === "mission") {
        setAnswers((a) => (a.goal ? a : { ...a, goal: defaultGoal(a.arena) }));
      }
      setScene(target);
    },
    [guardTouched],
  );

  const next = useCallback(() => {
    if (qIndex < 0) return;
    goTo(qIndex === QUESTIONS.length - 1 ? "calibrate" : QUESTIONS[qIndex + 1]);
  }, [qIndex, goTo]);

  const back = useCallback(() => {
    if (qIndex > 0) goTo(QUESTIONS[qIndex - 1], "back");
  }, [qIndex, goTo]);

  /** Choix unique : on verrouille la réponse, on laisse le liseré se tracer,
   *  puis l'écran suivant arrive tout seul. */
  const choose = useCallback(
    (apply: () => void, autoAdvance = true) => {
      apply();
      play("select");
      if (!autoAdvance) return;
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(next, prefersReducedMotion() ? 120 : 460);
    },
    [next],
  );
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  /* ── Clavier : 1-9 choisit, Entrée continue ── */
  const keys = useRef<{ digits: (() => void)[]; enter?: () => void }>({ digits: [] });
  const fileOpenRef = useRef(false);
  fileOpenRef.current = fileOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Le dossier ouvert est une lecture : le clavier ne répond pas dessous.
      if (fileOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (e.key === "Enter" && keys.current.enter) keys.current.enter();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const fn = keys.current.digits[Number(e.key) - 1];
        if (fn) {
          e.preventDefault();
          fn();
        }
      } else if (e.key === "Enter" && keys.current.enter) {
        e.preventDefault();
        keys.current.enter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  keys.current = { digits: [], enter: undefined };

  /* ── Son ── */
  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    setSoundEnabled(on);
    unlockAudio();
    if (on) play("tick");
    else voice.stop();
  };

  /* ── Allumage ── */
  const ignite = () => {
    if (igniting) return;
    unlockAudio();
    play("boot");
    speak(VOICE_BOOT, 1300);
    setIgniting(true);
    window.setTimeout(
      () => {
        setIgniting(false);
        setScene("identity");
      },
      prefersReducedMotion() ? 150 : 1250,
    );
  };

  /* ── « Je configurerai plus tard » : l'app s'ouvre, rien n'est perdu ── */
  const skipAll = async () => {
    if (save === "saving") return;
    setSave("saving");
    try {
      await saveOnboarding(userId, profileFields(initialAnswers(answers.firstName)), {
        skipped: true,
        firstName: answers.firstName,
      });
      releaseAudio();
      onDone(null);
    } catch (e) {
      console.error("Failed to skip onboarding", e);
      setSave("error");
      play("error");
    }
  };

  /* ── La devise : appliquée tout de suite, enregistrée à la calibration ── */
  const chooseCurrency = (code: CurrencyCode) => {
    set("currency", code);
    setCurrency(code);
  };
  const money = useCallback(
    (n: number) => formatMoney(n, { currency: parseCurrency(answers.currency), whole: true }),
    [answers.currency],
  );
  // « 0,5 % » en français, « 0.5% » en anglais : les règles se relisent telles
  // quelles dans le plan de trading, elles doivent être écrites dans la langue.
  const num = useCallback((n: number) => new Intl.NumberFormat(lang).format(n), [lang]);
  const ruleTexts = useMemo(
    () => ({ risk: c.ruleRisk, trades: c.ruleTrades, stop: c.ruleStop, daily: c.ruleDaily }),
    [c],
  );

  /* ── Ce que dit Jarvis, écran par écran — selon les réponses DÉJÀ données ──
     Les garde-fous cités avant leur écran sont ceux qui y seront proposés :
     Jarvis annonce « 4 trades par jour », l'écran suivant affiche 4. */
  const lines = useMemo(() => {
    const g = guardTouched ? answers.guardrails : suggestGuardrails(answers);
    const firm = isProp(answers.arena)
      ? (PROP_FIRMS.find((f) => f.id === answers.firm)?.name ?? "")
      : "";
    return jarvisLines(
      lang,
      {
        name: answers.firstName,
        arena: answers.arena,
        firm,
        size:
          answers.capital && answers.capital >= 1000
            ? `${Math.round(answers.capital / 1000)}K`
            : "",
        assets: answers.assets,
        usesIct: answers.usesIct,
        style: answers.style,
        experience: answers.experience,
        leak: answers.leak,
        goal: answers.goal,
        risk: g.riskPct ? num(g.riskPct) : "",
        trades: g.maxTrades ? String(g.maxTrades) : "",
        stop: g.stopAfter ? String(g.stopAfter) : "",
      },
      userId,
    );
  }, [answers, guardTouched, lang, num, userId]);

  /* ── Les libellés vivants du dossier ── */
  const acctLabels = {
    personal: c.acctPersonal,
    demo: c.acctDemo,
    funded: c.acctFunded,
    prop: c.acctProp,
  };
  const acctName = accountName(answers, acctLabels);
  const g = answers.guardrails;
  const armed = armedCount(g);
  const fileRows = [
    { label: c.fTrader, value: answers.firstName.trim() || null },
    { label: c.fArena, value: answers.arena ? L.arena[answers.arena].label : null },
    {
      label: c.fAccount,
      value: answers.arena
        ? `${acctName}${answers.capital ? ` · ${money(answers.capital)}` : ""}`
        : null,
    },
    {
      label: c.fMarkets,
      value: answers.assets.length
        ? answers.assets.map((m) => L.market[m].label).join(" · ")
        : null,
    },
    { label: c.fStyle, value: answers.style ? L.style[answers.style].label : null },
    { label: c.fExp, value: answers.experience ? L.experience[answers.experience].desc : null },
    {
      label: c.fLeak,
      value: answers.leak ? L.leak[answers.leak].label : null,
      accent: true,
    },
    {
      label: c.fRules,
      value: qIndex < 0 || qIndex >= 7 ? fmt(c.rulesCount, { n: String(armed) }) : null,
    },
    {
      label: c.fMission,
      value: answers.goal && (qIndex < 0 || qIndex >= 8) ? L.goal[answers.goal].label : null,
    },
  ];

  /* ── LA CALIBRATION : l'enregistrement réel, mis en scène ── */
  const persist = useCallback(async () => {
    setSave("saving");
    try {
      // Le chemin critique : il pose `onboarded_at`. S'il échoue, on reste
      // ici avec un bouton « Réessayer » — on ne laisse jamais le trader
      // entrer dans une application qui le renverrait à l'onboarding.
      await saveOnboarding(userId, profileFields(answers), {
        skipped: false,
        firstName: answers.firstName,
      });
    } catch (e) {
      console.error("Failed to save onboarding", e);
      setSave("error");
      play("error");
      return;
    }

    const currency = parseCurrency(answers.currency);
    const tasks: Promise<unknown>[] = [saveCurrency(userId, currency)];

    // Le compte principal : nom, type, capital, devise.
    tasks.push(
      (async () => {
        let id = activeAccount?.id ?? accounts.find((a) => a.isDefault)?.id ?? null;
        if (!id) {
          const list = await loadAccounts(userId);
          id = (list.find((a) => a.isDefault) ?? list[0])?.id ?? null;
        }
        if (!id) return;
        const patch: {
          name?: string;
          type?: ReturnType<typeof accountType>;
          startingBalance?: number;
        } = {};
        if (answers.arena) {
          patch.name = acctName;
          patch.type = accountType(answers.arena);
        }
        if (answers.capital && answers.capital > 0) patch.startingBalance = answers.capital;
        if (Object.keys(patch).length) {
          if (activeAccount?.id === id) await editAccount(id, patch);
          else await updateAccount(userId, id, patch);
        }
        await updateAccount(userId, id, { currency });
      })(),
    );

    // Les garde-fous : écrits dans le plan, et diffusés pour que le
    // vérificateur de l'application les applique dès le premier trade.
    tasks.push(
      (async () => {
        const existing = await loadTradingRules(userId).catch(() => []);
        const rules = buildRules(answers.guardrails, ruleTexts, money, existing, num);
        await saveTradingRules(userId, rules);
        window.dispatchEvent(new CustomEvent("tv-rules-updated", { detail: rules }));
      })(),
    );

    /* ── LE RESTE DE L'APPLICATION ──
       Chaque écriture ci-dessous alimente un écran qui, avant, repartait de
       zéro après l'onboarding. Toutes au mieux : une seule qui échoue ne
       bloque ni les autres, ni l'entrée dans l'application. */

    // La checklist pré-market : construite sur les réponses ET les chiffres
    // des garde-fous. Jamais par-dessus une checklist déjà réglée.
    const checklist = checklistFromAnswers(answers, lang, money);
    tasks.push(
      (async () => {
        const cfgKey = `tv-chk-config-${userId}`;
        let local: string | null = null;
        try {
          local = localStorage.getItem(cfgKey);
        } catch {
          /* stockage refusé : la base fait foi */
        }
        const saved = (await loadChecklistConfig(userId).catch(() => null)) as {
          items?: unknown[];
        } | null;
        if (local || (Array.isArray(saved?.items) && saved.items.length > 0)) return;
        try {
          localStorage.setItem(cfgKey, JSON.stringify(checklist));
          // L'assistant de la checklist reposerait les mêmes questions.
          localStorage.setItem(`tv-chk-wizard-${userId}`, "1");
        } catch {
          /* la copie en base suffit */
        }
        await saveChecklistConfig(userId, checklist);
      })(),
    );

    // Le plan de trading : ses chiffres de risque nourrissent l'Edge Score.
    tasks.push(
      (async () => {
        const existing = await loadTradingPlan(userId);
        const city = (tz: string) => tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
        const goal = answers.goal ? L.goal[answers.goal] : null;
        const plan = planFromAnswers(answers, existing, {
          mission: goal
            ? `${goal.label} — ${goal.desc}${answers.monthlyTarget ? ` (${answers.monthlyTarget}%/${lang === "fr" ? "mois" : "month"})` : ""}`
            : "",
          markets: answers.assets.map((m) => L.market[m].label),
          sessions: answers.assets.length
            ? `${checklist.startTime} · ${city(checklist.timeZone)}`
            : "",
          preMarket: c.planPre,
          postMarket: answers.leak === "journaling" ? c.planPost : "",
        });
        await saveTradingPlan(userId, plan);
      })(),
    );

    // Ce que Jarvis retient (terrain, engagement daté, ton attendu). Écrit par
    // le TRADER via l'onboarding — pas une écriture de l'IA.
    for (const m of memoriesFromAnswers(answers, money, todayLocalDate())) {
      tasks.push(
        remember(userId, m.kind, m.content, {
          key: m.key,
          importance: m.importance,
          confidence: m.confidence,
          source: "onboarding",
        }),
      );
    }

    // Le journal : la base du % de risque saisi dans un trade, et le
    // vocabulaire de confluences d'un trader ICT (sauf liste déjà personnalisée).
    if (answers.capital && answers.capital > 0) {
      tasks.push(saveAccountBalance(userId, answers.capital));
    }
    if (answers.usesIct) {
      tasks.push(
        (async () => {
          const current = await loadConfluences(userId);
          const untouched =
            current.length === DEFAULT_CONFLUENCES.length &&
            current.every((x, i) => x === DEFAULT_CONFLUENCES[i]);
          if (untouched) await saveConfluences(userId, ICT_CONFLUENCES);
        })(),
      );
    }

    // Le calculateur de lots s'ouvre sur le bon marché et le risque choisi.
    const lot = lotCalcSeed(answers);
    if (lot) {
      tasks.push(
        (async () => {
          const existing = await loadUserPref(userId, "lotCalc");
          if (!existing) saveUserPref(userId, "lotCalc", lot);
        })(),
      );
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "rejected") console.error("[onboarding] best-effort step failed", r.reason);
    }
    setSave("saved");
  }, [
    userId,
    answers,
    activeAccount,
    accounts,
    editAccount,
    acctName,
    money,
    num,
    ruleTexts,
    lang,
    L,
    c,
  ]);

  // L'état réel de la connexion Tradovate, demandé pendant la calibration :
  // il est connu quand l'écran de départ arrive. Seuls les traders de futures
  // la voient — c'est le marché que Tradovate couvre.
  const wantsBroker = answers.assets.includes("futures");
  useEffect(() => {
    if ((scene !== "calibrate" && scene !== "start") || !wantsBroker || brokerReady !== null) {
      return;
    }
    let alive = true;
    getBrokerCaps()
      .then((caps) => alive && setBrokerReady(caps.ready))
      .catch(() => alive && setBrokerReady(false));
    return () => {
      alive = false;
    };
  }, [scene, wantsBroker, brokerReady, getBrokerCaps]);

  // Démarre l'enregistrement en entrant dans la calibration, une fois.
  const started = useRef(false);
  useEffect(() => {
    if (scene !== "calibrate" || started.current) return;
    started.current = true;
    speak(VOICE_CALIBRATE, 250);
    void persist();
  }, [scene, persist, speak]);

  // Une ligne par écriture RÉELLE de `persist()` — la calibration ne raconte
  // rien qui ne se passe pas.
  const calLines = useMemo(
    () => [
      fmt(c.calAccount, { account: answers.arena ? acctName : c.acctPersonal }),
      fmt(c.calPlan, {
        markets: answers.assets.length
          ? answers.assets.map((m) => L.market[m].label).join(", ")
          : "—",
      }),
      fmt(c.calRules, { n: String(armed) }),
      c.calChecklist,
      fmt(c.calJarvis, { leak: answers.leak ? L.leak[answers.leak].label : "—" }),
      ...(answers.capital && answers.capital > 0
        ? [fmt(c.calJournal, { capital: money(answers.capital) })]
        : []),
      c.calLook,
    ],
    [c, answers.arena, answers.assets, answers.leak, answers.capital, acctName, armed, L, money],
  );

  // Les lignes défilent au rythme d'un terminal ; la dernière attend
  // l'enregistrement réel (jamais de « terminé » mensonger).
  useEffect(() => {
    if (scene !== "calibrate") return;
    if (calStep >= calLines.length) return;
    if (calStep === calLines.length - 1 && save !== "saved") return;
    const t = window.setTimeout(
      () => {
        play("data");
        setCalStep((s) => s + 1);
      },
      prefersReducedMotion() ? 60 : calStep === 0 ? 650 : 520,
    );
    return () => window.clearTimeout(t);
  }, [scene, calStep, calLines.length, save]);

  const calDone = scene === "calibrate" && calStep >= calLines.length && save === "saved";
  useEffect(() => {
    if (calDone) play("lock");
  }, [calDone]);

  /* ── Lancement ── */
  const launch = (action: OnboardingAction | "fresh") => {
    if (launching) return;
    setLaunching(action);
    play("launch");
    speak(VOICE_LAUNCH, 500);
    setScene("launch");
  };
  /* LA MÉTAMORPHOSE. Le prénom, puis l'espace configuré ; ensuite tout ce qui
     n'est pas la carte s'efface, la carte se vide — et l'application s'ouvre
     DEPUIS son rectangle (`App.tsx`, `.tv-morph-in`). Pas de coupure : la
     plaque que le trader regarde devient la fenêtre du produit. */
  const revealRef = useRef<HTMLDivElement>(null);
  const [morphing, setMorphing] = useState(false);
  useEffect(() => {
    if (scene !== "launch") return;
    const action = launching === "fresh" ? null : launching;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const timer = window.setTimeout(() => {
        releaseAudio();
        onDone(action);
      }, 200);
      return () => window.clearTimeout(timer);
    }
    const fade = window.setTimeout(() => setMorphing(true), 2_900);
    const done = window.setTimeout(() => {
      releaseAudio();
      const r = revealRef.current?.getBoundingClientRect();
      onDone(
        action,
        r
          ? {
              top: r.top,
              right: window.innerWidth - r.right,
              bottom: window.innerHeight - r.bottom,
              left: r.left,
            }
          : undefined,
      );
    }, 3_250);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [scene, launching, onDone]);

  /* ── Notifications : demandées AU MOMENT où elles ont un sens ── */
  const askNotify = async () => {
    if (notify === "busy" || notify === "on") return;
    setNotify("busy");
    try {
      await push.subscribe();
      setNotify("on");
      play("lock");
    } catch {
      setNotify("blocked");
    }
  };

  const setGuard = (patch: Partial<Guardrails>) => {
    setGuardTouched(true);
    setAnswers((a) => ({ ...a, guardrails: { ...a.guardrails, ...patch } }));
  };

  /* ════════════════════════════ RENDU ════════════════════════════ */

  const soundButton = (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={sound}
      aria-label={sound ? c.soundOn : c.soundOff}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 text-[11px] font-semibold text-slate-400 transition-colors hover:border-[var(--tv-border-strong)] hover:text-white"
    >
      {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{sound ? c.soundOn : c.soundOff}</span>
    </button>
  );

  /* ── 0 · ALLUMAGE ── */
  if (scene === "boot") {
    keys.current.enter = ignite;
    return (
      <div
        className={cn(
          "onb-root relative flex h-dvh w-full items-center justify-center overflow-hidden px-5",
          igniting && "onb-igniting",
        )}
      >
        <OnboardingField />
        <MarketPulse step={0} />
        {igniting && <span className="onb-scanline" aria-hidden />}
        <div className="absolute right-4 top-4 z-20">{soundButton}</div>
        <div className="onb-boot-content relative z-10 flex w-full max-w-[640px] flex-col items-center text-center">
          <div className="onb-boot-mark relative mb-7 grid h-24 w-24 place-items-center">
            <svg
              className="absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 96 96"
              aria-hidden
            >
              <circle
                cx="48"
                cy="48"
                r="46"
                fill="none"
                stroke="var(--tv-border-strong)"
                strokeWidth="1"
              />
              <circle
                cx="48"
                cy="48"
                r="46"
                fill="none"
                stroke="var(--tv-accent)"
                strokeWidth="1.5"
                pathLength={1}
                className="onb-lock-sweep onb-boot-ring"
              />
            </svg>
            <img
              src={logoSrc}
              alt="TradeVault"
              width={52}
              height={52}
              className="h-[52px] w-[52px] rounded-xl"
            />
          </div>
          <div
            className="onb-rise mb-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.24em]"
            style={rise(2)}
          >
            <span className="onb-boot-line hidden h-px w-10 bg-[var(--tv-accent)] sm:block" />
            {c.bootKicker}
            <span className="onb-boot-line hidden h-px w-10 bg-[var(--tv-accent)] sm:block" />
          </div>
          <h1
            className="onb-rise text-[clamp(2.3rem,6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white"
            style={rise(3)}
          >
            {c.bootTitleA} <span className="text-[var(--tv-highlight)]">{c.bootTitleB}</span>
          </h1>
          <p
            className="onb-rise mt-4 max-w-[520px] text-[15px] leading-relaxed text-slate-400"
            style={rise(4)}
          >
            {c.bootSub}
          </p>
          <ul className="mt-7 grid w-full max-w-[560px] gap-2 sm:grid-cols-3">
            {(
              [
                [Wallet, c.bootP1],
                [ShieldCheck, c.bootP2],
                [Radar, c.bootP3],
              ] as const
            ).map(([Icon, text], i) => (
              <li
                key={text}
                className="onb-rise flex items-center gap-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2.5 text-left text-[12px] leading-snug text-slate-300 sm:flex-col sm:items-start"
                style={rise(5 + i)}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" strokeWidth={1.8} />
                {text}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={ignite}
            disabled={igniting}
            className="onb-cta onb-rise tv-accent-fill mt-8 inline-flex h-12 items-center gap-2 px-6 text-[15px] font-bold disabled:opacity-70"
            style={rise(8)}
          >
            {c.bootCta} <ArrowRight className="h-4 w-4" />
          </button>
          <p
            className="onb-rise mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"
            style={rise(9)}
          >
            <Volume2 className="h-3.5 w-3.5" /> {c.bootHint}
          </p>
          <button
            type="button"
            onClick={skipAll}
            disabled={save === "saving"}
            className="onb-rise mt-6 py-2 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
            style={rise(10)}
          >
            {save === "saving" ? c.startWorking : c.skipSetup}
          </button>
          {save === "error" && (
            <p className="mt-2 text-[12px] text-red-400" role="alert">
              {c.calError}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── LANCEMENT : le prénom, puis l'espace configuré se révèle ── */
  if (scene === "launch") {
    const launchTitle = c.personalWelcome.replace("{name}", answers.firstName.trim() || "Trader");
    const rules = buildRules(answers.guardrails, ruleTexts, money, [], num);
    return (
      <div
        className={cn(
          "onb-root relative flex h-dvh w-full items-center justify-center overflow-hidden px-5 py-5",
          morphing && "onb-morphing",
        )}
        role="status"
        aria-live="polite"
      >
        <OnboardingField />
        <MarketPulse step={QUESTIONS.length + 1} />
        <div className="relative z-10 w-full max-w-2xl">
          <div className="onb-launch-head flex items-center gap-4">
            <div className="onb-launch-logo relative grid h-16 w-16 shrink-0 place-items-center">
              <span className="absolute inset-0 rounded-full border border-[var(--tv-border-strong)]" />
              <span className="absolute inset-2 rounded-full border border-[var(--tv-border-accent)]" />
              <img src={logoSrc} alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            </div>
            <div className="min-w-0">
              <div className="onb-launch-copy flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--tv-highlight)]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                {c.systemComplete}
              </div>
              <h1 className="onb-launch-title mt-1 truncate text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
                {launchTitle}
              </h1>
              <p className="onb-launch-copy mt-1 text-[14px] text-slate-400">{c.launchSub}</p>
            </div>
          </div>

          {/* L'espace tel qu'il vient d'être configuré — AUCUN chiffre de
              performance : il n'y a pas encore un seul trade. */}
          <div
            ref={revealRef}
            className="onb-dashboard-reveal mt-6 overflow-hidden rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--tv-border)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-white">
                <img
                  src={logoSrc}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] rounded"
                />
                <span className="truncate">{answers.arena ? acctName : "TradeVault"}</span>
              </div>
              <span className="tv-label flex items-center gap-1.5 text-slate-500">
                <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />
                {c.fileLive}
              </span>
            </div>
            {/* Trois cellules sur grand écran ; sur téléphone, l'angle mort
                passe en pleine largeur au lieu de disparaître — c'est ce que
                Jarvis surveillera dès le premier trade. */}
            <div className="grid grid-cols-2 sm:grid-cols-3">
              <div className="px-4 py-3">
                <div className="tv-label text-slate-500">{c.capitalLabel}</div>
                <div className="tv-figure mt-1 truncate text-xl text-white">
                  {answers.capital ? money(answers.capital) : "—"}
                </div>
              </div>
              <div className="border-l border-[var(--tv-border)] px-4 py-3">
                <div className="tv-label text-slate-500">{c.fRules}</div>
                <div className="tv-figure mt-1 text-xl text-white">{armed}</div>
              </div>
              <div className="col-span-2 border-t border-[var(--tv-border)] px-4 py-3 sm:col-span-1 sm:border-l sm:border-t-0">
                <div className="tv-label text-slate-500">{c.fLeak}</div>
                <div className="mt-1 truncate text-[15px] font-semibold text-[var(--tv-highlight)]">
                  {answers.leak ? L.leak[answers.leak].label : "—"}
                </div>
              </div>
            </div>
            {rules.length > 0 && (
              <ul className="space-y-1.5 border-t border-[var(--tv-border)] px-4 py-3">
                {rules.map((r, i) => (
                  <li
                    key={r.id}
                    className="onb-rise flex items-center gap-2 text-[12px] text-slate-300"
                    style={rise(8 + i)}
                  >
                    <Lock className="h-3 w-3 shrink-0 text-[var(--tv-highlight)]" />
                    {r.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Les questions, la calibration et le départ partagent un cadre ── */
  const progress = scene === "calibrate" || scene === "start" ? 1 : (qIndex + 1) / QUESTIONS.length;
  const stepCode = qIndex >= 0 ? STEP_CODES[qIndex] : "SYS-OK";

  let body: ReactNode = null;

  if (scene === "identity") {
    const langs = Object.entries(LANG_NAMES) as [Lang, string][];
    keys.current.enter = next;
    body = (
      <SceneFrame code={STEP_CODES[0]} title={c.idTitle} why={lines.identity}>
        <input
          type="text"
          value={answers.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          placeholder={c.idPlaceholder}
          maxLength={40}
          autoComplete="given-name"
          aria-label={c.idPlaceholder}
          className="onb-rise h-14 w-full rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-5 text-[18px] font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-[var(--tv-border-accent)]"
          style={rise(3)}
        />
        <div className="onb-rise mt-6" style={rise(4)}>
          <div className="tv-label mb-2 text-slate-500">{c.langTitle}</div>
          <div className="flex flex-wrap gap-2">
            {langs.map(([code, name]) => (
              <ChoiceChip
                key={code}
                label={name}
                selected={code === lang}
                onSelect={() => {
                  play("select");
                  setLang(code);
                }}
              />
            ))}
          </div>
        </div>
      </SceneFrame>
    );
  } else if (scene === "arena") {
    const order: Arena[] = ["prop_challenge", "funded", "personal", "demo"];
    keys.current.digits = order.map((id) => () => choose(() => set("arena", id)));
    body = (
      <SceneFrame code={STEP_CODES[1]} title={c.arenaTitle} why={lines.arena}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {order.map((id, i) => (
            <OptionTile
              key={id}
              {...L.arena[id]}
              index={i + 1}
              selected={answers.arena === id}
              onSelect={() => choose(() => set("arena", id))}
              style={rise(3 + i)}
            />
          ))}
        </div>
      </SceneFrame>
    );
  } else if (scene === "account") {
    const sizes: readonly number[] = prop ? PROP_SIZES : CAPITAL_PRESETS;
    const title = prop ? c.firmTitle : answers.arena === "demo" ? c.capTitleDemo : c.capTitle;
    keys.current.enter = next;
    body = (
      <SceneFrame code={STEP_CODES[2]} title={title} why={lines.account}>
        {prop && (
          <div className="onb-rise mb-5" style={rise(3)}>
            <div className="tv-label mb-2 text-slate-500">{c.firmLabel}</div>
            <div className="flex flex-wrap gap-2">
              {PROP_FIRMS.map((f) => (
                <ChoiceChip
                  key={f.id}
                  label={f.name || c.firmOther}
                  selected={answers.firm === f.id}
                  onSelect={() => {
                    play("select");
                    set("firm", f.id);
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div className="onb-rise mb-5" style={rise(4)}>
          <div className="tv-label mb-2 text-slate-500">{prop ? c.sizeLabel : c.capitalLabel}</div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((n) => (
              <ChoiceChip
                key={n}
                mono
                label={formatMoney(n, { currency: parseCurrency(answers.currency), compact: true })}
                selected={answers.capital === n && !customCapital}
                onSelect={() => {
                  play("select");
                  setCustomCapital("");
                  set("capital", n);
                }}
              />
            ))}
            <label className="onb-tile relative inline-flex h-10 items-center gap-1.5 rounded-xl px-3">
              <span className="text-[13px] font-semibold text-slate-500">
                {currencySymbol(parseCurrency(answers.currency))}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={customCapital}
                placeholder={c.capOther}
                aria-label={c.capOther}
                onChange={(e) => {
                  setCustomCapital(e.target.value);
                  const v = Number.parseFloat(e.target.value.replace(",", "."));
                  set("capital", Number.isFinite(v) && v > 0 ? v : null);
                }}
                className="tv-figure w-28 bg-transparent text-[14px] text-white outline-none placeholder:font-sans placeholder:text-[12px] placeholder:font-semibold placeholder:text-slate-600"
              />
            </label>
          </div>
        </div>
        <div className="onb-rise max-w-xs" style={rise(5)}>
          <div className="tv-label mb-2 text-slate-500">{c.currencyLabel}</div>
          <SelectPicker
            variant="field"
            label={c.currencyLabel}
            value={answers.currency}
            onChange={(v) => chooseCurrency(parseCurrency(v))}
            className="rounded-xl text-[14px]"
            searchLabel={t("picker.search")}
            options={CURRENCIES.map((cur) => ({
              value: cur.code,
              label: `${cur.code} · ${currencySymbol(cur.code)}`,
              hint: cur.name,
            }))}
          />
        </div>
      </SceneFrame>
    );
  } else if (scene === "markets") {
    const order: Market[] = ["futures", "forex", "stocks", "crypto", "options"];
    const toggle = (m: Market) => {
      play("select");
      set(
        "assets",
        answers.assets.includes(m) ? answers.assets.filter((x) => x !== m) : [...answers.assets, m],
      );
    };
    keys.current.digits = order.map((m) => () => toggle(m));
    keys.current.enter = next;
    body = (
      <SceneFrame code={STEP_CODES[3]} title={c.assetsTitle} why={lines.markets}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {order.map((m, i) => (
            <OptionTile
              key={m}
              {...L.market[m]}
              multi
              selected={answers.assets.includes(m)}
              onSelect={() => toggle(m)}
              style={rise(3 + i)}
              compact
            />
          ))}
        </div>
        {offersIct(answers.assets) && (
          <div
            className="onb-rise mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-4 py-3"
            style={rise(8)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                <Crosshair className="h-4 w-4 text-[var(--tv-highlight)]" /> {c.ictTitle}
              </div>
              <div className="mt-0.5 text-[12px] text-slate-500">{c.ictSub}</div>
            </div>
            <div className="flex gap-1.5">
              <ChoiceChip
                label={c.ictYes}
                selected={answers.usesIct}
                onSelect={() => {
                  play("select");
                  set("usesIct", true);
                }}
              />
              <ChoiceChip
                label={c.ictNo}
                selected={!answers.usesIct}
                onSelect={() => {
                  play("select");
                  set("usesIct", false);
                }}
              />
            </div>
          </div>
        )}
      </SceneFrame>
    );
  } else if (scene === "style") {
    const order: Style[] = ["scalping", "daytrading", "swing"];
    keys.current.digits = order.map((id) => () => choose(() => set("style", id)));
    body = (
      <SceneFrame code={STEP_CODES[4]} title={c.styleTitle} why={lines.style}>
        <div className="grid gap-2.5">
          {order.map((id, i) => (
            <OptionTile
              key={id}
              {...L.style[id]}
              index={i + 1}
              selected={answers.style === id}
              onSelect={() => choose(() => set("style", id))}
              style={rise(3 + i)}
            />
          ))}
        </div>
      </SceneFrame>
    );
  } else if (scene === "experience") {
    const order: Experience[] = ["new", "intermediate", "seasoned", "funded"];
    keys.current.digits = order.map((id) => () => choose(() => set("experience", id)));
    body = (
      <SceneFrame code={STEP_CODES[5]} title={c.expTitle} why={lines.experience}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {order.map((id, i) => (
            <OptionTile
              key={id}
              {...L.experience[id]}
              index={i + 1}
              selected={answers.experience === id}
              onSelect={() => choose(() => set("experience", id))}
              style={rise(3 + i)}
            />
          ))}
        </div>
      </SceneFrame>
    );
  } else if (scene === "leak") {
    const order: Leak[] = ["emotions", "overtrading", "risk", "consistency", "journaling"];
    // Pas d'avance automatique : la réponse de Jarvis mérite d'être lue.
    keys.current.digits = order.map((id) => () => choose(() => set("leak", id), false));
    if (answers.leak) keys.current.enter = next;
    body = (
      <SceneFrame code={STEP_CODES[6]} title={c.painTitle} why={lines.leak}>
        <div className="grid gap-2.5">
          {order.map((id, i) => (
            <OptionTile
              key={id}
              icon={L.leak[id].icon}
              label={L.leak[id].label}
              desc={L.leak[id].desc}
              index={i + 1}
              compact
              selected={answers.leak === id}
              onSelect={() => choose(() => set("leak", id), false)}
              style={rise(3 + i)}
            />
          ))}
        </div>
        {answers.leak && (
          <div
            key={answers.leak}
            className="onb-scene mt-4 rounded-2xl border border-[var(--tv-border-accent)] bg-[var(--tv-plate-1)] px-4 py-3"
          >
            <JarvisLine text={lines.ack} delay={60} />
          </div>
        )}
      </SceneFrame>
    );
  } else if (scene === "guardrails") {
    const focus = guardrailForLeak(answers.leak);
    keys.current.enter = next;
    const card = (
      key: keyof Guardrails,
      i: number,
      icon: LucideIcon,
      label: string,
      control: ReactNode,
      fallback: number,
    ) => {
      const on = g[key] !== null;
      const Icon = icon;
      return (
        <div
          key={key}
          className={cn(
            "onb-tile onb-rise flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center",
            !on && "opacity-70",
          )}
          style={rise(3 + i)}
          data-on={on}
          role="group"
          aria-label={label}
        >
          {on && <LockSweep />}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* La vignette reste sourde : quatre garde-fous armés, c'est quatre
                liserés, pas quatre aplats d'accent. */}
            <span className="onb-glyph onb-glyph-quiet h-10 w-10">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-snug text-white">{label}</div>
              {focus === key && (
                <span className="tv-label mt-1 inline-block rounded-md border border-[var(--tv-border-accent)] px-1.5 py-0.5 text-[var(--tv-highlight)]">
                  {c.grForYou}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {control}
            <button
              type="button"
              onClick={() => {
                play(on ? "unlock" : "lock");
                setGuard({ [key]: on ? null : fallback } as Partial<Guardrails>);
              }}
              aria-pressed={on}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold transition-colors",
                on
                  ? "border-[var(--tv-border-accent)] text-[var(--tv-highlight)]"
                  : "border-[var(--tv-border-strong)] text-slate-400 hover:text-white",
              )}
            >
              {on ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
              {on ? c.grArmed : c.grOff}
            </button>
          </div>
        </div>
      );
    };
    body = (
      <SceneFrame code={STEP_CODES[7]} title={c.grTitle} why={lines.guardrails}>
        <div className="grid gap-2.5">
          {card(
            "riskPct",
            0,
            Target,
            c.grRisk,
            <Stepper
              label={c.grRisk}
              value={g.riskPct ?? 1}
              step={0.25}
              min={0.25}
              max={5}
              disabled={g.riskPct === null}
              format={(v) => `${num(v)}${lang === "fr" ? " %" : "%"}`}
              onChange={(v) => setGuard({ riskPct: v })}
            />,
            1,
          )}
          {card(
            "maxTrades",
            1,
            Timer,
            c.grTrades,
            <Stepper
              label={c.grTrades}
              value={g.maxTrades ?? 4}
              step={1}
              min={1}
              max={20}
              disabled={g.maxTrades === null}
              onChange={(v) => setGuard({ maxTrades: v })}
            />,
            4,
          )}
          {card(
            "stopAfter",
            2,
            Flame,
            c.grStop,
            <Stepper
              label={c.grStop}
              value={g.stopAfter ?? 3}
              step={1}
              min={1}
              max={10}
              disabled={g.stopAfter === null}
              format={(v) => `${v} ${c.grStopUnit}`}
              onChange={(v) => setGuard({ stopAfter: v })}
            />,
            3,
          )}
          {prop &&
            card(
              "dailyLoss",
              3,
              ShieldCheck,
              c.grDaily,
              <Stepper
                label={c.grDaily}
                value={g.dailyLoss ?? 500}
                step={100}
                min={100}
                max={100_000}
                disabled={g.dailyLoss === null}
                format={money}
                onChange={(v) => setGuard({ dailyLoss: v })}
              />,
              Math.max(100, Math.round(((answers.capital ?? 50_000) * 0.02) / 100) * 100),
            )}
        </div>
        {push.isSupported && (
          <button
            type="button"
            onClick={askNotify}
            disabled={notify === "busy" || notify === "on"}
            className="onb-tile onb-rise mt-3 flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
            style={rise(8)}
            aria-pressed={notify === "on"}
          >
            <span className="onb-glyph h-9 w-9">
              {notify === "busy" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-white">
                {notify === "on" ? c.grNotifyOn : c.grNotify}
              </span>
              {notify === "blocked" && (
                <span className="mt-0.5 block text-[12px] text-slate-500">{c.grNotifyBlocked}</span>
              )}
            </span>
            {notify === "on" && (
              <Check className="h-4 w-4 text-[var(--tv-highlight)]" strokeWidth={3} />
            )}
          </button>
        )}
      </SceneFrame>
    );
  } else if (scene === "mission") {
    const order = goalOrder(answers.arena);
    keys.current.digits = order.map((id) => () => choose(() => set("goal", id), false));
    keys.current.enter = next;
    body = (
      <SceneFrame code={STEP_CODES[8]} title={c.goalTitle} why={lines.mission}>
        <div className="grid gap-2.5">
          {order.map((id, i) => (
            <OptionTile
              key={id}
              {...L.goal[id]}
              index={i + 1}
              compact
              selected={answers.goal === id}
              onSelect={() => choose(() => set("goal", id), false)}
              style={rise(3 + i)}
            />
          ))}
        </div>
        <div className="onb-rise mt-5" style={rise(9)}>
          <div className="tv-label mb-2 text-slate-500">{c.targetLabel}</div>
          <div className="flex flex-wrap gap-2">
            <ChoiceChip
              label={c.targetNone}
              selected={answers.monthlyTarget === null}
              onSelect={() => {
                play("select");
                set("monthlyTarget", null);
              }}
            />
            {TARGET_PRESETS.map((p) => (
              <ChoiceChip
                key={p}
                mono
                label={`${p}%`}
                selected={answers.monthlyTarget === p}
                onSelect={() => {
                  play("select");
                  set("monthlyTarget", p);
                }}
              />
            ))}
          </div>
        </div>
      </SceneFrame>
    );
  } else if (scene === "look") {
    // Le thème signature d'abord, en grand ; les autres en vis-à-vis, chacun
    // peint par ses propres couleurs pour qu'on les compare d'un regard.
    const themes = [
      ...BUILTIN_THEMES.filter((th) => th.id === DEFAULT_THEME_ID),
      ...BUILTIN_THEMES.filter((th) => th.id !== DEFAULT_THEME_ID),
    ];
    const pick = (id: string) => {
      play("select");
      setTheme(id);
    };
    keys.current.digits = themes.map((th) => () => pick(th.id));
    keys.current.enter = next;
    body = (
      <SceneFrame code={STEP_CODES[9]} title={c.lookTitle} why={lines.look}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {themes.map((th, i) => (
            <ThemeCard
              key={th.id}
              theme={th}
              desc={c.themeDesc[th.id] ?? ""}
              tag={th.id === DEFAULT_THEME_ID ? c.lookDefault : undefined}
              wide={th.id === DEFAULT_THEME_ID}
              index={i + 1}
              selected={themeId === th.id}
              onSelect={() => pick(th.id)}
              style={rise(3 + i)}
            />
          ))}
        </div>
      </SceneFrame>
    );
  } else if (scene === "calibrate") {
    if (calDone) keys.current.enter = () => goTo("start");
    body = (
      <div className="onb-scene w-full">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--tv-highlight)]">
          <span className="h-px w-6 bg-[var(--tv-accent)]" />
          {calDone ? c.systemComplete : c.systemCalibrating}
        </div>
        <h2 className="text-[clamp(1.45rem,3.2vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
          {calDone ? c.revealTitle : c.calTitle}
        </h2>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-[var(--tv-plate-2)]">
          <div
            className="onb-bar h-full bg-[var(--tv-accent)]"
            style={{ transform: `scaleX(${Math.min(1, calStep / calLines.length)})` }}
          />
        </div>
        <ul className="mt-5 space-y-2.5" aria-live="polite">
          {calLines.map((line, i) =>
            i <= calStep ? (
              <li
                key={line}
                className="onb-rise flex items-center gap-3 text-[13px] text-slate-300"
              >
                {i < calStep ? (
                  <span className="onb-pop grid h-5 w-5 place-items-center rounded-md tv-accent-fill">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--tv-highlight)]" />
                )}
                <span className={i < calStep ? "text-slate-200" : "text-slate-400"}>{line}</span>
              </li>
            ) : null,
          )}
        </ul>
        {save === "error" && (
          <div
            className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3"
            role="alert"
          >
            <p className="flex-1 text-[13px] text-red-300">{c.calError}</p>
            <button
              type="button"
              onClick={() => void persist()}
              className="text-[12px] font-bold text-red-200 transition-colors hover:text-white"
            >
              {c.calRetry}
            </button>
          </div>
        )}
        {calDone && (
          <div className="onb-scene mt-6">
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tv-highlight)]" />
              {c.calHonest}
            </p>
            <button
              type="button"
              onClick={() => goTo("start")}
              className="onb-cta tv-accent-fill mt-5 inline-flex h-12 w-full items-center justify-center gap-2 text-[15px] font-bold"
              autoFocus
            >
              {c.cont} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  } else if (scene === "start") {
    type StartOption = {
      id: OnboardingAction;
      icon?: LucideIcon;
      media?: ReactNode;
      label: string;
      desc: string;
      badge?: string;
      disabled?: boolean;
    };
    // Le vrai logo de Tradovate : le trader reconnaît d'un coup d'œil ce
    // qu'il pourra brancher. Tant que la connexion n'est pas ouverte sur ce
    // serveur, la carte le DIT (« En cours ») et ne mène nulle part.
    const tradovate: StartOption = {
      id: "broker",
      media: <img src={tradovateLogo} alt="" width={44} height={44} draggable={false} />,
      label: brokerReady ? c.startBroker : "Tradovate",
      desc: brokerReady ? c.startBrokerD : c.startBrokerSoonD,
      badge: brokerReady ? undefined : c.startBrokerSoon,
      disabled: !brokerReady,
    };
    const options: StartOption[] = [
      { id: "import", icon: Upload, label: c.startImport, desc: c.startImportD },
      ...(wantsBroker && brokerReady ? [tradovate] : []),
      { id: "demo", icon: PlayCircle, label: c.startDemo, desc: c.startDemoD },
      ...(wantsBroker && !brokerReady ? [tradovate] : []),
    ];
    const live = options.filter((o) => !o.disabled);
    keys.current.digits = live.map((o) => () => launch(o.id));
    body = (
      <div className="onb-scene w-full">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--tv-highlight)]">
          <span className="h-px w-6 bg-[var(--tv-accent)]" />
          GO
        </div>
        <h2 className="text-[clamp(1.45rem,3.2vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
          {c.startTitle}
        </h2>
        <JarvisLine text={lines.start} className="mt-3 mb-6" />
        <div className="grid gap-2.5">
          {options.map((o, i) => (
            <OptionTile
              key={o.id}
              icon={o.icon}
              media={o.media}
              label={o.label}
              desc={o.desc}
              badge={o.badge}
              disabled={o.disabled}
              index={o.disabled ? undefined : live.indexOf(o) + 1}
              selected={launching === o.id}
              onSelect={() => launch(o.id)}
              style={rise(3 + i)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => launch("fresh")}
          className="mt-4 w-full py-2.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
        >
          {c.startFresh}
        </button>
      </div>
    );
  }

  // Les écrans à choix multiples ou à saisie ont un bouton « Continuer » ;
  // les choix uniques avancent seuls (et restent passables).
  const needsContinue =
    scene === "identity" ||
    scene === "account" ||
    scene === "markets" ||
    (scene === "leak" && answers.leak !== null) ||
    scene === "guardrails" ||
    scene === "mission" ||
    scene === "look";
  const canSkip = qIndex >= 0 && scene !== "identity" && scene !== "guardrails" && scene !== "look";

  return (
    <div className="onb-root relative flex h-dvh w-full overflow-hidden">
      <OnboardingField />
      <MarketPulse step={Math.max(0, qIndex + 1)} />

      {/* ── Le rail des modules (bureau) ── */}
      <aside className="relative z-20 hidden w-64 shrink-0 flex-col border-r border-[var(--tv-border)] bg-[rgb(var(--tv-bg-rgb)/0.72)] px-5 py-6 lg:flex">
        <div className="flex items-center gap-2.5">
          <img
            src={logoSrc}
            alt=""
            width={27}
            height={27}
            className="h-[27px] w-[27px] rounded-md"
          />
          <span className="text-[15px] font-semibold tracking-tight text-white">TradeVault</span>
        </div>
        <div className="mt-10 font-mono text-[9px] uppercase tracking-[0.22em] text-slate-600">
          {c.systemModules}
        </div>
        <ol className="mt-3 space-y-0.5">
          {QUESTIONS.map((q, index) => {
            const done = qIndex < 0 ? true : index < qIndex;
            const active = index === qIndex;
            return (
              <li key={q}>
                <button
                  type="button"
                  disabled={!done || scene === "calibrate" || scene === "start"}
                  onClick={() => goTo(q, "back")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.08em] transition-colors disabled:cursor-default",
                    active
                      ? "bg-[var(--tv-plate-2)] text-white"
                      : done
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-700",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border",
                      done
                        ? "border-[var(--tv-accent)] bg-[var(--tv-accent)] text-[var(--tv-bg)]"
                        : active
                          ? "border-[var(--tv-accent)]"
                          : "border-[var(--tv-border-strong)]",
                    )}
                  >
                    {done ? (
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    ) : active ? (
                      <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{STEP_CODES[index]}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto space-y-2 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-3 font-mono text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">SYSTEM</span>
            <span className="flex items-center gap-1.5 text-[var(--tv-highlight)]">
              <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />
              {scene === "start" || calDone ? c.systemComplete : c.systemCalibrating}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>SYNC</span>
            <span className="tv-figure tv-figure-secondary text-[10px]">
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>VAULT</span>
            <Lock className="h-3 w-3" />
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Barre haute : retour · progression segmentée · code · son */}
        <header className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-3 px-4 pt-4 md:px-6">
          {qIndex > 0 ? (
            <button
              type="button"
              onClick={back}
              aria-label={c.back}
              className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-6" />
          )}
          <div className="flex flex-1 gap-1" aria-hidden>
            {QUESTIONS.map((q, index) => (
              <span
                key={q}
                className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]"
              >
                <span
                  className="onb-bar absolute inset-0 bg-[var(--tv-accent)]"
                  style={{
                    transform: `scaleX(${qIndex < 0 || index < qIndex ? 1 : index === qIndex ? 0.5 : 0})`,
                  }}
                />
              </span>
            ))}
          </div>
          <span className="tv-figure tv-figure-secondary shrink-0 text-[10px] text-slate-600">
            {stepCode}
          </span>
          {soundButton}
        </header>

        {/* Le dossier, en une ligne, partout où le dossier complet n'a pas
            sa colonne : chaque réponse s'y voit écrite. */}
        {qIndex >= 0 && (
          <div className="mx-auto w-full max-w-[628px] shrink-0 px-4 pt-3 md:px-6 xl:hidden">
            <FileTicker
              title={c.fileTitle}
              empty={c.fileEmpty}
              rows={fileRows}
              onOpen={() => {
                play("tick");
                setFileOpen(true);
              }}
            />
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 justify-center overflow-y-auto px-4 pb-6 pt-6 md:px-6 md:pt-10">
          <div className="flex w-full max-w-[1080px] items-start justify-center gap-8">
            <div key={scene} className="w-full max-w-[580px]">
              {body}
              {needsContinue && (
                <button
                  type="button"
                  onClick={next}
                  className="onb-cta onb-rise tv-accent-fill mt-7 inline-flex h-12 w-full items-center justify-center gap-2 text-[15px] font-bold"
                  style={rise(10)}
                >
                  {c.cont} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {canSkip && (
                <button
                  type="button"
                  onClick={next}
                  className="mt-2.5 w-full py-2 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
                >
                  {c.skip}
                </button>
              )}
            </div>
            {/* Le dossier trader : la preuve en direct que chaque réponse sert. */}
            <TraderFile
              className="sticky top-0 hidden w-[300px] shrink-0 xl:block"
              title={c.fileTitle}
              live={c.fileLive}
              empty={c.fileEmpty}
              rows={fileRows}
            />
          </div>
        </div>
      </main>

      <Sheet
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        title={c.fileTitle}
        subtitle={c.fileSheetSub}
      >
        <TraderFile
          headless
          title={c.fileTitle}
          live={c.fileLive}
          empty={c.fileEmpty}
          pending={c.filePending}
          rows={fileRows}
        />
      </Sheet>
    </div>
  );
}
