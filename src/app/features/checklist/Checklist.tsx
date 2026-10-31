import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Flame, SlidersHorizontal, X } from "@/shared/ui/icons";
import {
  Button,
  Card,
  Chip,
  CHIP_ROW,
  ChoiceGroup,
  Field,
  Input,
  PageContainer,
  PageToolbar,
} from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import type { TKey } from "@/app/i18n/translations";
import type { Page, Trade } from "@/app/types";
import {
  closeSession,
  loadChecklistConfig,
  loadSessions,
  loadTodaySession,
  openSession,
  saveChecklistConfig,
} from "@/app/store";
import { loadTradingRules } from "@/app/trading/tradingRules";
import { loadTradingPlan } from "@/app/trading/tradingPlan";
import { EMOTIONAL_STATES, type EmotionalState } from "@/app/trading/readiness";
import { useLiveTable } from "@/app/hooks/useLiveTable";
import { createAutosaveGuard, stableStringify } from "@/app/utils/autosaveGuard";
import { useEconomicCalendar } from "@/app/features/news/useEconomicCalendar";
import { startOfWeek } from "@/app/features/news/economicEvents";
import { localDateOf } from "@/shared/calendar-date";
import { measuredR } from "@/domain/trade";
import { computeChecklistStreak } from "./checklistStreak";
import { type ChkConfig, defaultConfigFor, isItemOn } from "./checklistDefaults";
import { getTimeInZone, hydrateConfig, isWindowOpen, pad, parseTimeToMinutes } from "./helpers";
import ChecklistSettings from "./ChecklistSettings";
import EntryGate from "./EntryGate";
import {
  BREACHES,
  MAX_TRADES_CHOICES,
  RISKY_MOODS,
  dayFacts,
  emptyDay,
  entryBlockers,
  missingFields,
  normalizeDay,
  planFromSnapshot,
  planHistory,
  reduceDay,
  toSnapshot,
  tradeBreaches,
  type Bias,
  type Blocker,
  type Breach,
  type DayAction,
  type DayDefaults,
  type DayFacts,
  type EndReason,
  type PlanField,
  type PlanHistory,
  type SessionDay,
  type SessionPlan,
} from "./sessionPlan";
import "./checklist.css";

/* ════════════════════════════════════════════════════════════════════════
   LA CHECKLIST — un plan écrit, une séance tenue, un bilan honnête.

   Trois écrans, un seul à la fois :

   1. PLAN — avant l'ouverture. Le trader écrit des VALEURS (sens, cible,
      zone, invalidation, risque) et déclare son état. L'application ajoute
      ce qu'elle sait déjà : news rouges du jour, historique « dans le plan /
      hors plan ». Verrouiller fige le plan.
   2. SÉANCE — l'écran qu'on garde ouvert à côté du graphique. Le plan en
      gros, ce qui bloque (fenêtre, trades du jour, pertes), et une porte
      d'entrée qui reprend les chiffres écrits. Trois sorties en un clic.
   3. BILAN — chaque trade du jour comparé au plan, une question, une phrase.

   Ce qui a disparu, et pourquoi : la voix, les sons, les motivations à
   choisir, les quatre états FOMO, le compte à rebours et l'écran « Edge
   Locked ». Tout cela se lisait une fois, puis se cochait par réflexe — et
   en séance, c'était du texte à lire au moment où l'attention appartient
   au graphique. La logique vit dans `sessionPlan.ts`, pure et testée.
   ════════════════════════════════════════════════════════════════════════ */

interface ChecklistProps {
  setPage: (p: Page) => void;
  onAddTrade: () => void;
  /** Trades du compte actif — les faits du jour et l'historique en dérivent. */
  trades: Trade[];
}

const MOOD_KEYS: Record<EmotionalState, TKey> = {
  calm: "session.stateCalm",
  focused: "session.stateFocused",
  tired: "session.stateTired",
  anxious: "session.stateAnxious",
  frustrated: "session.stateFrustrated",
  overconfident: "session.stateOverconfident",
};

const FIELD_KEYS: Record<PlanField, TKey> = {
  bias: "chk.fBias",
  target: "chk.fTarget",
  entry: "chk.fEntry",
  invalidation: "chk.fInvalidation",
  risk: "chk.fRisk",
  mood: "chk.fMood",
};

const BREACH_KEYS: Record<Breach, TKey> = {
  direction: "chk.brDirection",
  chased: "chk.brChased",
  size: "chk.brSize",
  extra: "chk.brExtra",
  window: "chk.brWindow",
  stopMoved: "chk.brStopMoved",
  planChanged: "chk.brPlanChanged",
};

const DIRECTION_KEYS: Record<Trade["direction"], TKey> = {
  long: "common.long",
  short: "common.short",
  be: "common.be",
};

const END_KEYS: Record<EndReason, TKey> = {
  missed: "chk.endMissed",
  invalidated: "chk.endInvalidated",
  done: "chk.endDone",
};

const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Checklist({ setPage, onAddTrade, trades }: ChecklistProps) {
  const { user } = useAuth();
  const { t, lang } = useT();
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

  /* ══ Configuration (fenêtre + critères personnels) ══
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
      const next = { ...defaultConfigFor(lang), ...cfg };
      const json = stableStringify(next);
      if (json === persistedCfgRef.current) return;
      persistedCfgRef.current = json;
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

  const [pastPlans, setPastPlans] = useState<{ date: string; plan: SessionPlan }[]>([]);
  const isClosed = day.phase === "closed";
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadSessions(userId, 120).then((rows) => {
      if (!active) return;
      setPastPlans(
        rows.flatMap((r) => {
          const plan = r.sessionDate < today ? planFromSnapshot(r.checklistSnapshot) : null;
          return plan ? [{ date: r.sessionDate, plan }] : [];
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [userId, today, isClosed]);
  const history = useMemo(() => planHistory(pastPlans, trades), [pastPlans, trades]);

  const facts = useMemo(() => dayFacts(trades, today), [trades, today]);
  const nowDate = new Date(now);
  const winOpen = isWindowOpen(config, nowDate);
  const minutesLeft = (() => {
    const p = getTimeInZone(nowDate, config.timeZone);
    return (parseTimeToMinutes(config.startTime) - (p.hour * 60 + p.minute) + 1440) % 1440;
  })();
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

  /* ══ Séance en base (`trading_sessions`) ══
     Écriture optimiste : l'écran a déjà changé, la base suit. Un échec réseau
     ne bloque rien — la journée locale reste la vérité de l'écran. */
  const biasWord = useCallback(
    (b: Bias | null) =>
      b === "long"
        ? t("common.long").toUpperCase()
        : b === "short"
          ? t("common.short").toUpperCase()
          : t("chk.observation"),
    [t],
  );
  const pushSession = useCallback(
    async (d: SessionDay, close = false) => {
      if (!userId) return;
      const objective =
        d.plan.bias === "none"
          ? t("chk.observation")
          : `${biasWord(d.plan.bias)} → ${d.plan.target.trim()}`;
      const s = await openSession(
        userId,
        {
          checklistDone: d.checked.filter(Boolean).length,
          checklistTotal: d.checked.length,
          emotionalState: d.mood,
          activeRules: rulesRef.current,
          checklistSnapshot: toSnapshot(d),
          dailyObjective: objective,
        },
        today,
      );
      if (close && s) await closeSession(s.id, { reviewNote: d.review.note.trim() || null });
    },
    [userId, today, t, biasWord],
  );

  /* ══ Gestes ══ */
  const [tried, setTried] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const lock = () => {
    const next = act({ type: "lock", at: nowHHMM() });
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
  const changePlan = () => {
    setConfirmChange(false);
    void pushSession(act({ type: "reopenPlan", at: nowHHMM() }));
  };
  const end = (reason: EndReason) => void pushSession(act({ type: "end", reason, at: nowHHMM() }));
  const closeDay = () => {
    const next = act({ type: "close" });
    if (next.phase === "closed") void pushSession(next, true);
  };

  /** Ce que les données montrent déjà, proposé quand le trader répond « non ». */
  const observedBreaches = useMemo((): Breach[] => {
    const found = new Set<Breach>();
    facts.trades.forEach((tr, i) =>
      tradeBreaches(tr, i, day.plan).forEach((b) => found.add(b === "direction" ? b : "extra")),
    );
    if (day.planChanges.length > 0) found.add("planChanged");
    return BREACHES.filter((b) => found.has(b));
  }, [facts, day.plan, day.planChanges]);

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
    }
  };
  const blockers = entryBlockers({ plan: day.plan, facts, windowOpen: winOpen, stopAfterLosses });

  const customTitles = useMemo(
    () => config.items.filter(isItemOn).map((it) => it.title),
    [config.items],
  );

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
            winOpen ? "text-[var(--tv-highlight)]" : "text-amber-300",
          )}
        >
          <Clock className="h-3 w-3" />
          {winOpen
            ? t("chk.winOpen").replace("{time}", config.startTime)
            : t("chk.winIn")
                .replace("{time}", config.startTime)
                .replace("{left}", fmtLeft(minutesLeft))}
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
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label={t("chk.settings")}
            title={t("chk.settings")}
            className="tv-chk-tool"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        }
      >
        <PhaseSteps phase={day.phase} />
      </PageToolbar>

      {day.phase === "plan" && (
        <PlanCard day={day} act={act} tried={tried} onLock={lock} news={news} history={history} />
      )}

      {day.phase === "live" && (
        <Card variant="glass" pad="default" className="space-y-4">
          <PlanHud day={day} facts={facts} biasWord={biasWord} />

          <p
            className={cn(
              "text-sm font-semibold",
              blockers.length === 0
                ? "text-[var(--tv-highlight)]"
                : // Ne pas trader était le plan : un choix tenu, pas une alerte.
                  blockers[0] === "observation"
                  ? "text-slate-300"
                  : blockers[0] === "window"
                    ? "text-amber-300"
                    : "text-red-400",
            )}
          >
            {blockers.length === 0 ? t("chk.readyLine") : blockerText(blockers[0])}
          </p>

          <TradeLines facts={facts} plan={day.plan} onlyOff />

          {day.plan.bias !== "none" && (
            <EntryGate
              plan={day.plan}
              customTitles={customTitles}
              blocked={blockers.length > 0 ? blockerText(blockers[0]) : null}
              onLogTrade={onAddTrade}
            />
          )}

          <div className="space-y-2 border-t border-[var(--tv-border)] pt-3">
            <span className="tv-label text-slate-500">{t("chk.end")}</span>
            <div className="flex flex-wrap gap-2">
              {(day.plan.bias === "none"
                ? (["done"] as const)
                : (["missed", "invalidated", "done"] as const)
              ).map((r) => (
                <Button key={r} variant="subtle" size="sm" onClick={() => end(r)}>
                  {t(END_KEYS[r])}
                </Button>
              ))}
            </div>
          </div>

          {confirmChange ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <span className="flex-1 text-xs font-semibold text-amber-300">
                {t("chk.changeConfirm")}
              </span>
              <Button variant="subtle" size="sm" onClick={() => setConfirmChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" size="sm" onClick={changePlan}>
                {t("common.confirm")}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmChange(true)}
              className="text-xs font-semibold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-300"
            >
              {t("chk.changePlan")}
            </button>
          )}
        </Card>
      )}

      {day.phase === "review" && (
        <ReviewCard
          day={day}
          facts={facts}
          act={act}
          observed={observedBreaches}
          onClose={closeDay}
          onAddTrade={onAddTrade}
          onMissed={() => setPage("missed")}
        />
      )}

      {day.phase === "closed" && (
        <Card variant="glass" pad="default" className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                day.review.respected
                  ? "tv-accent-fill"
                  : "border border-red-500/30 bg-red-500/10 text-red-400",
              )}
            >
              {day.review.respected ? (
                <Check className="h-4 w-4" strokeWidth={3} />
              ) : (
                <X className="h-4 w-4" strokeWidth={3} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="tv-title">{t("chk.closedTitle")}</h2>
              <p className="tv-row-label">
                {day.review.respected ? t("chk.closedYes") : t("chk.closedNo")}
                {day.review.breaches.length > 0 &&
                  ` · ${day.review.breaches.map((b) => t(BREACH_KEYS[b])).join(", ")}`}
              </p>
            </div>
          </div>
          {day.review.note.trim() && (
            <p className="tv-prose text-slate-300">« {day.review.note.trim()} »</p>
          )}
          <TradeLines facts={facts} plan={day.plan} />
          <HistoryLine history={history} />
          <p className="tv-prose text-slate-500">{t("chk.tomorrow")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" size="sm" onClick={() => setPage("journal")}>
              {t("chk.journal")}
            </Button>
            <Button variant="subtle" size="sm" onClick={() => act({ type: "reopenReview" })}>
              {t("chk.reopenReview")}
            </Button>
          </div>
        </Card>
      )}

      <ChecklistSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onPatch={patchConfig}
        onResetDay={() => {
          act({ type: "reset", defaults: readDefaults() });
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

/* ══════════════════════════════ Morceaux ══════════════════════════════ */

/** Où en est la journée — trois mots, l'étape courante en clair. */
function PhaseSteps({ phase }: { phase: SessionDay["phase"] }) {
  const { t } = useT();
  const order = ["plan", "live", "review"] as const;
  const idx = phase === "closed" ? order.length : order.indexOf(phase);
  const labels: Record<(typeof order)[number], TKey> = {
    plan: "chk.phasePlan",
    live: "chk.phaseLive",
    review: "chk.phaseReview",
  };
  return (
    <ol className="flex items-center gap-2 pl-1.5">
      {order.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-px w-4 bg-[var(--tv-border-strong)]" />}
          <span
            aria-current={i === idx ? "step" : undefined}
            className={cn(
              "tv-label",
              i === idx ? "text-white" : i < idx ? "text-[var(--tv-highlight)]" : "text-slate-500",
            )}
          >
            {t(labels[p])}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PlanCard({
  day,
  act,
  tried,
  onLock,
  news,
  history,
}: {
  day: SessionDay;
  act: (a: DayAction) => SessionDay;
  tried: boolean;
  onLock: () => void;
  news: { id: string; label: string; time: string | null }[];
  history: PlanHistory;
}) {
  const { t } = useT();
  const { plan, mood } = day;
  const set = (patch: Partial<SessionPlan>) => act({ type: "setPlan", patch });
  const missing = missingFields(plan, mood);
  const directional = plan.bias === "long" || plan.bias === "short";

  return (
    <Card variant="glass" pad="default" className="space-y-4">
      <div>
        <h2 className="tv-title">{t("chk.planTitle")}</h2>
        <p className="tv-row-label">{t("chk.planHint")}</p>
      </div>

      <Field label={t("chk.bias")}>
        <ChoiceGroup<Bias>
          label={t("chk.bias")}
          value={plan.bias}
          options={[
            { value: "long", label: t("common.long"), tone: "positive" },
            { value: "short", label: t("common.short"), tone: "negative" },
            { value: "none", label: t("chk.biasNone") },
          ]}
          onChange={(bias) => set({ bias })}
        />
      </Field>

      {plan.bias === "none" && <p className="tv-prose text-slate-400">{t("chk.observeNote")}</p>}

      {directional && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("chk.target")} htmlFor="chk-target">
              <Input
                id="chk-target"
                value={plan.target}
                placeholder={t("chk.targetPh")}
                onChange={(e) => set({ target: e.target.value })}
              />
            </Field>
            <Field label={t("chk.entry")} htmlFor="chk-entry">
              <Input
                id="chk-entry"
                value={plan.entry}
                placeholder={t("chk.entryPh")}
                onChange={(e) => set({ entry: e.target.value })}
              />
            </Field>
            <Field label={t("chk.invalidation")} htmlFor="chk-inv">
              <Input
                id="chk-inv"
                value={plan.invalidation}
                placeholder={t("chk.invalidationPh")}
                onChange={(e) => set({ invalidation: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("chk.risk")} htmlFor="chk-risk">
              <Input
                id="chk-risk"
                inputMode="decimal"
                value={plan.risk}
                placeholder="250"
                onChange={(e) => set({ risk: e.target.value })}
              />
            </Field>
            <Field label={t("chk.maxTrades")}>
              <ChoiceGroup<number>
                label={t("chk.maxTrades")}
                value={plan.maxTrades}
                options={MAX_TRADES_CHOICES.map((n) => ({ value: n, label: String(n) }))}
                onChange={(maxTrades) => set({ maxTrades })}
              />
            </Field>
          </div>
        </>
      )}

      <Field label={t("chk.mood")}>
        <div className={CHIP_ROW}>
          {EMOTIONAL_STATES.map((m) => (
            <Chip
              key={m}
              selected={mood === m}
              tone={RISKY_MOODS.includes(m) ? "warning" : "accent"}
              onClick={() => act({ type: "setMood", mood: mood === m ? null : m })}
            >
              {t(MOOD_KEYS[m])}
            </Chip>
          ))}
        </div>
      </Field>
      {mood && RISKY_MOODS.includes(mood) && (
        <p className="tv-prose font-semibold text-amber-300">{t("chk.moodRisky")}</p>
      )}

      {/* Ce que l'application sait déjà — lu, jamais demandé. */}
      <Card variant="inset" pad="tight" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tv-label text-slate-500">{t("chk.news")}</span>
          {news.length === 0 ? (
            <span className="text-xs text-slate-400">{t("chk.newsNone")}</span>
          ) : (
            news.slice(0, 3).map((n) => (
              <span key={n.id} className="text-xs font-semibold text-red-400">
                {n.label}
                {n.time && <span className="tv-figure tv-figure-secondary"> {n.time}</span>}
              </span>
            ))
          )}
          {news.length > 3 && (
            <span className="tv-num text-xs text-slate-500">+{news.length - 3}</span>
          )}
        </div>
        <HistoryLine history={history} />
      </Card>

      <div className="space-y-2">
        <Button className="h-12 w-full text-sm font-bold" onClick={onLock}>
          {plan.bias === "none" ? t("chk.lockObserve") : t("chk.lock")}
        </Button>
        {tried && missing.length > 0 && (
          <p className="tv-prose text-amber-300" role="status">
            {t("chk.missing").replace("{list}", missing.map((f) => t(FIELD_KEYS[f])).join(", "))}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Le plan verrouillé, lisible d'un coup d'œil à côté du graphique. */
function PlanHud({
  day,
  facts,
  biasWord,
}: {
  day: SessionDay;
  facts: DayFacts;
  biasWord: (b: Bias | null) => string;
}) {
  const { t } = useT();
  const { plan } = day;
  const tone =
    plan.bias === "long"
      ? "text-emerald-400"
      : plan.bias === "short"
        ? "text-red-400"
        : "text-slate-300";
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn("text-2xl font-extrabold tracking-[-0.02em]", tone)}>
            {biasWord(plan.bias)}
          </div>
          <p className="tv-row-label">
            {t("chk.lockedAt").replace("{time}", day.lockedAt ?? "—")}
            {day.planChanges.length > 0 &&
              ` · ${t("chk.changed").replace("{n}", String(day.planChanges.length))}`}
          </p>
        </div>
        {plan.bias !== "none" && (
          <div className="text-right">
            <div className="tv-figure text-xl text-white">
              {facts.count}/{plan.maxTrades}
            </div>
            <span className="tv-label text-slate-500">{t("chk.trades")}</span>
          </div>
        )}
      </div>
      {plan.bias !== "none" && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["chk.target", plan.target],
              ["chk.entry", plan.entry],
              ["chk.invalidation", plan.invalidation],
              ["chk.risk", plan.risk],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className="min-w-0 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2"
            >
              <dt className="tv-label text-slate-500">{t(k)}</dt>
              <dd className="truncate text-sm font-semibold text-white">{v.trim()}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Les trades du jour, chacun confronté au plan écrit. */
function TradeLines({
  facts,
  plan,
  onlyOff = false,
}: {
  facts: DayFacts;
  plan: SessionPlan;
  onlyOff?: boolean;
}) {
  const { t, lang } = useT();
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale(lang), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      }),
    [lang],
  );
  const rows = facts.trades
    .map((tr, i) => ({ tr, breaches: tradeBreaches(tr, i, plan) }))
    .filter((r) => !onlyOff || r.breaches.length > 0);
  if (rows.length === 0) return null;
  const why: Record<string, TKey> = {
    direction: "chk.tbDirection",
    extra: "chk.tbExtra",
    observation: "chk.tbObservation",
  };
  return (
    <ul className="space-y-1">
      {rows.map(({ tr, breaches }) => {
        const r = measuredR(tr);
        const off = breaches.length > 0;
        return (
          <li key={tr.id} className="flex items-baseline gap-2 text-xs">
            <span className="tv-figure tv-figure-secondary w-10 shrink-0 text-slate-400">
              {tr.entryTime || "—"}
            </span>
            <span className="w-12 shrink-0 font-semibold uppercase text-slate-300">
              {t(DIRECTION_KEYS[tr.direction])}
            </span>
            <span
              className={cn(
                "tv-figure w-12 shrink-0",
                r === null ? "text-slate-500" : r >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {r === null ? "—" : `${fmt.format(r)}R`}
            </span>
            <span
              className={cn(
                // Le motif se lit en entier, quitte à passer à la ligne : un
                // « hors plan · contre le bi… » ne dit pas ce qui a dérapé.
                "min-w-0 flex-1 font-semibold",
                off ? "text-red-400" : "text-[var(--tv-highlight)]",
              )}
            >
              {off
                ? `${t("chk.offPlanTag")} · ${breaches.map((b) => t(why[b])).join(", ")}`
                : t("chk.inPlanTag")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Dans le plan / hors plan : le chiffre qui donne sa valeur au rituel. */
function HistoryLine({ history }: { history: PlanHistory }) {
  const { t, lang } = useT();
  if (history.inPlan.n + history.offPlan.n === 0) return null;
  const fmt = new Intl.NumberFormat(intlLocale(lang), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const cell = (key: TKey, b: PlanHistory["inPlan"]) => (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-slate-400">{t(key)}</span>
      {b.avgR !== null ? (
        <span
          className={cn("tv-figure", b.avgR >= 0 ? "text-emerald-400" : "text-red-400")}
        >{`${fmt.format(b.avgR)}R`}</span>
      ) : null}
      <span className="tv-num text-slate-500">
        {b.avgR !== null
          ? `n=${b.n}`
          : t("chk.sampleLow")
              .replace("{n}", String(b.n))
              .replace("{min}", String(history.minSample))}
      </span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="tv-label text-slate-500">{t("chk.history")}</span>
      {cell("chk.inPlan", history.inPlan)}
      {cell("chk.offPlan", history.offPlan)}
    </div>
  );
}

function ReviewCard({
  day,
  facts,
  act,
  observed,
  onClose,
  onAddTrade,
  onMissed,
}: {
  day: SessionDay;
  facts: DayFacts;
  act: (a: DayAction) => SessionDay;
  observed: Breach[];
  onClose: () => void;
  onAddTrade: () => void;
  onMissed: () => void;
}) {
  const { t } = useT();
  const { review } = day;
  const setReview = (patch: Partial<SessionDay["review"]>) => act({ type: "setReview", patch });
  return (
    <Card variant="glass" pad="default" className="space-y-4">
      <div>
        <h2 className="tv-title">{t("chk.reviewTitle")}</h2>
        {day.endReason && (
          <p className="tv-row-label">
            {t(END_KEYS[day.endReason])}
            {day.endedAt ? ` · ${day.endedAt}` : ""}
            {day.planChanges.length > 0 &&
              ` · ${t("chk.planChangedAt").replace("{times}", day.planChanges.join(", "))}`}
          </p>
        )}
      </div>

      {facts.count > 0 ? (
        <TradeLines facts={facts} plan={day.plan} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">{t("chk.reviewNoTrades")}</span>
          {day.plan.bias !== "none" && (
            <Button variant="subtle" size="sm" onClick={onAddTrade}>
              {t("chk.logTrade")}
            </Button>
          )}
        </div>
      )}
      {day.endReason === "missed" && (
        <Button variant="subtle" size="sm" onClick={onMissed}>
          {t("chk.logMissed")}
        </Button>
      )}

      <Field label={t("chk.respected")}>
        <ChoiceGroup<"yes" | "no">
          label={t("chk.respected")}
          value={review.respected === null ? null : review.respected ? "yes" : "no"}
          options={[
            { value: "yes", label: t("chk.yes"), tone: "positive" },
            { value: "no", label: t("chk.no"), tone: "negative" },
          ]}
          onChange={(v) =>
            setReview(
              v === "yes"
                ? { respected: true }
                : // Les écarts que les données montrent déjà sont proposés : le
                  // trader corrige, il ne retape pas.
                  {
                    respected: false,
                    breaches: review.breaches.length > 0 ? review.breaches : observed,
                  },
            )
          }
        />
      </Field>

      {review.respected === false && (
        <Field label={t("chk.breaches")}>
          <div className={CHIP_ROW}>
            {BREACHES.map((b) => {
              const on = review.breaches.includes(b);
              return (
                <Chip
                  key={b}
                  tone="danger"
                  selected={on}
                  onClick={() =>
                    setReview({
                      breaches: on
                        ? review.breaches.filter((x) => x !== b)
                        : [...review.breaches, b],
                    })
                  }
                >
                  {t(BREACH_KEYS[b])}
                </Chip>
              );
            })}
          </div>
        </Field>
      )}

      <Input
        value={review.note}
        placeholder={t("chk.notePh")}
        aria-label={t("chk.notePh")}
        onChange={(e) => setReview({ note: e.target.value })}
      />

      <Button className="w-full" disabled={review.respected === null} onClick={onClose}>
        {t("chk.closeSession")}
      </Button>
    </Card>
  );
}
