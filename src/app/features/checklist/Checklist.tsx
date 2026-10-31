import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Flame, SlidersHorizontal } from "@/shared/ui/icons";
import { Button, PageContainer, PageToolbar } from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import type { Page, Trade } from "@/app/types";
import {
  closeSession,
  loadChecklistConfig,
  loadMissedOpportunities,
  loadSessions,
  loadTodaySession,
  openSession,
  saveChecklistConfig,
} from "@/app/store";
import { loadTradingRules } from "@/app/trading/tradingRules";
import { loadTradingPlan } from "@/app/trading/tradingPlan";
import { useLiveTable } from "@/app/hooks/useLiveTable";
import { createAutosaveGuard, stableStringify } from "@/app/utils/autosaveGuard";
import { handOff } from "@/app/utils/handoff";
import { useEconomicCalendar } from "@/app/features/news/useEconomicCalendar";
import { startOfWeek } from "@/app/features/news/economicEvents";
import { localDateOf } from "@/shared/calendar-date";
import { computeChecklistStreak } from "./checklistStreak";
import {
  type ChkConfig,
  defaultConfigFor,
  GATE_VERSION,
  isItemOn,
  migrateConfig,
} from "./checklistDefaults";
import { getTimeInZone, hydrateConfig, pad, windowState } from "./helpers";
import ChecklistSettings from "./ChecklistSettings";
import PlanCard from "./PlanCard";
import LiveCard from "./LiveCard";
import { ClosedCard, ReviewCard } from "./ReviewCard";
import { PhaseSteps } from "./checklistParts";
import { BREACH_KEYS, END_KEYS, useBiasWord } from "./checklistLabels";
import { lastTrade, missedPrefill, tradePrefill, tradeReviewPrefill } from "./sessionHandoff";
import {
  activePlan,
  BREACHES,
  dayFacts,
  emptyDay,
  entryBlockers,
  fillGate,
  gateQuestions,
  missedReminder,
  normalizeDay,
  planHistory,
  reduceDay,
  sessionFromSnapshot,
  sessionMemory,
  toSnapshot,
  tradeBreaches,
  type Blocker,
  type Breach,
  type DayAction,
  type DayDefaults,
  type EndReason,
  type MissedReminder,
  type PastSession,
  type SessionDay,
} from "./sessionPlan";
import "./checklist.css";

/* ════════════════════════════════════════════════════════════════════════
   LA CHECKLIST — un plan écrit, une séance tenue, un bilan honnête.

   Trois écrans, un seul à la fois :

   1. PLAN (`PlanCard`) — avant l'ouverture. Le trader relit sa dernière
      leçon, puis ÉCRIT : pourquoi ce biais, scénario A et ses niveaux,
      scénario B facultatif, risque, état. L'application ajoute ce qu'elle
      sait déjà : news rouges, R:R des niveaux, historique « dans le plan /
      hors plan ». Verrouiller fige le plan.
   2. SÉANCE (`LiveCard`) — l'écran gardé ouvert à côté du graphique. Porte
      d'entrée aux questions remplies par le plan, encodage d'un trade sans
      détour, passage au B en un clic. Changer de plan sans l'avoir prévu
      demande un motif écrit et quinze secondes.
   3. BILAN (`ReviewCard`) — chaque trade comparé au plan, une question, une
      leçon. Clos, il s'encode en trade ou en setup manqué, formulaire déjà
      rempli.

   La logique vit dans `sessionPlan.ts` (pure, testée) ; ce fichier ne fait
   que la brancher : stockage, base, horloge, calendrier, journal.
   ════════════════════════════════════════════════════════════════════════ */

interface ChecklistProps {
  setPage: (p: Page) => void;
  onAddTrade: () => void;
  /** Ouvre un trade existant du journal (ajout du bilan à un trade déjà encodé). */
  onEditTrade: (trade: Trade) => void;
  /** Trades du compte actif — les faits du jour et l'historique en dérivent. */
  trades: Trade[];
}

/**
 * L'heure EN COURS dans le fuseau de la séance — pas celle de l'appareil.
 * Un trader à Paris sur la séance de New York lit « fenêtre 09:49 » : son
 * verrou, sa fin de séance et l'heure de son trade doivent parler la même
 * heure, sinon la frise mélange 15:20 et 09:49.
 */
const hhmmIn = (timeZone: string) => {
  const p = getTimeInZone(new Date(), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
};

/** « 2,2 », « 2.2 » ou « 1:2.2 » → 2.2 ; `null` sans règle exploitable. */
function parseMinRR(raw: string): number | null {
  const m = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*$/);
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

export default function Checklist({ setPage, onAddTrade, onEditTrade, trades }: ChecklistProps) {
  const { user } = useAuth();
  const { t, lang } = useT();
  const biasWord = useBiasWord();
  // L'identifiant, pas l'objet : un effet qui dépend de `user` se relancerait à
  // chaque nouvel objet de session, et rejouerait ses écritures.
  const userId = user?.id ?? null;
  const uid = userId ?? "anon";
  const CFG_KEY = `tv-chk-config-${uid}`;
  const LAST_KEY = `tv-chk-${uid}-last`;

  /* ══ Horloge — la minute suffit, rien ici ne vit à la seconde ══ */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const today = localDateOf(new Date(now));
  const DAY_KEY = `tv-chk-${uid}-${today}`;

  /* ══ Configuration (fenêtre + questions d'entrée) ══
     Elle ne se persiste qu'une fois modifiée : des défauts jamais touchés
     suivent la langue de l'application. */
  const touchedRef = useRef<boolean | null>(null);
  if (touchedRef.current === null) {
    try {
      touchedRef.current = !!localStorage.getItem(CFG_KEY);
    } catch {
      touchedRef.current = false;
    }
  }
  const [config, setConfig] = useState<ChkConfig>(() =>
    hydrateConfig(typeof localStorage !== "undefined" ? localStorage.getItem(CFG_KEY) : null, lang),
  );
  useEffect(() => {
    if (!touchedRef.current) setConfig(defaultConfigFor(lang));
  }, [lang]);
  const patchConfig = (p: Partial<ChkConfig>) => {
    touchedRef.current = true;
    setConfig((c) => ({ ...c, ...p }));
  };
  useEffect(() => {
    if (!touchedRef.current) return;
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(config));
    } catch {
      /* quota */
    }
  }, [config, CFG_KEY]);

  /* La config remonte en base (débouncée) pour survivre au changement
     d'appareil. `persistedCfgRef` retient ce que la base contient déjà (JSON
     aux clés triées) : une config arrivée d'ailleurs n'est pas réécrite, sinon
     l'écho rebondirait. `cfgGuard` protège la dernière modification locale
     jusqu'à la réussite de son enregistrement. */
  const persistedCfgRef = useRef<string | null>(null);
  const cfgGuard = useRef(createAutosaveGuard()).current;
  const latestCfgRef = useRef(config);
  latestCfgRef.current = config;
  const saveCfgNow = useCallback(
    (owner: string, cfg: ChkConfig, seq: number) => {
      const json = stableStringify(cfg);
      void saveChecklistConfig(owner, cfg).then((ok) => {
        if (ok) persistedCfgRef.current = json;
        cfgGuard.settle(seq, ok);
      });
    },
    [cfgGuard],
  );
  useEffect(() => {
    if (!touchedRef.current || !userId) return;
    if (stableStringify(config) === persistedCfgRef.current) {
      if (cfgGuard.isDirty() && !cfgGuard.hasFailed()) cfgGuard.settle(cfgGuard.begin(), true);
      return;
    }
    const seq = cfgGuard.begin();
    const id = window.setTimeout(() => saveCfgNow(userId, config, seq), 600);
    return () => window.clearTimeout(id);
  }, [config, userId, cfgGuard, saveCfgNow]);

  const applyRemoteConfig = useCallback(
    (saved: unknown) => {
      const cfg = saved as ChkConfig | null;
      if (!cfg || !Array.isArray(cfg.items)) return;
      // Une config d'avant les questions d'entrée est migrée à la lecture —
      // puis réenregistrée, puisqu'elle diffère de ce que la base contient.
      const next = migrateConfig({ ...defaultConfigFor(lang), ...cfg, gateV: cfg.gateV }, lang);
      const json = stableStringify(next);
      if (json === persistedCfgRef.current) return;
      persistedCfgRef.current = (cfg.gateV ?? 0) < GATE_VERSION ? null : json;
      touchedRef.current = true;
      setConfig(next);
    },
    [lang],
  );
  // Premier passage sur cet appareil : la config construite à l'onboarding (ou
  // réglée ailleurs) est relue depuis la base.
  useEffect(() => {
    if (!userId) return;
    try {
      if (localStorage.getItem(CFG_KEY)) return;
    } catch {
      /* noop */
    }
    let active = true;
    void loadChecklistConfig(userId).then((saved) => {
      if (active) applyRemoteConfig(saved);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  useLiveTable("profiles", () => {
    if (!userId) return;
    if (cfgGuard.isDirty()) {
      if (cfgGuard.hasFailed()) saveCfgNow(userId, latestCfgRef.current, cfgGuard.begin());
      return;
    }
    void loadChecklistConfig(userId).then((saved) => {
      if (!cfgGuard.isDirty()) applyRemoteConfig(saved);
    });
  });

  /* ══ La journée ══
     La clé voyage AVEC la journée : au passage de minuit, l'ancienne journée
     ne peut pas être écrite sous la nouvelle clé. */
  const readDefaults = useCallback((): DayDefaults => {
    try {
      const p = JSON.parse(localStorage.getItem(LAST_KEY) || "null") as Partial<DayDefaults>;
      if (p && typeof p.risk === "string") return { risk: p.risk, maxTrades: Number(p.maxTrades) };
    } catch {
      /* défauts vierges */
    }
    return { risk: "", maxTrades: 1 };
  }, [LAST_KEY]);
  const loadDay = useCallback(
    (key: string): SessionDay => {
      try {
        const raw = localStorage.getItem(key);
        return normalizeDay(raw ? JSON.parse(raw) : null, readDefaults());
      } catch {
        return emptyDay(readDefaults());
      }
    },
    [readDefaults],
  );
  const [st, setSt] = useState(() => ({ key: DAY_KEY, day: loadDay(DAY_KEY) }));
  if (st.key !== DAY_KEY) setSt({ key: DAY_KEY, day: loadDay(DAY_KEY) });
  const day = st.day;
  const stRef = useRef(st);
  stRef.current = st;
  useEffect(() => {
    try {
      localStorage.setItem(st.key, JSON.stringify(st.day));
    } catch {
      /* quota */
    }
  }, [st]);

  const act = useCallback((a: DayAction): SessionDay => {
    const cur = stRef.current;
    const next = reduceDay(cur.day, a);
    if (next !== cur.day) {
      const ns = { key: cur.key, day: next };
      stRef.current = ns;
      setSt(ns);
    }
    return next;
  }, []);

  /* ══ Ce que l'application sait déjà ══ */
  const [stopAfterLosses, setStopAfterLosses] = useState(0);
  const [minRR, setMinRR] = useState<number | null>(null);
  const rulesRef = useRef<{ id: string; text: string }[]>([]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadTradingRules(userId)
      .then((rules) => {
        rulesRef.current = rules.filter((r) => r.enabled).map((r) => ({ id: r.id, text: r.text }));
      })
      .catch(() => {});
    void loadTradingPlan(userId)
      .then((p) => {
        if (!active) return;
        const n = parseInt(p.limits.stopAfterLosses, 10);
        setStopAfterLosses(Number.isFinite(n) && n > 0 ? n : 0);
        setMinRR(parseMinRR(p.risk.minRR));
        // Premier plan jamais écrit : le maximum de trades part de la limite du
        // plan de trading plutôt que d'un 1 arbitraire.
        const max = parseInt(p.limits.maxTradesPerDay, 10);
        let hasLast = false;
        try {
          hasLast = !!localStorage.getItem(LAST_KEY);
        } catch {
          /* noop */
        }
        const d = stRef.current.day;
        if (!hasLast && Number.isFinite(max) && max > 0 && d.phase === "plan" && !d.lockedAt) {
          act({ type: "setPlan", patch: { maxTrades: max } });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, LAST_KEY, act]);

  // Plan verrouillé sur un autre appareil : on le reprend, tant que celui-ci
  // n'a encore rien écrit.
  useEffect(() => {
    if (!userId) return;
    const pristine = (d: SessionDay) =>
      d.phase === "plan" && d.lockedAt === null && d.plan.bias === null;
    if (!pristine(stRef.current.day)) return;
    let active = true;
    void loadTodaySession(userId, today).then((s) => {
      const snap = s?.checklistSnapshot as { v?: unknown } | undefined;
      if (!active || snap?.v !== 2 || !pristine(stRef.current.day)) return;
      const ns = { key: stRef.current.key, day: normalizeDay(snap, readDefaults()) };
      stRef.current = ns;
      setSt(ns);
    });
    return () => {
      active = false;
    };
  }, [userId, today, readDefaults]);

  // Les séances passées : l'historique « dans le plan / hors plan » et la
  // mémoire (dernière leçon, écart le plus fréquent).
  const [past, setPast] = useState<PastSession[]>([]);
  const isClosed = day.phase === "closed";
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadSessions(userId, 120).then((rows) => {
      if (!active) return;
      setPast(
        rows.flatMap((r) => {
          const s =
            r.sessionDate < today ? sessionFromSnapshot(r.sessionDate, r.checklistSnapshot) : null;
          return s ? [s] : [];
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [userId, today, isClosed]);
  const history = useMemo(() => planHistory(past, trades), [past, trades]);
  const memory = useMemo(() => sessionMemory(past), [past]);

  // Le dernier « la prochaine fois » écrit dans les setups manqués : relu
  // avant d'écrire le plan, c'est la boucle qui ferme l'apprentissage.
  const [reminder, setReminder] = useState<MissedReminder | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadMissedOpportunities(userId)
      .then((list) => {
        if (active) setReminder(missedReminder(list));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const facts = useMemo(() => dayFacts(trades, today), [trades, today]);
  const nowDate = new Date(now);
  const win = windowState(config, nowDate);
  const winOpen = win.phase === "open";
  const fmtLeft = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m} min`);

  const weekStart = useMemo(() => startOfWeek(new Date(`${today}T12:00:00`)), [today]);
  const { events } = useEconomicCalendar(weekStart);
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(lang), { hour: "2-digit", minute: "2-digit" }),
    [lang],
  );
  const news = useMemo(
    () =>
      events
        .filter((e) => e.impact === "high" && localDateOf(new Date(e.startsAt)) === today)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((e) => ({
          id: e.id,
          label: `${e.currency} · ${e.title}`,
          time: e.allDay ? null : timeFmt.format(new Date(e.startsAt)),
        })),
    [events, today, timeFmt],
  );

  const streak = useMemo(
    () => (userId ? computeChecklistStreak(window.localStorage, userId).current : 0),
    // `day.locked` : la série se relit quand le verrou change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, day.locked],
  );

  /* ══ Le plan en une ligne — pour la base, le formulaire de trade, le setup manqué ══ */
  const planLine = useCallback(
    (d: SessionDay) => {
      const p = activePlan(d);
      if (p.bias === "none") return t("chk.observation");
      return [
        `${biasWord(p.bias)} → ${p.target.trim()}`,
        `${t("chk.entry")} ${p.entry.trim()}`,
        `${t("chk.invalidation")} ${p.invalidation.trim()}`,
      ].join(" · ");
    },
    [t, biasWord],
  );

  /* ══ Séance en base (`trading_sessions`) ══
     Écriture optimiste : l'écran a déjà changé, la base suit. Un échec réseau
     ne bloque rien — la journée locale reste la vérité de l'écran. */
  const pushSession = useCallback(
    async (d: SessionDay, close = false) => {
      if (!userId) return;
      const s = await openSession(
        userId,
        {
          checklistDone: d.checked.filter(Boolean).length,
          checklistTotal: d.checked.length,
          emotionalState: d.mood,
          activeRules: rulesRef.current,
          checklistSnapshot: toSnapshot(d),
          dailyObjective: planLine(d),
        },
        today,
      );
      if (close && s) await closeSession(s.id, { reviewNote: d.review.note.trim() || null });
    },
    [userId, today, planLine],
  );

  /* ══ Gestes ══ */
  const [tried, setTried] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const lock = () => {
    // L'avance du verrou sur l'ouverture : écrire son plan AVANT l'open est
    // tout l'objet de l'écran, on garde donc la trace du « quand ».
    const lead = -windowState(config, new Date()).sinceStart;
    const next = act({ type: "lock", at: hhmmIn(config.timeZone), lead });
    if (next.phase !== "live") {
      setTried(true);
      return;
    }
    setTried(false);
    try {
      localStorage.setItem(
        LAST_KEY,
        JSON.stringify({ risk: next.plan.risk, maxTrades: next.plan.maxTrades }),
      );
    } catch {
      /* noop */
    }
    void pushSession(next);
  };
  const changePlan = (reason: string) =>
    void pushSession(act({ type: "reopenPlan", at: hhmmIn(config.timeZone), reason }));
  const switchB = () =>
    void pushSession(act({ type: "switchScenario", at: hhmmIn(config.timeZone) }));
  const end = (reason: EndReason) =>
    void pushSession(act({ type: "end", reason, at: hhmmIn(config.timeZone) }));
  const closeDay = () => {
    const next = act({ type: "close" });
    if (next.phase === "closed") void pushSession(next, true);
  };

  /* ══ Vers le journal — le formulaire s'ouvre déjà rempli ══ */
  const encodeTrade = (withReview: boolean) => {
    const d = stRef.current.day;
    handOff(
      "trade",
      tradePrefill({
        day: d,
        date: today,
        now: hhmmIn(config.timeZone),
        last: lastTrade(trades),
        planLine: planLine(d),
        withReview,
      }),
    );
    onAddTrade();
  };
  const reviewTrade = (trade: Trade, index: number) => {
    const d = stRef.current.day;
    handOff("tradeReview", tradeReviewPrefill({ day: d, trade, index, planLine: planLine(d) }));
    onEditTrade(trade);
  };
  const encodeMissed = () => {
    const d = stRef.current.day;
    const reasonText =
      d.review.breaches.length > 0
        ? d.review.breaches.map((b) => t(BREACH_KEYS[b])).join(", ")
        : d.endReason
          ? t(END_KEYS[d.endReason])
          : "";
    handOff(
      "missed",
      missedPrefill({
        day: d,
        date: today,
        last: lastTrade(trades),
        planLine: planLine(d),
        reasonText,
      }),
    );
    setPage("missed");
  };

  /** Ce que les données montrent déjà, proposé quand le trader répond « non ». */
  const observedBreaches = useMemo((): Breach[] => {
    const found = new Set<Breach>();
    facts.trades.forEach((tr, i) =>
      tradeBreaches(tr, i, day.plan, day.scenario).forEach((b) =>
        found.add(b === "direction" ? b : "extra"),
      ),
    );
    if (day.planChanges.length > 0) found.add("planChanged");
    return BREACHES.filter((b) => found.has(b));
  }, [facts, day.plan, day.scenario, day.planChanges]);

  const blockerText = (b: Blocker): string => {
    switch (b) {
      case "observation":
        return t("chk.blockObservation");
      case "maxTrades":
        return t("chk.blockMax");
      case "stopAfterLosses":
        return t("chk.blockLosses").replace("{n}", String(stopAfterLosses));
      case "window":
        return t("chk.blockWindow").replace("{time}", config.startTime);
      case "windowEnded":
        return t("chk.blockWindowEnded").replace("{time}", config.endTime ?? "");
    }
  };
  const blockers = entryBlockers({ plan: day.plan, facts, window: win.phase, stopAfterLosses });

  // Les questions d'entrée, remplies avec le plan EN VIGUEUR (A ou B).
  const questions = useMemo(() => {
    const p = activePlan(day);
    const values = {
      // Biais pas encore choisi : « — », pas « observation » (ce serait un choix).
      bias: p.bias ? biasWord(p.bias) : "",
      target: p.target,
      entry: p.entry,
      inv: p.invalidation,
      risk: p.risk,
    };
    return gateQuestions(config.items.filter(isItemOn).map((it) => it.title)).map((q) => ({
      ...q,
      text: fillGate(q.text, values),
    }));
  }, [config.items, day, biasWord]);

  const dateStr = nowDate.toLocaleDateString(intlLocale(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <PageContainer className="space-y-3 md:space-y-4">
      {/* Le contexte : lu une fois en arrivant. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tv-figure tv-figure-secondary text-xs text-slate-400">{dateStr}</span>
        <span aria-hidden className="h-3 w-px bg-[var(--tv-border)]" />
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold",
            winOpen
              ? "text-[var(--tv-highlight)]"
              : win.phase === "after"
                ? "text-slate-400"
                : "text-amber-300",
          )}
        >
          <Clock className="h-3 w-3" />
          {win.phase === "before"
            ? t("chk.winIn")
                .replace("{time}", config.startTime)
                .replace("{left}", fmtLeft(win.toStart))
            : win.phase === "after"
              ? t("chk.winEnded").replace("{time}", config.endTime ?? "")
              : win.toEnd !== null
                ? t("chk.winLeft")
                    .replace("{left}", fmtLeft(win.toEnd))
                    .replace("{time}", config.endTime ?? "")
                : t("chk.winOpen").replace("{time}", config.startTime)}
        </span>
        {streak > 0 && (
          <>
            <span aria-hidden className="h-3 w-px bg-[var(--tv-border)]" />
            <span
              title={t("chk.streakHint")}
              className="tv-num inline-flex items-center gap-1 text-xs font-bold text-amber-300"
            >
              <Flame className="h-3 w-3" /> {streak} {t("chk.streakSuffix")}
            </span>
          </>
        )}
      </div>

      <PageToolbar
        actions={
          // Une icône seule ne disait pas qu'ici se règlent la fenêtre et les
          // questions d'entrée : le mot accompagne l'icône dès qu'il y a la place.
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setShowSettings(true)}
            aria-label={t("chk.settings")}
            title={t("chk.settings")}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t("chk.settingsShort")}</span>
          </Button>
        }
      >
        <PhaseSteps
          phase={day.phase}
          times={{
            plan: day.lockedAt,
            live: config.endTime ? `${config.startTime}–${config.endTime}` : config.startTime,
            review: day.endedAt,
          }}
        />
      </PageToolbar>

      {day.phase === "plan" && (
        <PlanCard
          day={day}
          act={act}
          tried={tried}
          onLock={lock}
          news={news}
          history={history}
          memory={memory}
          reminder={reminder}
          minRR={minRR}
          questions={questions}
          onCustomize={() => setShowSettings(true)}
        />
      )}

      {day.phase === "live" && (
        <LiveCard
          day={day}
          facts={facts}
          blockers={blockers}
          blockerText={blockerText}
          questions={questions}
          minRR={minRR}
          onLogTrade={() => encodeTrade(false)}
          onSwitchB={switchB}
          onEnd={end}
          onChangePlan={changePlan}
        />
      )}

      {day.phase === "review" && (
        <ReviewCard
          day={day}
          facts={facts}
          act={act}
          observed={observedBreaches}
          onClose={closeDay}
        />
      )}

      {day.phase === "closed" && (
        <ClosedCard
          day={day}
          facts={facts}
          history={history}
          onReopen={() => act({ type: "reopenReview" })}
          onJournal={() => setPage("journal")}
          onEncodeTrade={() => encodeTrade(true)}
          onEncodeMissed={encodeMissed}
          onReviewTrade={reviewTrade}
          questions={questions}
          onCustomize={() => setShowSettings(true)}
        />
      )}

      <ChecklistSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onPatch={patchConfig}
        onResetDay={() => {
          // La séance en base est remise à zéro AUSSI : sans elle, le
          // rechargement suivant reprenait l'ancien plan verrouillé depuis
          // `trading_sessions` (la journée locale vide passe pour « rien
          // d'écrit sur cet appareil »).
          void pushSession(act({ type: "reset", defaults: readDefaults() }));
          setShowSettings(false);
        }}
        onResetConfig={() => {
          touchedRef.current = false;
          try {
            localStorage.removeItem(CFG_KEY);
          } catch {
            /* noop */
          }
          setConfig(defaultConfigFor(lang));
        }}
      />
    </PageContainer>
  );
}
