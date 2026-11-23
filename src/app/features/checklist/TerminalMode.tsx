import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Volume2, VolumeX, X, SlidersHorizontal, RotateCcw } from "@/shared/ui/icons";
import { Button, ChoiceGroup, Modal } from "@/shared/ui";
import { JarvisNeural, type JarvisMode } from "@/shared/ui/JarvisNeural";
import { cn } from "@/shared/ui/cn";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { useJarvisVoice } from "@/app/features/jarvis/jarvisVoice";
import {
  play,
  releaseAudio,
  setSoundEnabled,
  soundEnabled,
  unlockAudio,
} from "@/app/features/onboarding/onboardingSound";
import type { SessionVerdict } from "@/modules/discipline";
import EntryGate from "./EntryGate";
import { SessionStateChip } from "./checklistParts";
import { END_KEYS, FIELD_KEYS, useBiasWord } from "./checklistLabels";
import {
  activePlan,
  canLock,
  missingFields,
  planRR,
  type Blocker,
  type DayFacts,
  type EndReason,
  type GateQuestion,
  type SessionDay,
} from "./sessionPlan";
import type { BehaviorSignal, LimitSplit, SessionState } from "./sessionState";
import { PAUSE_MINUTES } from "./sessionState";
import { line, planSummary, type LineKey, type VoiceLang } from "./terminalVoice";
import {
  DEFAULT_TERMINAL_PREFS,
  loadTerminalPrefs,
  saveTerminalPrefs,
  type TerminalPrefs,
} from "./terminalPrefs";

/**
 * LE MODE TERMINAL — la checklist d'origine, rendue (2026-11-22).
 *
 * Même moteur que la page (`sessionPlan`, `sessionState`) : ce n'est qu'une
 * autre peau, plein écran, pour la séance qu'on garde ouverte à côté du
 * graphique. Ce qu'il reprend de l'identité de juillet 2026 : le terminal
 * (étiquettes en capitales mono, chiffres tabulaires, grille fixe), le cœur
 * de Jarvis qui réagit à l'état, la voix posée et ses répliques, les sons
 * synthétisés (allumage, verrou, accord, alerte). Ce qu'il ne reprend PAS :
 * le cochage réflexe, les états FOMO auto-déclarés, les halos et le néon.
 *
 * Règles : la voix ne parle jamais pendant la saisie d'un trade et se coupe
 * au premier geste ; tout ce qu'elle dit s'affiche en sous-titre ; tout
 * marche sans son et au clavier ; `Échap` sort.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  day: SessionDay;
  facts: DayFacts;
  limits: LimitSplit;
  blockerText: (b: Blocker) => string;
  state: SessionState;
  pauseEnds: string | null;
  signals: BehaviorSignal[];
  questions: GateQuestion[];
  verdict: SessionVerdict | null;
  /** Ligne de la fenêtre, déjà formulée (« Fenêtre ouverte · 09:30 »). */
  windowLine: string;
  /** Heure de la séance, `HH:MM`, dans son fuseau. */
  clock: string;
  /** Heure locale (0-23) dans le fuseau de la séance — choisit la salutation. */
  hour: number;
  onLock: () => void;
  onLogTrade: () => void;
  onEnd: (reason: EndReason) => void;
  onPause: () => void;
}

const MODE_OF: Record<SessionState, JarvisMode> = {
  preparation: "breathing",
  ready: "listening",
  active: "analyzing",
  paused: "breathing",
  completed: "writing",
  locked: "revising",
};

const VERDICT_KEYS: Record<SessionVerdict, TKey> = {
  good_discipline: "exec.goodDiscipline",
  good_execution: "exec.good",
  bad_execution: "exec.bad",
  unknown: "exec.unknown",
};

export default function TerminalMode(props: Props) {
  const { open, day, facts, state } = props;
  const { t, lang } = useT();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const biasWord = useBiasWord();
  const voice = useJarvisVoice();

  const [prefs, setPrefs] = useState<TerminalPrefs>(DEFAULT_TERMINAL_PREFS);
  const [sound, setSound] = useState(() => soundEnabled());
  const [showPrefs, setShowPrefs] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !open) return;
    let active = true;
    void loadTerminalPrefs(userId).then((p) => {
      if (active) setPrefs(p);
    });
    return () => {
      active = false;
    };
  }, [userId, open]);

  const voiceLang: VoiceLang =
    prefs.lang === "auto" ? (lang.startsWith("fr") ? "fr" : "en") : prefs.lang;

  // Les réglages et la voix lus par les effets sans les relancer.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const langRef = useRef(voiceLang);
  langRef.current = voiceLang;
  const hourRef = useRef(props.hour);
  hourRef.current = props.hour;
  const speakRef = useRef(voice.speak);
  speakRef.current = voice.speak;

  /** Dire une phrase : toujours sous-titrée, parlée si la voix est active. */
  const say = useCallback((text: string, fixed: boolean) => {
    setCaption(text);
    const p = prefsRef.current;
    if (!p.voice) return;
    void speakRef.current(text, {
      lang: langRef.current,
      rate: p.rate,
      volume: p.volume,
      clipFirst: fixed,
    });
  }, []);
  const sayLine = useCallback(
    (key: LineKey) => say(line(key, langRef.current, hourRef.current, Math.random()), true),
    [say],
  );

  /* ══ L'allumage — au clic qui a ouvert le terminal (un geste : l'audio est permis) ══ */
  useEffect(() => {
    if (!open) return;
    unlockAudio();
    play("boot");
    sayLine("activate");
    return () => {
      releaseAudio();
    };
  }, [open, sayLine]);

  /* ══ Les transitions qui méritent une voix ══ */
  const prev = useRef<{ phase: SessionDay["phase"]; state: SessionState } | null>(null);
  useEffect(() => {
    if (!open) {
      prev.current = null;
      return;
    }
    const before = prev.current;
    prev.current = { phase: day.phase, state };
    if (!before) return;
    if (before.phase === "plan" && day.phase === "live") {
      play("lock");
      sayLine("lock");
    } else if (before.phase === "live" && day.phase === "review") {
      play("chime");
      sayLine("sessionEnd");
    } else if (before.state !== "locked" && state === "locked") {
      play("alarm");
      sayLine("limitLocked");
    } else if (before.state !== "paused" && state === "paused") {
      sayLine("pause");
    }
  }, [open, day.phase, state, sayLine]);

  // `voice.stop` est stable (useCallback) : on peut le prendre tel quel.
  const stopVoice = voice.stop;
  const close = useCallback(() => {
    // Une fenêtre ouverte PAR-DESSUS (formulaire de trade) garde son Échap.
    if (document.querySelectorAll('[role="dialog"]').length > 1) return;
    stopVoice();
    props.onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopVoice, props.onClose]);

  const patchPrefs = (patch: Partial<TerminalPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (userId) saveTerminalPrefs(userId, next);
    if (patch.voice === false) voice.stop();
  };

  const plan = activePlan(day);
  const observation = plan.bias === "none";
  const rr = planRR(plan);
  const first = props.limits.blocking[0];
  const blockedText = first
    ? props.blockerText(first)
    : state === "paused"
      ? t("chk.blockPaused").replace("{time}", props.pauseEnds ?? "")
      : null;
  const missing = missingFields(day.plan, day.mood);

  const rows: [TKey, string][] = observation
    ? []
    : [
        ["chk.target", plan.target],
        ["chk.entry", plan.entry],
        ["chk.invalidation", plan.invalidation],
        ["chk.risk", plan.risk],
        ["chk.maxLoss", plan.maxLoss],
      ];

  return (
    <Modal
      open={open}
      onClose={close}
      closeOnBackdrop={false}
      labelledBy="tv-terminal-title"
      wrapperClassName="tv-terminal-wrap"
      className="tv-terminal"
    >
      {/* ══ HUD ══ */}
      <header className="tv-terminal-hud">
        <div className="flex min-w-0 items-center gap-3">
          <span id="tv-terminal-title" className="tv-terminal-label text-[var(--tv-highlight)]">
            <span className="sm:hidden">{t("term.openShort")}</span>
            <span className="hidden sm:inline">{t("term.title")}</span>
          </span>
          <span className="tv-figure hidden text-sm text-slate-200 sm:inline">{props.clock}</span>
          <span className="hidden truncate text-xs text-slate-500 md:inline">
            {props.windowLine}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <SessionStateChip state={state} />
          <button
            type="button"
            className="tv-terminal-tool"
            aria-pressed={sound}
            aria-label={t("term.sound")}
            title={t("term.sound")}
            onClick={() => {
              setSoundEnabled(!sound);
              setSound(!sound);
            }}
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="tv-terminal-tool"
            aria-pressed={prefs.voice}
            aria-label={t("term.voice")}
            title={t("term.voice")}
            onClick={() => patchPrefs({ voice: !prefs.voice })}
          >
            <AudioLines className={cn("h-4 w-4", !prefs.voice && "opacity-40")} />
          </button>
          <button
            type="button"
            className="tv-terminal-tool"
            aria-expanded={showPrefs}
            aria-label={t("term.voiceSettings")}
            title={t("term.voiceSettings")}
            onClick={() => setShowPrefs((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="tv-terminal-tool"
            aria-label={t("term.exit")}
            title={t("term.exit")}
            onClick={close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {showPrefs && (
        <div className="tv-terminal-prefs">
          <Pref label={t("term.lang")}>
            <ChoiceGroup<TerminalPrefs["lang"]>
              label={t("term.lang")}
              value={prefs.lang}
              options={[
                { value: "auto", label: t("term.langAuto") },
                { value: "fr", label: "FR" },
                { value: "en", label: "EN" },
              ]}
              onChange={(v) => patchPrefs({ lang: v })}
            />
          </Pref>
          <Pref label={t("term.rate")}>
            <ChoiceGroup<number>
              label={t("term.rate")}
              value={prefs.rate}
              options={[0.9, 1, 1.1].map((v) => ({ value: v, label: `×${v}` }))}
              onChange={(v) => patchPrefs({ rate: v })}
            />
          </Pref>
          <Pref label={t("term.volume")}>
            <ChoiceGroup<number>
              label={t("term.volume")}
              value={prefs.volume}
              options={[0.5, 0.9, 1].map((v) => ({ value: v, label: `${Math.round(v * 100)}` }))}
              onChange={(v) => patchPrefs({ volume: v })}
            />
          </Pref>
        </div>
      )}

      <div className="tv-terminal-body">
        {/* ══ Le cœur, la voix, les sous-titres ══ */}
        <section className="tv-terminal-core" aria-label={t("term.jarvis")}>
          <div className="tv-terminal-orb">
            <JarvisNeural
              mode={voice.speaking ? "speaking" : MODE_OF[state]}
              className="h-full w-full"
              keepAlive
            />
          </div>
          <p className="tv-terminal-caption" aria-live="polite">
            {caption ?? t("term.captionIdle")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => say(planSummary(day, langRef.current), false)}
            >
              {t("term.summary")}
            </Button>
            {caption && (
              <Button variant="subtle" size="sm" onClick={() => say(caption, false)}>
                <RotateCcw className="h-3.5 w-3.5" /> {t("term.replay")}
              </Button>
            )}
          </div>
        </section>

        {/* ══ Le plan, lu comme un terminal ══ */}
        <section className="tv-terminal-panel">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="tv-terminal-bias">{biasWord(plan.bias)}</span>
              {!observation && plan.bias && (
                <span className="tv-terminal-label text-slate-500">
                  {day.scenario === "B" ? t("chk.scenarioB") : t("chk.scenarioA")}
                </span>
              )}
            </div>
            {!observation && (
              <span className="tv-figure text-lg text-white">
                {facts.count}/{plan.maxTrades}{" "}
                <span className="tv-terminal-label text-slate-500">{t("chk.trades")}</span>
              </span>
            )}
          </div>

          {rows.length > 0 && (
            <dl className="tv-terminal-table">
              {rows.map(([k, v]) => (
                <div key={k} className="tv-terminal-row">
                  <dt className="tv-terminal-label text-slate-500">{t(k)}</dt>
                  <dd className="tv-figure truncate text-right text-slate-100">
                    {v.trim() || "—"}
                  </dd>
                </div>
              ))}
              {rr !== null && (
                <div className="tv-terminal-row">
                  <dt className="tv-terminal-label text-slate-500">R:R</dt>
                  <dd className="tv-figure text-right text-slate-100">{rr.toFixed(2)}</dd>
                </div>
              )}
            </dl>
          )}

          {/* ══ Ce que la phase demande ══ */}
          {day.phase === "plan" && (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">
                {missing.length > 0
                  ? t("chk.missing").replace(
                      "{list}",
                      missing.map((f) => t(FIELD_KEYS[f])).join(", "),
                    )
                  : t("term.readyToLock")}
              </p>
              {canLock(day.plan, day.mood) ? (
                <Button className="h-12 w-full text-sm font-bold" onClick={props.onLock}>
                  {t("term.lock")}
                </Button>
              ) : (
                <Button variant="subtle" className="w-full" onClick={close}>
                  {t("term.writePlan")}
                </Button>
              )}
            </div>
          )}

          {day.phase === "live" && (
            <div className="space-y-2.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  !blockedText
                    ? "text-[var(--tv-highlight)]"
                    : first === "observation"
                      ? "text-slate-300"
                      : first === "window" || !first
                        ? "text-amber-300"
                        : "text-red-400",
                )}
              >
                {blockedText ?? t("chk.readyLine")}
              </p>
              {props.limits.warnings.map((w) => (
                <p key={w} className="text-xs font-semibold text-amber-300">
                  {props.blockerText(w)}
                </p>
              ))}
              {state !== "paused" && props.signals.length > 0 && !observation && (
                <Button variant="subtle" size="sm" onClick={props.onPause}>
                  {t("chk.pause").replace("{n}", String(PAUSE_MINUTES))}
                </Button>
              )}
              {!observation && (
                <>
                  <EntryGate
                    questions={props.questions}
                    blocked={blockedText}
                    onGo={() => {
                      // La saisie d'un trade ne se fait jamais sous la voix.
                      voice.stop();
                      play("select");
                      props.onLogTrade();
                    }}
                  />
                  <Button
                    variant="subtle"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      voice.stop();
                      props.onLogTrade();
                    }}
                  >
                    {t("chk.logTradeQuick")}
                  </Button>
                </>
              )}
              <div className="flex flex-wrap gap-2 border-t border-[var(--tv-border)] pt-2.5">
                {(observation
                  ? (["done"] as const)
                  : (["missed", "invalidated", "done"] as const)
                ).map((r) => (
                  <Button key={r} variant="subtle" size="sm" onClick={() => props.onEnd(r)}>
                    {t(END_KEYS[r])}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {(day.phase === "review" || day.phase === "closed") && (
            <div className="space-y-2">
              {props.verdict && (
                <p className="text-sm text-slate-300">
                  <span className="tv-terminal-label mr-2 text-slate-500">{t("exec.session")}</span>
                  {t(VERDICT_KEYS[props.verdict])} · {t("exec.notPnl")}
                </p>
              )}
              <Button className="w-full" onClick={close}>
                {t("term.openReview")}
              </Button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Pref({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="tv-terminal-label text-slate-500">{label}</span>
      {children}
    </div>
  );
}
