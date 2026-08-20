import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Bot,
  Volume2,
  VolumeX,
  Pencil,
  SlidersHorizontal,
  Check,
  Lock,
  Flame,
  Clock,
  Plus,
  GripVertical,
  X,
  RotateCcw,
  Wand2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Page, Trade } from "../types";
import {
  loadOnboarding,
  loadChecklistConfig,
  saveChecklistConfig,
  type OnboardingData,
} from "../store";
import { ttsSpeak } from "@/backend/tts.functions";
import { clipFor, loadVoiceClips, refreshVoiceClips } from "@/modules/voice/clips";
import { pickEnglishMaleVoice } from "../utils/jarvisVoice";
import { computeChecklistStreak } from "../utils/checklistStreak";
import ChecklistWizard, { type WizardResult } from "./ChecklistWizard";
import {
  type ChkConfig,
  type ChkItem,
  type MotivOpt,
  type FomoState,
  defaultConfigFor,
  templatesFor,
  generateChecklist,
  isItemOn,
  ranksFor,
  coachPromptsFor,
} from "./checklistDefaults";
import "./checklist.css";

import { type Tone, TONES, LINES } from "./checklist/voice";
import { loadTradingRules, saveTradingRules, type TradingRule } from "../utils/tradingRules";
import {
  FOMO_ICONS,
  pad,
  getTimeInZone,
  parseTimeToMinutes,
  isWindowOpen,
  getTimeZoneOptions,
  todayKey,
  hydrateConfig,
} from "./checklist/helpers";
import { Button } from "@/shared/ui";

/* ════════════════════════════════════════════════════════════════
   JARVIS Pre-Market Checklist — follows the app language, offers
   one-click templates + drag & drop customization, and connects to
   the rest of the app (Journal, Analytics, Mistakes, AI Coach).
   ════════════════════════════════════════════════════════════════ */

/* ══ Per-day state ══ */
interface DayState {
  checked: boolean[];
  fomo: number;
  motiv: number;
  assume: boolean;
  locked: boolean;
  notes: string;
  t0: number;
}
const emptyDay = (n: number): DayState => ({
  checked: new Array(n).fill(false),
  fomo: -1,
  motiv: -1,
  assume: false,
  locked: false,
  notes: "",
  t0: Date.now(),
});

/* Editable span — commits its text on blur (used by inline edit mode) */
function Ed({
  value,
  editable,
  onCommit,
  className,
  as: Tag = "span",
}: {
  value: string;
  editable: boolean;
  onCommit: (v: string) => void;
  className?: string;
  as?: "span" | "div";
}) {
  return (
    <Tag
      className={cn(
        className,
        editable &&
          "outline-none rounded px-1 -mx-1 ring-1 ring-cyan-500/30 bg-cyan-500/5 focus:ring-cyan-500/60 cursor-text",
      )}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={(e) => {
        const t = (e.currentTarget.textContent || "").trim();
        if (editable && t && t !== value) onCommit(t);
      }}
      onClick={(e) => {
        if (editable) e.stopPropagation();
      }}
    >
      {value}
    </Tag>
  );
}

/* ══ Quick-action icons ══ */
const QA_ICONS: Record<string, React.ReactNode> = {
  add: (
    <svg viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  journal: (
    <svg viewBox="0 0 24 24">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  mistakes: (
    <svg viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  coach: (
    <svg viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  reset: (
    <svg viewBox="0 0 24 24">
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
};

interface ChecklistProps {
  setPage: (p: Page) => void;
  onAddTrade: () => void;
  /** Trades du compte actif — le panneau de séance montre ceux du jour. */
  trades: Trade[];
}

/* ══════════════════════════════ COMPONENT ══════════════════════════════ */

/**
 * Phase 3 — la checklist alimente la discipline. Chaque engagement choisi dans
 * le wizard devient une règle « custom » du profil (jamais auto-vérifiée — on
 * ne devine jamais un chiffre — mais visible, comptée et citée par Jarvis).
 * Dédupliquée par texte : relancer le wizard ne crée pas de doublons.
 */
async function syncWizardRules(
  userId: string | undefined,
  items: { title: string }[],
): Promise<void> {
  if (!userId || items.length === 0) return;
  try {
    const existing = await loadTradingRules(userId);
    const existingTexts = new Set(existing.map((r) => r.text.toLowerCase().trim()));
    const fresh: TradingRule[] = [];
    for (const it of items) {
      const text = it.title.trim();
      if (!text || existingTexts.has(text.toLowerCase())) continue;
      existingTexts.add(text.toLowerCase());
      fresh.push({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "custom",
        value: "",
        text,
        enabled: true,
      });
    }
    if (fresh.length > 0) await saveTradingRules(userId, [...existing, ...fresh]);
  } catch (e) {
    // Jamais bloquant : la checklist fonctionne sans règles.
    console.error("[checklist] sync wizard rules failed", e);
  }
}

export default function Checklist({ setPage, onAddTrade, trades }: ChecklistProps) {
  const { user } = useAuth();
  const { t, lang } = useT();
  const uid = user?.id ?? "anon";
  const CFG_KEY = `tv-chk-config-${uid}`;
  const DAY_KEY = `tv-chk-${uid}-${todayKey()}`;

  /* Config only persists once the user actually customized it — untouched
     defaults keep following the app language chosen in Settings. */
  const touchedRef = useRef<boolean | null>(null);
  if (touchedRef.current === null) {
    try {
      touchedRef.current = !!localStorage.getItem(CFG_KEY);
    } catch {
      touchedRef.current = false;
    }
  }
  const markTouched = () => {
    touchedRef.current = true;
  };

  const [config, setConfig] = useState<ChkConfig>(() =>
    hydrateConfig(typeof localStorage !== "undefined" ? localStorage.getItem(CFG_KEY) : null, lang),
  );
  const [day, setDay] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(DAY_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<DayState>;
        return { ...emptyDay(6), ...p };
      }
    } catch {
      /* fresh day */
    }
    return emptyDay(6);
  });
  const [audioOn, setAudioOn] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgTab, setCfgTab] = useState<"items" | "session" | "models" | "advanced">("items");
  const [now, setNow] = useState(() => Date.now());
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [lockOverlay, setLockOverlay] = useState(false);
  const [execTime, setExecTime] = useState("—");
  const [flash, setFlash] = useState(0);
  const [voice, setVoice] = useState<{ text: string; speaking: boolean; show: boolean }>({
    text: "—",
    speaking: false,
    show: false,
  });
  const [quickAdd, setQuickAdd] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [onb, setOnb] = useState<OnboardingData | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const WIZ_KEY = `tv-chk-wizard-${uid}`;

  /* Guided setup: adapt the checklist to the trader's onboarding profile.
     First-time-ever visitors (config never touched, wizard never dismissed)
     get the friendly wizard opened for them, pre-filled from their answers. */
  useEffect(() => {
    if (!user) return;
    let active = true;
    loadOnboarding(user.id)
      .then((o) => {
        if (!active) return;
        setOnb(o);
        const wizDone = (() => {
          try {
            return !!localStorage.getItem(WIZ_KEY);
          } catch {
            return false;
          }
        })();
        if (!touchedRef.current && !wizDone) setShowWizard(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // The bespoke checklist, generated from the onboarding profile. This is the
  // recommended, self-contained short list (≤6 items) — it already folds in
  // the trader's weakness, style, market and risk, so nothing extra is appended
  // (no more preset + guardrails + adaptive-rules bloat).
  const generated = useMemo(() => generateChecklist(onb ?? {}, lang), [onb, lang]);

  // Default session time offered by the wizard, derived from the onboarding
  // profile (the adaptive wizard builds the item list from its own answers).
  const wizardDefaultTime = useMemo(
    () => ({ startTime: generated.startTime, timeZone: generated.timeZone }),
    [generated],
  );

  const applyWizard = (r: WizardResult) => {
    markTouched();
    setConfig((c) => ({ ...c, items: r.items, startTime: r.startTime, timeZone: r.timeZone }));
    setDay((d) => ({ ...d, checked: new Array(r.items.length).fill(false) }));
    try {
      localStorage.setItem(WIZ_KEY, "1");
    } catch {
      /* noop */
    }
    setShowWizard(false);
    // Phase 3 — la checklist alimente la DISCIPLINE : chaque engagement du
    // wizard devient une règle « custom » du profil (dédupliquée par texte).
    // Ces règles alimentent les notifications (discipline armée), le contexte
    // coach (Jarvis cite tes engagements) et le compteur de règles.
    void syncWizardRules(user?.id, r.items);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasStateRef = useRef<(k: string) => void>(() => {});
  const audioOnRef = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;
  audioOnRef.current = audioOn;

  /* Untouched config follows the app language live (voice: see langRef) */
  useEffect(() => {
    if (touchedRef.current) return;
    setConfig(defaultConfigFor(lang));
  }, [lang]);

  /* Language-dependent content */
  const { ranks: RANKS } = useMemo(() => ranksFor(lang), [lang]);
  const templates = useMemo(() => templatesFor(lang), [lang]);
  const coach = useMemo(() => coachPromptsFor(lang), [lang]);

  /* keep checked[] in sync with item count */
  const checked = useMemo(() => {
    const arr = day.checked.slice(0, config.items.length);
    while (arr.length < config.items.length) arr.push(false);
    return arr;
  }, [day.checked, config.items.length]);

  /* ══ Persistence ══ */
  useEffect(() => {
    if (!touchedRef.current) return;
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(config));
    } catch {
      /* quota */
    }
  }, [config, CFG_KEY]);

  /* Phase 5 — l'app se souvient : la config remonte en base (best-effort,
     debounced) pour survivre au changement d'appareil / vidage du cache. */
  useEffect(() => {
    if (!touchedRef.current || !uid) return;
    const t = window.setTimeout(() => {
      void saveChecklistConfig(uid, config);
    }, 600);
    return () => window.clearTimeout(t);
  }, [config, uid]);

  /* Hydratation depuis la base : 1re visite sur cet appareil (localStorage
     vide) mais config existante en base → on la restaure. Jamais bloquant. */
  useEffect(() => {
    if (!uid) return;
    let local: ChkConfig | null = null;
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (raw) local = JSON.parse(raw) as ChkConfig;
    } catch {
      /* noop */
    }
    if (local || !touchedRef.current) return;
    let active = true;
    void loadChecklistConfig(uid).then((saved) => {
      if (!active || !saved) return;
      const cfg = saved as ChkConfig;
      if (Array.isArray(cfg?.items) && cfg.items.length > 0) {
        setConfig(cfg);
        markTouched();
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    try {
      localStorage.setItem(DAY_KEY, JSON.stringify(day));
    } catch {
      /* quota */
    }
  }, [day, DAY_KEY]);

  /* ══════════ AUDIO ENGINE (WebAudio + speechSynthesis) ══════════ */
  const audioRef = useRef<{
    ctx: AudioContext | null;
    master: GainNode | null;
    echo: GainNode | null;
    commBed: { src: AudioBufferSourceNode; gain: GainNode } | null;
  }>({ ctx: null, master: null, echo: null, commBed: null });
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const vwHideT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      voicesRef.current = speechSynthesis.getVoices();
    };
    load();
    speechSynthesis.onvoiceschanged = load;
    return () => {
      speechSynthesis.onvoiceschanged = null;
      try {
        speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  const getCtx = useCallback(() => {
    const a = audioRef.current;
    if (!a.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      a.ctx = new Ctor();
      const comp = a.ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.ratio.value = 6;
      a.master = a.ctx.createGain();
      a.master.gain.value = 0.9;
      a.master.connect(comp);
      comp.connect(a.ctx.destination);
      a.echo = a.ctx.createGain();
      a.echo.gain.value = 0.12;
      const dl = a.ctx.createDelay();
      dl.delayTime.value = 0.17;
      const fb = a.ctx.createGain();
      fb.gain.value = 0.24;
      const lp = a.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      a.echo.connect(dl);
      dl.connect(lp);
      lp.connect(fb);
      fb.connect(dl);
      lp.connect(a.master);
    }
    return a;
  }, []);

  const blip = useCallback(
    (f: number, d: number, type: OscillatorType = "sine", g = 0.025, fEnd?: number) => {
      if (!audioOnRef.current) return;
      try {
        const a = getCtx();
        const t = a.ctx!.currentTime;
        const o = a.ctx!.createOscillator();
        const ga = a.ctx!.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + d);
        ga.gain.setValueAtTime(0.0001, t);
        ga.gain.exponentialRampToValueAtTime(g, t + 0.01);
        ga.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(ga);
        ga.connect(a.master!);
        ga.connect(a.echo!);
        o.start(t);
        o.stop(t + d + 0.02);
      } catch {
        /* audio unavailable */
      }
    },
    [getCtx],
  );
  const confirmTick = useCallback(
    (i: number) => {
      const base = 620 + (i || 0) * 40;
      blip(base, 0.1, "sine", 0.02);
      setTimeout(() => blip(base * 1.5, 0.13, "sine", 0.016), 55);
    },
    [blip],
  );
  const downBlip = useCallback(() => blip(520, 0.11, "sine", 0.014, 320), [blip]);
  const radioClick = useCallback(() => {
    if (!audioOnRef.current) return;
    try {
      const a = getCtx();
      const n = Math.floor(a.ctx!.sampleRate * 0.045);
      const b = a.ctx!.createBuffer(1, n, a.ctx!.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.18));
      const s = a.ctx!.createBufferSource();
      s.buffer = b;
      const f = a.ctx!.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2200;
      f.Q.value = 1.2;
      const g = a.ctx!.createGain();
      g.gain.value = 0.03;
      s.connect(f);
      f.connect(g);
      g.connect(a.master!);
      s.start();
    } catch {
      /* noop */
    }
  }, [getCtx]);
  const commOn = useCallback(() => {
    const a = audioRef.current;
    if (!audioOnRef.current || a.commBed) return;
    try {
      const ac = getCtx();
      const n = ac.ctx!.sampleRate * 2;
      const b = ac.ctx!.createBuffer(1, n, ac.ctx!.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = ac.ctx!.createBufferSource();
      s.buffer = b;
      s.loop = true;
      const f = ac.ctx!.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1200;
      f.Q.value = 2.2;
      const g = ac.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, ac.ctx!.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0011, ac.ctx!.currentTime + 0.3);
      s.connect(f);
      f.connect(g);
      g.connect(ac.master!);
      s.start();
      ac.commBed = { src: s, gain: g };
    } catch {
      /* noop */
    }
  }, [getCtx]);
  const commOff = useCallback(() => {
    const a = audioRef.current;
    if (!a.commBed) return;
    try {
      const cb = a.commBed;
      a.commBed = null;
      cb.gain.gain.exponentialRampToValueAtTime(0.0001, a.ctx!.currentTime + 0.3);
      setTimeout(() => {
        try {
          cb.src.stop();
        } catch {
          /* noop */
        }
      }, 350);
    } catch {
      a.commBed = null;
    }
  }, []);
  const powerUp = useCallback(() => {
    if (!audioOnRef.current) return;
    try {
      const a = getCtx();
      const t = a.ctx!.currentTime;
      const o = a.ctx!.createOscillator();
      const g = a.ctx!.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.55);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g);
      g.connect(a.master!);
      g.connect(a.echo!);
      o.start(t);
      o.stop(t + 0.72);
      setTimeout(() => blip(1320, 0.09, "sine", 0.02), 560);
      setTimeout(() => blip(1760, 0.13, "sine", 0.018), 680);
    } catch {
      /* noop */
    }
  }, [getCtx, blip]);
  const chime = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => blip(f, 0.2, "sine", 0.02), i * 95),
    );
    setTimeout(() => blip(1568, 0.32, "sine", 0.013), 420);
  }, [blip]);
  const alarm = useCallback(() => {
    blip(165, 0.3, "sawtooth", 0.013);
    blip(82, 0.32, "sine", 0.02);
    setTimeout(() => {
      blip(140, 0.36, "sawtooth", 0.014);
      blip(70, 0.38, "sine", 0.02);
    }, 300);
  }, [blip]);

  const showVoiceWidget = useCallback((text: string) => {
    if (vwHideT.current) clearTimeout(vwHideT.current);
    setVoice({ text, speaking: true, show: true });
  }, []);
  const hideVoiceWidget = useCallback(() => {
    setVoice((v) => ({ ...v, speaking: false }));
    vwHideT.current = setTimeout(() => setVoice((v) => ({ ...v, show: false })), 1100);
  }, []);

  // ONE robotic voice — always English (en-GB), independent of the UI
  // language. The "closest male en-GB voice" scoring lives in the shared
  // jarvisVoice util so the Checklist and the Jarvis page never drift apart.
  const pickVoice = useCallback(() => pickEnglishMaleVoice(voicesRef.current), []);

  /* The product's ONE voice: a hosted, deep/calm/charismatic English voice that
     sounds identical on every OS and browser. When it isn't configured
     (no API key) we fall back to the locked-down browser voice below.
     `ttsAvailable` is remembered per session so we try the network once. */
  const ttsAvailableRef = useRef<boolean | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Preload the cloned-voice clip map once — every fixed line plays it.
  useEffect(() => {
    void loadVoiceClips();
  }, []);

  /* Play a pre-rendered audio URL with the same widget + comms choreography as
     the hosted path. Resolves `true` once playback actually started (or ended,
     with `waitEnd`); `false` on autoplay refusal or a missing file, so callers
     can fall back to the browser voice instead of staying silent. */
  const playUrl = useCallback(
    (url: string, txt: string, onBeforePlay?: () => void, waitEnd = false): Promise<boolean> =>
      new Promise((resolve) => {
        onBeforePlay?.();
        audioElRef.current?.pause();
        const el = new Audio(url);
        audioElRef.current = el;
        let settled = false;
        const settle = (ok: boolean) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        const fail = () => {
          commOff();
          hideVoiceWidget();
          settle(false);
        };
        el.volume = 0.95;
        // Deterministic playback: the clip already carries the right pace and
        // tone — never let the element re-scale it.
        el.playbackRate = 1;
        el.preservesPitch = true;
        showVoiceWidget(txt);
        commOn();
        el.onended = () => {
          radioClick();
          commOff();
          hideVoiceWidget();
          if (waitEnd) settle(true);
        };
        el.onerror = fail;
        el.play()
          .then(() => {
            if (!waitEnd) settle(true);
          })
          .catch(fail);
      }),
    [radioClick, commOn, commOff, showVoiceWidget, hideVoiceWidget],
  );

  const speakHosted = useCallback(
    async (txt: string): Promise<boolean> => {
      if (ttsAvailableRef.current === false) return false;
      try {
        const res = await ttsSpeak({ data: { text: txt } });
        if (!res.available || !("audio" in res) || !res.audio) {
          ttsAvailableRef.current = false;
          return false;
        }
        ttsAvailableRef.current = true;
        return await playUrl(res.audio, txt);
      } catch {
        // Network/autoplay refusal → fall back to the browser voice.
        ttsAvailableRef.current = false;
        commOff();
        return false;
      }
    },
    [playUrl, commOff],
  );

  const speakBrowser = useCallback(
    (txt: string, tone: Tone) => {
      if (!audioOnRef.current) return;
      if (!("speechSynthesis" in window)) {
        showVoiceWidget(txt);
        hideVoiceWidget();
        return;
      }
      try {
        speechSynthesis.cancel();
        radioClick();
        const u = new SpeechSynthesisUtterance(txt);
        const tn = TONES[tone] || TONES.calm;
        // Always English (en-GB) — one voice, every locale.
        u.lang = "en-GB";
        u.rate = tn.rate;
        u.pitch = tn.pitch;
        u.volume = 0.9;
        const v = pickVoice();
        if (v) u.voice = v;
        u.onstart = () => {
          showVoiceWidget(txt);
          commOn();
        };
        u.onend = () => {
          radioClick();
          commOff();
          hideVoiceWidget();
        };
        u.onerror = () => {
          commOff();
          hideVoiceWidget();
        };
        showVoiceWidget(txt);
        setTimeout(() => speechSynthesis.speak(u), 140);
        setTimeout(
          () => {
            if (!speechSynthesis.speaking) {
              commOff();
              hideVoiceWidget();
            }
          },
          txt.length * 90 + 3000,
        );
      } catch {
        commOff();
        hideVoiceWidget();
      }
    },
    [radioClick, commOn, commOff, pickVoice, showVoiceWidget, hideVoiceWidget],
  );

  /* One utterance, played to completion. Lines that arrive while one is
     speaking are queued by `speak` — nothing gets cut off mid-sentence. */
  const speakOne = useCallback(
    async (txt: string, tone: Tone) => {
      if (!audioOnRef.current) return;
      // The cloned voice first: any pre-rendered line plays its static clip —
      // zero network, zero per-utterance cost, identical on every OS. Wait for
      // the (tiny, cached) manifest so the first line never races past it.
      await loadVoiceClips();
      const clip = clipFor(txt);
      if (clip) {
        let ok = await playUrl(clip, txt, undefined, true);
        if (!ok) {
          // Stale manifest (browser/CDN cache)? Refresh once and retry before
          // falling back to the browser voice.
          await refreshVoiceClips();
          const healed = clipFor(txt);
          if (healed && healed !== clip) ok = await playUrl(healed, txt, undefined, true);
        }
        if (ok) return;
        // Autoplay refusal or missing file → fall through to hosted/browser.
      }
      // Hosted voice next — identical everywhere. Browser voice is the fallback.
      if (ttsAvailableRef.current !== false) {
        const ok = await speakHosted(txt);
        if (ok || !("speechSynthesis" in window)) return;
        speakBrowser(txt, tone);
        return;
      }
      speakBrowser(txt, tone);
    },
    [playUrl, speakHosted, speakBrowser],
  );

  /* FIFO speech queue: rapid-fire `say()` calls each play in full, in order,
     instead of the newer one cutting the older one off. */
  const speechQueueRef = useRef<{ txt: string; tone: Tone }[]>([]);
  const speechBusyRef = useRef(false);
  const speakNext = useCallback(() => {
    if (speechBusyRef.current) return;
    const item = speechQueueRef.current.shift();
    if (!item) return;
    speechBusyRef.current = true;
    void speakOne(item.txt, item.tone).finally(() => {
      speechBusyRef.current = false;
      speakNext();
    });
  }, [speakOne]);

  const speak = useCallback(
    (txt: string, tone: Tone) => {
      if (!audioOnRef.current) return;
      speechQueueRef.current.push({ txt, tone });
      speakNext();
    },
    [speakNext],
  );

  const say = useCallback(
    (k: keyof typeof LINES) => {
      const o = LINES[k];
      if (!o) return;
      // Spoken lines are always English so the one robotic voice never has to
      // read another language's text (which would mangle pronunciation).
      const arr = o.en;
      const h = new Date().getHours();
      const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
      const txt = arr[Math.floor(Math.random() * arr.length)].replace("%G", greet);
      void speak(txt, o.tone);
    },
    [speak],
  );

  /* First interaction anywhere in the checklist auto-starts the JARVIS voice,
     speaking directly in the language chosen in the app settings. Once/mount. */
  const autoStartedRef = useRef(false);
  const autoStartAudio = useCallback(() => {
    if (autoStartedRef.current || audioOnRef.current) return;
    autoStartedRef.current = true;
    setAudioOn(true);
    audioOnRef.current = true;
    powerUp();
    setTimeout(() => say("activate"), 750);
  }, [powerUp, say]);

  /* ══ Canvas particle field — fixed, covers the whole viewport ══
     Kept (it IS the page's identity) but calmed: skipped entirely when the
     visitor asked for reduced motion or is on a small screen, where a
     permanent rAF loop costs battery for pure ambience. */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const reduced =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || window.innerWidth < 768);
    if (reduced) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let W = 0;
    let H = 0;
    let raf = 0;
    let pts: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const COLORS: Record<string, { r: number; g: number; b: number; a: number }> = {
      neutral: { r: 34, g: 211, b: 238, a: 0.4 },
      calm: { r: 34, g: 211, b: 238, a: 0.55 },
      focus: { r: 45, g: 212, b: 191, a: 0.55 },
      imp: { r: 251, g: 191, b: 36, a: 0.5 },
      fomo: { r: 255, g: 85, b: 102, a: 0.65 },
      locked: { r: 34, g: 211, b: 238, a: 0.8 },
    };
    const STATE = { r: 0, g: 0, b: 0, a: 0 };
    let TARGET = COLORS.neutral;
    canvasStateRef.current = (k: string) => {
      TARGET = COLORS[k] || COLORS.neutral;
    };
    const init = () => {
      pts = [];
      // Calmer field: ~40% fewer particles than before (same look, less work).
      const n = Math.min(90, Math.floor((W * H) / 30000));
      for (let i = 0; i < n; i++)
        pts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.5 + 0.5,
        });
    };
    const resize = () => {
      W = c.width = window.innerWidth;
      H = c.height = window.innerHeight;
      init();
    };
    const lerp = (a: number, b: number, t2: number) => a + (b - a) * t2;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      STATE.r = lerp(STATE.r, TARGET.r, 0.018);
      STATE.g = lerp(STATE.g, TARGET.g, 0.018);
      STATE.b = lerp(STATE.b, TARGET.b, 0.018);
      STATE.a = lerp(STATE.a, TARGET.a, 0.018);
      const cr = Math.round(STATE.r);
      const cg = Math.round(STATE.g);
      const cb = Math.round(STATE.b);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${STATE.a * 0.9})`;
        ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${STATE.a * (1 - d / 120) * 0.35})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ══ Clock tick ══ */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ══ HUD fonts (Rajdhani / Orbitron / JetBrains Mono) — loaded once ══ */
  /* ══ Derived scoring ══ */
  const winOpen = isWindowOpen(config, new Date(now));
  // Only enabled items take part in the daily run — a disabled item is neither
  // shown, counted, nor able to block the lock.
  const activeIdx = useMemo(
    () => config.items.map((it, i) => (isItemOn(it) ? i : -1)).filter((i) => i >= 0),
    [config.items],
  );
  const nChecked = activeIdx.filter((i) => checked[i]).length;
  const nActive = activeIdx.length;
  const gates = useMemo(
    () => ({
      check: nChecked === nActive && nActive > 0,
      mental: day.fomo === 0 || day.fomo === 1,
      motiv: day.motiv >= 0 && !!config.motivs[day.motiv]?.ok,
      win: winOpen,
      assume: day.assume,
    }),
    [nChecked, nActive, day.fomo, day.motiv, config.motivs, winOpen],
  );
  const allGates = gates.check && gates.mental && gates.motiv && gates.win && gates.assume;
  const interference = day.motiv >= 0 && !config.motivs[day.motiv]?.ok;

  /* gate-change sounds + full-validation HUD moment */
  const prevGatesRef = useRef(gates);
  const wasAllRef = useRef(false);
  const disciplineRef = useRef(false);
  useEffect(() => {
    const prev = prevGatesRef.current;
    (["check", "mental", "motiv", "win", "assume"] as const).forEach((k, idx) => {
      if (gates[k] && !prev[k]) blip(950 + idx * 90, 0.06, "sine", 0.01);
    });
    if (gates.check && !prev.check && !allGates) say("checkDone");
    if (gates.win && !prev.win) say("win");
    prevGatesRef.current = gates;
    if (allGates && !wasAllRef.current && !day.locked) {
      setFlash((f) => f + 1);
      chime();
      if (!disciplineRef.current) {
        say("discipline");
        disciplineRef.current = true;
      }
    }
    wasAllRef.current = allGates;
  }, [gates, allGates, day.locked, blip, say, chime]);

  /* canvas mood */
  useEffect(() => {
    if (day.locked) canvasStateRef.current("locked");
    else if (allGates) canvasStateRef.current("calm");
    else if (day.fomo >= 0) canvasStateRef.current(["calm", "focus", "imp", "fomo"][day.fomo]);
    else canvasStateRef.current("neutral");
  }, [day.locked, allGates, day.fomo]);

  /* ══ Série de complétion ══
     Jours de BOURSE consécutifs avec checklist verrouillée. La logique vit
     dans `utils/checklistStreak.ts` — module pur et testé (11 tests) — plutôt
     qu'en ligne ici : les deux règles produit (week-ends neutres, sursis du
     jour courant) sont exactement le genre de détail qui casse en silence.
     Le module expose aussi `atRisk` (série intacte mais jour non validé),
     disponible pour une future relance. */
  const streak = useMemo(
    () => (uid ? computeChecklistStreak(window.localStorage, uid).current : 0),
    [uid, day.locked],
  );

  /* patience timer + ranks */
  const elapsedMs = Math.max(0, now - day.t0);
  const mins = elapsedMs / 60000;
  let rank = 0;
  for (let i = 0; i < RANKS.length; i++) if (mins >= RANKS[i][0]) rank = i;
  const lastRankRef = useRef(0);
  useEffect(() => {
    if (rank !== lastRankRef.current) {
      lastRankRef.current = rank;
      // A quiet audio cue as patience deepens — a calm-mind milestone.
      if (rank > 0) {
        blip(1100, 0.13, "sine", 0.018);
        if (rank === 2) say("patience");
      }
    }
  }, [rank, blip, say]);

  /* countdown lock sequence */
  useEffect(() => {
    if (countdownVal === null) return;
    if (countdownVal <= 0) {
      setCountdownVal(null);
      setDay((d) => ({ ...d, locked: true }));
      setLockOverlay(true);
      chime();
      say("lock");
      return;
    }
    const id = setTimeout(() => {
      const nv = countdownVal - 1;
      blip(nv === 1 ? 1320 : 640, 0.08, "sine", 0.02);
      setCountdownVal(nv);
    }, 1000);
    return () => clearTimeout(id);
  }, [countdownVal, blip, chime, say]);

  /* hover blips — short, quiet, throttled */
  const lastHoverRef = useRef(0);
  const onHover = useCallback(
    (ev: React.MouseEvent) => {
      if (!audioOnRef.current) return;
      const tg = (ev.target as HTMLElement).closest?.("button,[role='button'],.cursor-pointer");
      if (!tg) return;
      const nowT = Date.now();
      if (nowT - lastHoverRef.current < 110) return;
      lastHoverRef.current = nowT;
      blip(1440 + Math.random() * 120, 0.02, "sine", 0.004);
    },
    [blip],
  );

  /* ══ Interaction handlers ══ */
  const toggleItem = (i: number) => {
    if (editMode) return;
    const v = !checked[i];
    const next = checked.slice();
    next[i] = v;
    setDay((d) => ({ ...d, checked: next }));
    if (v) confirmTick(i);
    else downBlip();
  };
  const setMotiv = (i: number) => {
    if (editMode) return;
    setDay((d) => ({ ...d, motiv: i }));
    if (config.motivs[i]?.ok) {
      confirmTick(4);
      say("motivOk");
    } else {
      alarm();
      say("interference");
    }
  };
  const setFomo = (i: number) => {
    if (editMode) return;
    setDay((d) => ({ ...d, fomo: i }));
    if (i === 3) {
      alarm();
      say("fomo");
    } else blip(700 + i * 90, 0.08, "sine", 0.018);
  };
  const toggleAssume = () => {
    setDay((d) => {
      if (!d.assume) blip(520, 0.13, "triangle", 0.02);
      return { ...d, assume: !d.assume };
    });
  };
  const toggleAudio = () => {
    const on = !audioOn;
    setAudioOn(on);
    audioOnRef.current = on;
    if (on) {
      powerUp();
      setTimeout(() => say("activate"), 750);
    } else {
      try {
        speechSynthesis.cancel();
      } catch {
        /* noop */
      }
      speechQueueRef.current = [];
      speechBusyRef.current = false;
      commOff();
      hideVoiceWidget();
    }
  };
  const toggleEdit = () => {
    const on = !editMode;
    setEditMode(on);
    blip(on ? 980 : 440, 0.09, "sine", 0.02);
    if (on) say("editor");
  };
  const initiate = () => {
    if (!allGates || day.locked) return;
    setCountdownVal(config.countdown);
    blip(880, 0.09, "sine", 0.02);
    say("initiate");
  };
  const cancelCountdown = () => {
    setCountdownVal(null);
    blip(300, 0.13, "triangle", 0.018);
  };
  const confirmLock = () => {
    setLockOverlay(false);
    const d = new Date();
    setExecTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };
  const closeLock = () => {
    setDay((d) => ({ ...d, locked: false }));
    setLockOverlay(false);
  };
  const resetAll = () => {
    setDay(emptyDay(config.items.length));
    disciplineRef.current = false;
    wasAllRef.current = false;
    lastRankRef.current = 0;
  };

  /* Ask the in-app AI coach (opens the assistant panel with the prompt) */
  const askCoach = useCallback((prompt: string) => {
    window.dispatchEvent(new CustomEvent("tv:ask-coach", { detail: { prompt } }));
  }, []);

  /* config patch helpers — all mark the config as user-customized */
  const patch = (p: Partial<ChkConfig>) => {
    markTouched();
    setConfig((c) => ({ ...c, ...p }));
  };
  const patchItem = (i: number, p: Partial<ChkItem>) => {
    markTouched();
    setConfig((c) => ({
      ...c,
      items: c.items.map((it, k) => (k === i ? { ...it, ...p } : it)),
    }));
  };
  const patchMotiv = (i: number, p: Partial<MotivOpt>) => {
    markTouched();
    setConfig((c) => ({
      ...c,
      motivs: c.motivs.map((m, k) => (k === i ? { ...m, ...p } : m)),
    }));
  };
  const patchFomo = (i: number, p: Partial<FomoState>) => {
    markTouched();
    setConfig((c) => ({
      ...c,
      fomo: c.fomo.map((f, k) => (k === i ? { ...f, ...p } : f)) as FomoState[],
    }));
  };

  const applyTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    markTouched();
    setConfig((c) => ({ ...c, items: structuredClone(tpl.items) }));
    setDay((d) => ({ ...d, checked: new Array(tpl.items.length).fill(false) }));
    confirmTick(2);
  };
  const addQuickItem = () => {
    const v = quickAdd.trim();
    if (!v) return;
    markTouched();
    setConfig((c) => ({ ...c, items: [...c.items, { title: v, desc: "" }] }));
    setQuickAdd("");
    confirmTick(1);
  };
  const dropItem = (i: number) => {
    if (dragIdx === null || dragIdx === i) {
      setDragIdx(null);
      return;
    }
    const from = dragIdx;
    markTouched();
    setConfig((c) => {
      const items = c.items.slice();
      const [m] = items.splice(from, 1);
      items.splice(i, 0, m);
      return { ...c, items };
    });
    setDay((d) => {
      const arr = checked.slice();
      const [m] = arr.splice(from, 1);
      arr.splice(i, 0, m);
      return { ...d, checked: arr };
    });
    setDragIdx(null);
  };
  const resetConfig = () => {
    touchedRef.current = false;
    try {
      localStorage.removeItem(CFG_KEY);
    } catch {
      /* noop */
    }
    setConfig(defaultConfigFor(lang));
  };

  /* ══ Contextual quick actions ══ */
  const actions = useMemo(() => {
    type QA = { id: string; icon: string; label: string; kind?: string; run: () => void };
    const A: QA[] = [];
    if (day.locked) {
      A.push({
        id: "add",
        icon: "add",
        label: t("chk.actAddTrade"),
        kind: "primary",
        run: onAddTrade,
      });
      A.push({
        id: "journal",
        icon: "journal",
        label: t("chk.actJournal"),
        run: () => setPage("journal"),
      });
    } else if (interference) {
      A.push({
        id: "center",
        icon: "coach",
        label: t("chk.actCoachCenter"),
        kind: "danger",
        run: () => askCoach(coach.interference),
      });
      A.push({
        id: "mist",
        icon: "mistakes",
        label: t("chk.actMistakes"),
        run: () => setPage("mistakes"),
      });
    } else if (day.fomo === 3) {
      A.push({
        id: "fomo",
        icon: "coach",
        label: t("chk.actCoachFomo"),
        kind: "danger",
        run: () => askCoach(coach.fomo),
      });
      A.push({
        id: "mist",
        icon: "mistakes",
        label: t("chk.actMistakes"),
        run: () => setPage("mistakes"),
      });
    } else {
      A.push({
        id: "ana",
        icon: "analytics",
        label: t("chk.actAnalytics"),
        run: () => setPage("analytics"),
      });
      A.push({
        id: "mist",
        icon: "mistakes",
        label: t("chk.actMistakes"),
        run: () => setPage("mistakes"),
      });
    }
    A.push({
      id: "err",
      icon: "coach",
      label: t("chk.actCoachErrors"),
      kind: day.locked ? undefined : "primary",
      run: () => askCoach(coach.errors),
    });
    A.push({
      id: "reset",
      icon: "reset",
      label: t("chk.actNewSession"),
      kind: "reset",
      run: resetAll,
    });
    return A;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.locked, interference, day.fomo, t, coach, onAddTrade, setPage, askCoach]);

  /* ══ Derived display ══ */
  const nowDate = new Date(now);
  const clockStr = `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}:${pad(nowDate.getSeconds())}`;
  const dateStr = nowDate.toLocaleDateString(lang, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  let winLabel: string;
  if (winOpen) {
    winLabel = `${t("chk.winOpen")} — ${config.startTime} (${config.timeZone})`;
  } else {
    const p = getTimeInZone(nowDate, config.timeZone);
    const left = (parseTimeToMinutes(config.startTime) - (p.hour * 60 + p.minute) + 1440) % 1440;
    winLabel = `${t("chk.winClosed")} ${config.startTime} — T-${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
  }
  const tzOptions = useMemo(getTimeZoneOptions, []);

  // Per-mood accent for the FOMO/mental segments (active state) — mapped by
  // index (calm · focused · impatient · fomo). Pure presentation.
  const FOMO_TONE = [
    "border-cyan-500/50 bg-cyan-500/15 text-cyan-200",
    "border-teal-500/50 bg-teal-500/15 text-teal-200",
    "border-amber-500/50 bg-amber-500/15 text-amber-200",
    "border-red-500/50 bg-red-500/15 text-red-200",
  ];

  return (
    <div ref={wrapRef} onMouseOver={onHover} onPointerDown={autoStartAudio} className="relative">
      {/* Light holographic identity: a faint drifting grid, a slow scanline and
          ambient particles — a discreet nod to the original Pre-Trade OS. */}
      <div className="tvchk-grid" />
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12]" />
      {/* Subtle validation pulse — reuses the global fade, no HUD flash. */}
      <div
        key={flash}
        className={cn(
          "pointer-events-none fixed inset-0 -z-10 bg-cyan-500/5",
          flash > 0 ? "animate-fade-in" : "opacity-0",
        )}
      />

      <div className="p-4 md:p-5 max-w-3xl mx-auto space-y-4">
        {day.locked && (
          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 animate-fade-in-up">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {t("chk.execMode")} {execTime !== "—" ? execTime : ""}
          </div>
        )}
        {editMode && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 animate-fade-in-up">
            {t("chk.editBanner")}
          </div>
        )}
        {/* ══ HEADER ══ */}
        <div className="flex flex-col gap-3 animate-fade-in-up">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-400 tabular-nums">
              {dateStr} · {clockStr}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                winOpen
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              <Clock className="w-3 h-3" /> {winLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                allGates || day.locked
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400",
              )}
            >
              {day.locked ? t("chk.locked") : allGates ? t("chk.ready") : t("chk.standby")}
            </span>
            {streak > 0 && (
              <span
                title={t("chk.streakHint")}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300"
              >
                <Flame className="w-3 h-3" /> {streak} {t("chk.streakSuffix")}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={toggleAudio}
                title={`${t("chk.voice")} · ${audioOn ? "on" : "off"}`}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center border transition",
                  audioOn
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white",
                )}
              >
                {audioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleEdit}
                title={t("chk.editor")}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center border transition",
                  editMode
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white",
                )}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowConfig((v) => !v)}
                title={t("chk.customize")}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center border transition",
                  showConfig
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white",
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ══ CUSTOMIZATION PANEL ══ */}
        {showConfig && (
          <div className="glass-strong rounded-2xl p-4 md:p-5 space-y-4 animate-fade-in-up">
            <div className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white">{t("chk.customize")}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t("chk.cfgIntro")}</p>
              </div>
            </div>

            <button
              onClick={() => setShowWizard(true)}
              className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold text-cyan-300 border border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/15 transition"
            >
              <Wand2 className="w-4 h-4" /> {t("chk.guidedSetup")}
            </button>

            {/* Real in-panel navigation — one thing at a time, never a wall. */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              {(
                [
                  ["items", t("chk.tabChecks")],
                  ["session", t("chk.cfgSession")],
                  ["models", t("chk.tabModels")],
                  ["advanced", t("chk.tabAdvanced")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCfgTab(id)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[11px] md:text-xs font-semibold transition",
                    cfgTab === id
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {cfgTab === "session" && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  {t("chk.cfgSession")}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <label>{t("chk.cfgStart")}</label>
                  <input
                    type="time"
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                    value={config.startTime}
                    onChange={(e) => e.target.value && patch({ startTime: e.target.value })}
                  />
                  <label>{t("chk.cfgTz")}</label>
                  <select
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                    value={config.timeZone}
                    onChange={(e) => patch({ timeZone: e.target.value })}
                  >
                    {tzOptions.map((z) => (
                      <option key={z} value={z} className="bg-[#0a0f1e]">
                        {z}
                      </option>
                    ))}
                  </select>
                  <label>{t("chk.cfgCd")}</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                    value={config.countdown}
                    onChange={(e) =>
                      patch({ countdown: Math.max(1, Math.min(30, +e.target.value || 5)) })
                    }
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  {winOpen
                    ? t("chk.cfgOpenNow")
                    : `${t("chk.cfgOpensAt")} ${config.startTime} (${config.timeZone})`}
                </div>
              </div>
            )}

            {cfgTab === "models" && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  {t("chk.cfgTemplates")}
                </div>
                <p className="text-[11px] text-slate-500">{t("chk.cfgTemplatesHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((tp) => (
                    <button
                      key={tp.id}
                      onClick={() => applyTemplate(tp.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/30 hover:text-white transition"
                    >
                      <span className="font-semibold">{tp.name}</span>
                      <span className="text-[10px] text-cyan-400">{tp.items.length} ✓</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cfgTab === "items" && (
              <div className="space-y-2">
                {/* Phase 3 — liste recommandée par Jarvis (generateChecklist) :
                    le profil onboarding (style, faiblesse, marché, objectif)
                    produit une liste courte sur-mesure. Un clic = appliquée. */}
                {generated.items.length > 0 && (
                  <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] to-teal-500/[0.06] p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400/80">
                        {t("chk.recommended")}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-400 leading-relaxed mb-2.5">
                      {t("chk.recommendedSub")}
                    </p>
                    <ul className="space-y-1 mb-3">
                      {generated.items.slice(0, 4).map((it) => (
                        <li
                          key={it.title}
                          className="flex items-center gap-1.5 text-[11.5px] text-slate-300"
                        >
                          <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                          {it.title}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        markTouched();
                        setConfig((c) => ({ ...c, items: generated.items }));
                        setDay((d) => ({
                          ...d,
                          checked: new Array(generated.items.length).fill(false),
                        }));
                        void syncWizardRules(user?.id, generated.items);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:brightness-110 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {t("chk.applyRecommended")}
                    </button>
                  </div>
                )}

                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  {t("chk.cfgChecklist")} ({nActive}/{config.items.length})
                </div>
                <div className="text-[11px] text-slate-500">{t("chk.cfgDragHint")}</div>
                {config.items.map((it, i) => {
                  const on = isItemOn(it);
                  return (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 transition-opacity",
                        dragIdx === i && "opacity-60",
                        !on && "opacity-50",
                      )}
                      key={i}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropItem(i)}
                      onDragEnd={() => setDragIdx(null)}
                    >
                      <span className="text-slate-600 cursor-grab shrink-0" title="Drag">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <button
                        className={cn(
                          "relative w-9 h-5 rounded-full shrink-0 transition-colors",
                          on ? "bg-cyan-500/70" : "bg-white/[0.1]",
                        )}
                        role="switch"
                        aria-checked={on}
                        title={on ? t("chk.cfgItemOn") : t("chk.cfgItemOff")}
                        onClick={() => patchItem(i, { enabled: !on })}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                            on ? "translate-x-4" : "translate-x-0.5",
                          )}
                        />
                      </button>
                      <div className="flex-1 min-w-0 space-y-1">
                        <input
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                          value={it.title}
                          onChange={(e) => patchItem(i, { title: e.target.value })}
                        />
                        <input
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-cyan-500/40"
                          value={it.desc}
                          placeholder={t("chk.cfgDescOptional")}
                          onChange={(e) => patchItem(i, { desc: e.target.value })}
                        />
                      </div>
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 transition-colors"
                        onClick={() => {
                          markTouched();
                          setConfig((c) => ({ ...c, items: c.items.filter((_, k) => k !== i) }));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <input
                    className="flex-1 min-w-0 bg-white/[0.04] border border-dashed border-white/[0.14] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                    placeholder={t("chk.cfgQuickAdd")}
                    value={quickAdd}
                    onChange={(e) => setQuickAdd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addQuickItem();
                    }}
                  />
                  <button
                    onClick={addQuickItem}
                    disabled={!quickAdd.trim()}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" /> {t("chk.cfgAddItem")}
                  </button>
                </div>
              </div>
            )}

            {cfgTab === "advanced" && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  {t("chk.cfgMotivs")}
                </div>
                <div className="text-[11px] text-slate-500">{t("chk.cfgMotivHint")}</div>
                {config.motivs.map((m, i) => (
                  <div
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2"
                    key={i}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                        value={m.text}
                        onChange={(e) => patchMotiv(i, { text: e.target.value })}
                      />
                      <input
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-cyan-500/40"
                        value={m.msg}
                        placeholder={t("chk.msgPlaceholder")}
                        onChange={(e) => patchMotiv(i, { msg: e.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
                      <input
                        type="checkbox"
                        className="accent-cyan-500"
                        checked={m.ok}
                        onChange={(e) => patchMotiv(i, { ok: e.target.checked })}
                      />
                      {t("chk.process")}
                    </label>
                    <button
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 transition-colors"
                      onClick={() => {
                        markTouched();
                        setConfig((c) => ({ ...c, motivs: c.motivs.filter((_, k) => k !== i) }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                  onClick={() => {
                    markTouched();
                    setConfig((c) => ({
                      ...c,
                      motivs: [...c.motivs, { text: "…", ok: false, msg: "" }],
                    }));
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> {t("chk.cfgAddMotiv")}
                </button>
              </div>
            )}

            {cfgTab === "advanced" && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  {t("chk.cfgStates")}
                </div>
                {config.fomo.map((f, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input
                      className="w-32 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                      value={f.label}
                      onChange={(e) => patchFomo(i, { label: e.target.value })}
                    />
                    <input
                      className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-cyan-500/40"
                      value={f.msg}
                      placeholder={t("chk.msgPlaceholder")}
                      onChange={(e) => patchFomo(i, { msg: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition-colors"
              onClick={resetConfig}
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t("chk.cfgReset")}
            </button>
          </div>
        )}

        {/* The 5-step ritual is hidden while the config panel is open, so the
            panel is the only thing on screen. */}
        {!showConfig && (
          <>
            {/* ══ STEP 1 · PRÉPARATION — the setup checks ══ */}
            <div className="space-y-2.5 animate-fade-in-up">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                  {t("chk.stepPrep")}
                </h2>
                <span className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="glass rounded-2xl p-3 md:p-3.5">
                <div className="flex flex-wrap gap-2">
                  {config.items.map((it, i) =>
                    !isItemOn(it) ? null : (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleItem(i)}
                        style={{ animationDelay: `${0.03 * (i + 1)}s` }}
                        className={cn(
                          "tvchk-item inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] cursor-pointer transition animate-fade-in-up",
                          checked[i] && "done",
                          checked[i]
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.16] hover:text-white",
                        )}
                      >
                        <span
                          className={cn(
                            "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition",
                            checked[i]
                              ? "border-cyan-400 bg-cyan-400 text-[#04141b]"
                              : "border-white/25",
                          )}
                        >
                          {checked[i] && <Check className="w-3 h-3" strokeWidth={3} />}
                        </span>
                        <Ed
                          value={it.title}
                          editable={editMode}
                          onCommit={(v) => patchItem(i, { title: v })}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* ══ STEP 2 · VALIDATION — preparation progress + session window ══ */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                  {t("chk.stepValidation")}
                </h2>
                <span className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="glass rounded-2xl p-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-semibold">{t("chk.gateChecklist")}</span>
                    <span className="tabular-nums text-white font-bold">
                      {nChecked}/{nActive}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition duration-250"
                      style={{ width: `${nActive ? (nChecked / nActive) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shrink-0",
                    winOpen
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                  )}
                >
                  <Clock className="w-3 h-3" /> {winOpen ? t("chk.cfgOpenNow") : config.startTime}
                </span>
              </div>
            </div>

            {/* ══ STEP 3 · MENTAL — motivation + emotional state ══ */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                  {t("chk.stepMental")}
                </h2>
                <span className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <div
                className={cn(
                  "glass rounded-2xl p-3.5 space-y-2.5",
                  interference && "border border-red-500/25",
                )}
              >
                <div className="text-[11px] text-slate-500 font-semibold">{t("chk.secMotiv")}</div>
                <div className="grid grid-cols-2 gap-2">
                  {config.motivs.map((m, i) => (
                    <div
                      key={i}
                      onClick={() => setMotiv(i)}
                      className={cn(
                        "cursor-pointer rounded-xl border px-3 py-2 text-xs transition",
                        day.motiv === i
                          ? m.ok
                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                            : "border-red-500/50 bg-red-500/10 text-red-300"
                          : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.16]",
                      )}
                    >
                      <Ed
                        value={m.text}
                        editable={editMode}
                        onCommit={(v) => patchMotiv(i, { text: v })}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className={cn(
                    "text-xs rounded-lg px-3 py-2 border",
                    day.motiv >= 0
                      ? config.motivs[day.motiv]?.ok
                        ? "border-cyan-500/20 bg-cyan-500/5 text-cyan-200"
                        : "border-red-500/20 bg-red-500/5 text-red-300"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-500 italic",
                  )}
                >
                  {day.motiv >= 0 ? config.motivs[day.motiv]?.msg : t("chk.motivDefault")}
                </div>
                {interference && (
                  <button
                    onClick={() => askCoach(coach.interference)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15 transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5" /> {t("chk.actCoachCenter")}
                  </button>
                )}
              </div>

              <div className="glass rounded-2xl p-3.5 space-y-2.5">
                <div className="text-[11px] text-slate-500 font-semibold">
                  {t("chk.fomoQuestion")}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {config.fomo.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => setFomo(i)}
                      className={cn(
                        "cursor-pointer rounded-xl border px-2 py-2.5 text-center transition",
                        day.fomo === i
                          ? FOMO_TONE[i]
                          : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.16]",
                      )}
                    >
                      <div className="text-base leading-none mb-1">{FOMO_ICONS[i]}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide">
                        <Ed
                          value={f.label}
                          editable={editMode}
                          onCommit={(v) => patchFomo(i, { label: v })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={cn(
                    "text-xs rounded-lg px-3 py-2 border",
                    day.fomo >= 0
                      ? "border-white/[0.08] bg-white/[0.02] text-slate-200"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-500 italic",
                  )}
                >
                  {day.fomo >= 0 ? config.fomo[day.fomo]?.msg : t("chk.fomoDefault")}
                </div>
                {day.fomo === 3 && (
                  <button
                    onClick={() => askCoach(coach.fomo)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15 transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5" /> {t("chk.actCoachFomo")}
                  </button>
                )}
              </div>
            </div>

            {/* ══ STEP 4 · VERROUILLAGE — gates + responsibility ══ */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                  {t("chk.stepLock")}
                </h2>
                <span className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="glass rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Gate
                    ok={gates.check}
                    label={`${t("chk.gateChecklist")} · ${nChecked}/${config.items.length}`}
                  />
                  <Gate ok={gates.mental} label={t("chk.gateMental")} />
                  <Gate ok={gates.motiv} label={t("chk.gateMotiv")} />
                  <Gate ok={gates.win} label={`${t("chk.gateWindow")} ${config.startTime}+`} />
                  <Gate ok={gates.assume} label={t("chk.gateAssume")} />
                </div>
                <button
                  onClick={toggleAssume}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition",
                    day.assume
                      ? "border-cyan-500/40 bg-cyan-500/10"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]",
                  )}
                >
                  <span
                    className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                      day.assume ? "border-cyan-400 bg-cyan-400 text-[#04141b]" : "border-white/25",
                    )}
                  >
                    {day.assume && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">
                      {t("chk.assumeTitle")}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {t("chk.assumePhrase")}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* ══ STEP 5 · TRADE — the go / no-go ══ */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  5
                </span>
                <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">
                  {t("chk.stepTrade")}
                </h2>
                <span className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <Button
                onClick={initiate}
                disabled={!allGates || day.locked}
                className={cn(
                  "w-full h-12 rounded-xl text-sm font-bold uppercase tracking-wide transition",
                  !allGates || day.locked
                    ? "bg-white/[0.04] border border-white/[0.08] text-slate-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-400 hover:to-teal-400 hover:scale-[1.01] active:scale-95",
                )}
              >
                {day.locked ? t("chk.lockedBtn") : t("chk.initiate")}
              </Button>
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {actions.map((a) => (
                    <button
                      key={a.id}
                      onClick={a.run}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/30 hover:text-white transition [&_svg]:w-4 [&_svg]:h-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:[stroke-width:2] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]"
                    >
                      {QA_ICONS[a.icon]} {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ VOICE WIDGET — Jarvis speaking indicator ══
          z-[60] + bottom-28 on mobile keeps it clear of (and above) the bottom
          nav and the FAB; a floating pill, never hidden. */}
      {voice.show && (
        <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-28 md:bottom-8 w-[min(360px,calc(100vw-2rem))] animate-slide-up">
          <div className="relative flex items-center gap-3 rounded-2xl border border-cyan-400/25 glass-strong px-3.5 py-3">
            <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-cyan-500/20 via-transparent to-teal-500/20 opacity-60" />
            <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 shrink-0">
              {voice.speaking && (
                <span className="absolute -inset-1 rounded-xl bg-cyan-500/40 blur-md animate-pulse" />
              )}
              <Bot className="relative w-3.5 h-3.5 text-white" />
            </span>
            <div className="relative min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-bold">
                  Jarvis
                </span>
                <span className={cn("tvchk-wave", voice.speaking && "on")}>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <div className="text-xs text-slate-100 leading-snug line-clamp-2">{voice.text}</div>
            </div>
          </div>
        </div>
      )}

      {/* ══ COUNTDOWN OVERLAY ══ */}
      {countdownVal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="glass-strong rounded-3xl p-8 max-w-sm w-full text-center animate-slide-in">
            <div className="text-sm font-bold text-white">{t("chk.cdTitle")}</div>
            <div className="text-xs text-slate-400 mb-5">{t("chk.cdSub")}</div>
            <div className="relative w-40 h-40 mx-auto mb-5">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="8"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="8"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={((config.countdown - countdownVal) / config.countdown) * 100}
                  style={{
                    transition: "stroke-dashoffset 1s linear",
                    filter: "drop-shadow(0 0 8px rgba(34,211,238,0.5))",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-white tabular-nums">
                {countdownVal}
              </div>
            </div>
            <button
              onClick={cancelCountdown}
              className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition"
            >
              {t("chk.cdCancel")}
            </button>
          </div>
        </div>
      )}

      {/* ══ EDGE LOCKED OVERLAY ══ */}
      {lockOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-strong rounded-3xl p-8 max-w-sm w-full text-center animate-slide-in border border-cyan-500/20">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="text-lg font-bold text-white mb-3">Edge Locked</div>
            <div className="space-y-1 text-xs text-cyan-300 mb-4">
              <div className="flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> EDGE CONFIRMED
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> DISCIPLINE VERIFIED
              </div>
            </div>
            <div className="text-xs text-slate-400 italic mb-5">{t("chk.lockQuote")}</div>
            <div className="flex gap-2.5">
              <button
                onClick={closeLock}
                className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition"
              >
                {t("chk.backStation")}
              </button>
              <Button onClick={confirmLock} className="flex-1">
                {t("chk.enterExec")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showWizard && (
        <ChecklistWizard
          lang={lang}
          defaultTime={wizardDefaultTime}
          onApply={applyWizard}
          onClose={() => {
            try {
              localStorage.setItem(WIZ_KEY, "1");
            } catch {
              /* noop */
            }
            setShowWizard(false);
          }}
        />
      )}
    </div>
  );
}

/** A single lock-gate status chip (validated / pending). Presentation only. */
function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        ok
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
          : "border-white/[0.08] bg-white/[0.03] text-slate-500",
      )}
    >
      <span
        className={cn(
          "w-3.5 h-3.5 rounded-full border flex items-center justify-center",
          ok ? "border-cyan-400 bg-cyan-400/20" : "border-white/15",
        )}
      >
        {ok && <Check className="w-2.5 h-2.5 text-cyan-300" strokeWidth={3} />}
      </span>
      {label}
    </span>
  );
}
