import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Page } from "../types";
import { loadOnboarding, type OnboardingData } from "../store";
import { track } from "../utils/analytics";
import { personalizedItems } from "../utils/adaptiveChecklist";
import ChecklistWizard, { type WizardToggles, type WizardResult } from "./ChecklistWizard";
import {
  type ChkConfig,
  type ChkItem,
  type MotivOpt,
  type Mantra,
  type FomoState,
  defaultConfigFor,
  templatesFor,
  ranksFor,
  coachPromptsFor,
} from "./checklistDefaults";
import "./checklist.css";

import { type Tone, TONES, LINES } from "./checklist/voice";
import {
  FOMO_ICONS,
  FOMO_CLASSES,
  pad,
  getTimeInZone,
  parseTimeToMinutes,
  isWindowOpen,
  getTimeZoneOptions,
  dayOfYear,
  todayKey,
  hydrateConfig,
} from "./checklist/helpers";

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
  /** ISO timestamp of the FIRST time the checklist hit 100% (discipline score). */
  completedAt?: string | null;
}
const emptyDay = (n: number): DayState => ({
  checked: new Array(n).fill(false),
  fomo: -1,
  motiv: -1,
  assume: false,
  locked: false,
  notes: "",
  t0: Date.now(),
  completedAt: null,
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
      className={cn(className, editable && "jk-ed")}
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
}

/* ══════════════════════════════ COMPONENT ══════════════════════════════ */
export default function Checklist({ setPage, onAddTrade }: ChecklistProps) {
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
  const [quote, setQuote] = useState("");
  const [displayScore, setDisplayScore] = useState(0);
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

  // Best-fit preset + sensible guardrail defaults, derived from onboarding.
  const wizardDefaults = useMemo(() => {
    const o = onb;
    const style = o?.style;
    const rec = o?.usesIct
      ? "ict"
      : style === "swing" || style === "position"
        ? "swing"
        : o?.goal === "prop_challenge" || o?.experience === "funded"
          ? "prop"
          : "simple";
    const toggles: WizardToggles = {
      oneTrade: o?.pain === "overtrading" || o?.goal === "discipline",
      news: style === "swing" || style === "position" || o?.pain === "risk",
      rr: o?.goal === "prop_challenge" || style === "swing" || style === "position",
      dd: o?.experience === "funded" || o?.goal === "prop_challenge" || o?.pain === "risk",
    };
    const primary = o?.assets?.[0];
    const time =
      primary === "forex"
        ? { startTime: "08:00", timeZone: "Europe/London" }
        : primary === "futures" || primary === "stocks" || primary === "options"
          ? { startTime: "09:30", timeZone: "America/New_York" }
          : { startTime: config.startTime, timeZone: config.timeZone };
    return { rec, toggles, time };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onb]);

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
  const { ranks: RANKS, descs: RANK_DESCS } = useMemo(() => ranksFor(lang), [lang]);
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
  useEffect(() => {
    try {
      localStorage.setItem(DAY_KEY, JSON.stringify(day));
    } catch {
      /* quota */
    }
  }, [day, DAY_KEY]);

  /* ══ Quote + mission ══ */
  useEffect(() => {
    setQuote(config.quotes[Math.floor(Math.random() * config.quotes.length)] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  const mission = config.missions[dayOfYear() % Math.max(1, config.missions.length)] || "";

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

  const pickVoice = useCallback((forceVl?: "fr" | "en") => {
    const vl = forceVl ?? (langRef.current === "fr" ? "fr" : "en");
    let best: SpeechSynthesisVoice | null = null;
    let bestScore = -999;
    voicesRef.current.forEach((v) => {
      if (!v.lang.startsWith(vl)) return;
      let s = 0;
      const n = v.name;
      // Prefer modern neural / cloud voices — they sound dramatically more
      // premium than the legacy built-ins.
      if (/neural|natural/i.test(n)) s += 12;
      if (/premium|enhanced|multilingual/i.test(n)) s += 5;
      if (/online/i.test(n)) s += 4;
      if (/google/i.test(n)) s += 6;
      if (/microsoft/i.test(n)) s += 3;
      if (vl === "fr" && /paul|henri|guillaume|claude|thomas|r[ée]my|denise/i.test(n)) s += 3;
      if (vl !== "fr" && /ryan|george|daniel|thomas|uk english male|mark\b/i.test(n)) s += 3;
      if (vl !== "fr" && v.lang === "en-GB") s += 2;
      // Deep male timbre suits the composed JARVIS delivery.
      if (/hortense|julie|zira|hazel|susan|linda|female|am[ée]lie|caroline|eloise/i.test(n)) s -= 4;
      if (s > bestScore) {
        best = v;
        bestScore = s;
      }
    });
    return best;
  }, []);

  const speak = useCallback(
    (txt: string, tone: Tone, forceVl?: "fr" | "en") => {
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
        const vl = forceVl ?? (langRef.current === "fr" ? "fr" : "en");
        u.lang = vl === "fr" ? "fr-FR" : "en-GB";
        u.rate = tn.rate;
        u.pitch = tn.pitch;
        u.volume = 0.9;
        const v = pickVoice(forceVl);
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

  const say = useCallback(
    (k: keyof typeof LINES, forceVl?: "fr" | "en") => {
      const o = LINES[k];
      if (!o) return;
      const vl = forceVl ?? (langRef.current === "fr" ? "fr" : "en");
      const arr = o[vl] || o.en;
      const h = new Date().getHours();
      const greet =
        vl === "fr"
          ? h < 18
            ? "Bonjour"
            : "Bonsoir"
          : h < 12
            ? "Good morning"
            : h < 18
              ? "Good afternoon"
              : "Good evening";
      const txt = arr[Math.floor(Math.random() * arr.length)].replace("%G", greet);
      speak(txt, o.tone, forceVl);
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

  /* ══ Canvas particle field — fixed, covers the whole viewport ══ */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
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
      const n = Math.floor((W * H) / 18000);
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
  useEffect(() => {
    const ID = "jchk-fonts";
    if (document.getElementById(ID)) return;
    const link = document.createElement("link");
    link.id = ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  /* ══ Derived scoring ══ */
  const winOpen = isWindowOpen(config, new Date(now));
  const nChecked = checked.filter(Boolean).length;
  const nItems = Math.max(1, config.items.length);

  /* First time the list hits 100% today: stamp it (feeds the Discipline
     Score — "checklist before the first trade") and emit the funnel event. */
  useEffect(() => {
    if (config.items.length === 0 || nChecked < config.items.length || day.completedAt) return;
    setDay((d) => (d.completedAt ? d : { ...d, completedAt: new Date().toISOString() }));
    track("checklist_completed");
  }, [nChecked, config.items.length, day.completedAt]);
  const parts = useMemo(() => {
    const check = Math.round((nChecked / nItems) * 60);
    const mental =
      day.fomo === 0 ? 15 : day.fomo === 1 ? 10 : day.fomo === 2 ? 0 : day.fomo === 3 ? -15 : 0;
    const motivOk = day.motiv >= 0 ? !!config.motivs[day.motiv]?.ok : false;
    const motiv = day.motiv < 0 ? 0 : motivOk ? 15 : -10;
    const win = winOpen ? 10 : 0;
    return {
      check,
      mental,
      motiv,
      win,
      total: Math.max(0, Math.min(100, check + mental + motiv + win)),
    };
  }, [nChecked, nItems, day.fomo, day.motiv, config.motivs, winOpen]);
  const gates = useMemo(
    () => ({
      check: nChecked === config.items.length && config.items.length > 0,
      mental: day.fomo === 0 || day.fomo === 1,
      motiv: day.motiv >= 0 && !!config.motivs[day.motiv]?.ok,
      win: winOpen,
      assume: day.assume,
    }),
    [nChecked, config.items.length, day.fomo, day.motiv, config.motivs, winOpen],
  );
  const allGates = gates.check && gates.mental && gates.motiv && gates.win && gates.assume;
  const interference = day.motiv >= 0 && !config.motivs[day.motiv]?.ok;

  /* animated score number */
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setDisplayScore((s) => {
        const diff = parts.total - s;
        if (Math.abs(diff) < 0.5) return parts.total;
        raf = requestAnimationFrame(step);
        return s + diff * 0.14;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [parts.total]);

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

  /* ══ Completion streak (gamification) ══
     Consecutive WEEKDAYS with a locked checklist, read from the per-day
     localStorage entries. Today counts once locked; weekends never break
     the chain (markets are closed). */
  const streak = useMemo(() => {
    let count = day.locked ? 1 : 0;
    const d = new Date();
    for (let guard = 0; guard < 730; guard++) {
      d.setDate(d.getDate() - 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      try {
        const raw = localStorage.getItem(`tv-chk-${uid}-${d.toISOString().slice(0, 10)}`);
        if (!raw) break;
        const p = JSON.parse(raw) as { locked?: boolean };
        if (!p.locked) break;
        count++;
      } catch {
        break;
      }
    }
    return count;
  }, [uid, day.locked]);

  /* patience timer + ranks */
  const elapsedMs = Math.max(0, now - day.t0);
  const mins = elapsedMs / 60000;
  let rank = 0;
  for (let i = 0; i < RANKS.length; i++) if (mins >= RANKS[i][0]) rank = i;
  const lastRankRef = useRef(0);
  const [rankPulse, setRankPulse] = useState(false);
  useEffect(() => {
    if (rank !== lastRankRef.current) {
      lastRankRef.current = rank;
      setRankPulse(true);
      const tm = setTimeout(() => setRankPulse(false), 900);
      if (rank > 0) {
        blip(1100, 0.13, "sine", 0.018);
        if (rank === 2) say("patience");
      }
      return () => clearTimeout(tm);
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
      const tg = (ev.target as HTMLElement).closest?.(
        ".jk-ci,.jk-mopt,.jk-fseg,.jk-btn,.jk-mantra,.jk-sig,.jk-assume-btn,.jk-toggle,.jk-lock-go,.jk-lock-back,.jk-cd-cancel,.jk-cstep,.jk-tpl",
      );
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
    if (config.motivs[i]?.ok) confirmTick(4);
    else {
      alarm();
      say("interference");
    }
  };
  const setFomo = (i: number) => {
    if (editMode) return;
    setDay((d) => ({ ...d, fomo: i }));
    if (i === 3) alarm();
    else blip(700 + i * 90, 0.08, "sine", 0.018);
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
    setQuote(config.quotes[Math.floor(Math.random() * config.quotes.length)] || "");
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
  const patchMantra = (i: number, p: Partial<Mantra>) => {
    markTouched();
    setConfig((c) => ({
      ...c,
      mantras: c.mantras.map((m, k) => (k === i ? { ...m, ...p } : m)),
    }));
  };
  const patchSignal = (list: "signalsGo" | "signalsStop" | "signalsWait", i: number, v: string) => {
    markTouched();
    setConfig((c) => ({ ...c, [list]: c[list].map((s, k) => (k === i ? v : s)) }));
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
  const mm = Math.floor(mins);
  const ss = Math.floor((elapsedMs % 60000) / 1000);
  const tzOptions = useMemo(getTimeZoneOptions, []);

  return (
    <div
      className={cn("jchk", editMode && "edit-mode")}
      ref={wrapRef}
      onMouseOver={onHover}
      onPointerDown={autoStartAudio}
    >
      <canvas ref={canvasRef} className="jchk-canvas" />
      <div className="jchk-scanline" />
      <div key={flash} className={cn("jchk-hud-flash", flash > 0 && "go")} />

      {day.locked && (
        <div className="jchk-exec-banner">
          <div className="jk-live-dot ok" />
          <span>
            {t("chk.execMode")} {execTime !== "—" ? execTime : ""}
          </span>
        </div>
      )}
      {editMode && <div className="jchk-edit-banner">{t("chk.editBanner")}</div>}

      <div className="jchk-shell">
        {/* ══ HEADER ══ */}
        <div className="jk-header">
          <div>
            <div className="jk-logo-row">
              <div className={cn("jk-live-dot", (allGates || day.locked) && "ok")} />
              <h1 className="jk-h1">
                Pre-Trade <span className="jk-os">OS</span>
              </h1>
            </div>
            <div className="jk-boot-line">JARVIS // systems check — discipline protocol loaded</div>
          </div>
          <div className="jk-header-right">
            <div className="jk-clock-badge">
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>{dateStr}</span>&nbsp;<span className="jk-clock">{clockStr}</span>
            </div>
            <span className={cn("jk-win-status", winOpen ? "open" : "closed")}>{winLabel}</span>
            <span className={cn("jk-ready-pill", (allGates || day.locked) && "ok")}>
              {day.locked ? t("chk.locked") : allGates ? t("chk.ready") : t("chk.standby")}
            </span>
            {streak > 0 && (
              <span className="jk-streak" title={t("chk.streakHint")}>
                🔥 {streak} {t("chk.streakSuffix")}
              </span>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className={cn("jk-toggle", audioOn && "on")} onClick={toggleAudio}>
                <svg viewBox="0 0 24 24">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                </svg>
                <span>
                  {t("chk.voice")} : {audioOn ? "on" : "off"}
                </span>
              </button>
              <button className={cn("jk-toggle", editMode && "on")} onClick={toggleEdit}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>
                  {t("chk.editor")} : {editMode ? "on" : "off"}
                </span>
              </button>
              <button
                className={cn("jk-toggle", showConfig && "on")}
                onClick={() => setShowConfig((v) => !v)}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                <span>{t("chk.customize")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ══ CUSTOMIZATION PANEL ══ */}
        {showConfig && (
          <div className="jk-card jk-config-panel">
            <button className="jk-guided-btn" onClick={() => setShowWizard(true)}>
              ✨ {t("chk.guidedSetup")}
            </button>
            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgSession")}</div>
              <div className="jk-session-config-row">
                <label>{t("chk.cfgStart")}</label>
                <input
                  type="time"
                  className="jk-input"
                  value={config.startTime}
                  onChange={(e) => e.target.value && patch({ startTime: e.target.value })}
                />
                <label>{t("chk.cfgTz")}</label>
                <select
                  className="jk-select"
                  value={config.timeZone}
                  onChange={(e) => patch({ timeZone: e.target.value })}
                >
                  {tzOptions.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
                <label>{t("chk.cfgCd")}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="jk-input"
                  style={{ width: 70 }}
                  value={config.countdown}
                  onChange={(e) =>
                    patch({ countdown: Math.max(1, Math.min(30, +e.target.value || 5)) })
                  }
                />
              </div>
              <div className="jk-session-status">
                {winOpen
                  ? t("chk.cfgOpenNow")
                  : `${t("chk.cfgOpensAt")} ${config.startTime} (${config.timeZone})`}
              </div>
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgTemplates")}</div>
              <div className="jk-tpl-row">
                {templates.map((tp) => (
                  <button key={tp.id} className="jk-tpl" onClick={() => applyTemplate(tp.id)}>
                    <span className="jk-tpl-name">{tp.name}</span>
                    <span className="jk-tpl-count">{tp.items.length} ✓</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">
                {t("chk.cfgChecklist")} ({config.items.length})
              </div>
              <div className="jk-cfg-hint">{t("chk.cfgDragHint")}</div>
              {config.items.map((it, i) => (
                <div
                  className={cn("jk-cfg-row draggable", dragIdx === i && "dragging")}
                  key={i}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropItem(i)}
                  onDragEnd={() => setDragIdx(null)}
                >
                  <span className="jk-drag" title="Drag">
                    ⋮⋮
                  </span>
                  <div className="jk-cfg-col">
                    <input
                      className="jk-input"
                      value={it.title}
                      onChange={(e) => patchItem(i, { title: e.target.value })}
                    />
                    <input
                      className="jk-input"
                      value={it.desc}
                      onChange={(e) => patchItem(i, { desc: e.target.value })}
                    />
                  </div>
                  <button
                    className="jk-cfg-del"
                    onClick={() => {
                      markTouched();
                      setConfig((c) => ({ ...c, items: c.items.filter((_, k) => k !== i) }));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <input
                className="jk-input jk-quick-add"
                placeholder={t("chk.cfgQuickAdd")}
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addQuickItem();
                }}
              />
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgMotivs")}</div>
              <div className="jk-cfg-hint">{t("chk.cfgMotivHint")}</div>
              {config.motivs.map((m, i) => (
                <div className="jk-cfg-row" key={i}>
                  <div className="jk-cfg-col">
                    <input
                      className="jk-input"
                      value={m.text}
                      onChange={(e) => patchMotiv(i, { text: e.target.value })}
                    />
                    <input
                      className="jk-input"
                      value={m.msg}
                      placeholder={t("chk.msgPlaceholder")}
                      onChange={(e) => patchMotiv(i, { msg: e.target.value })}
                    />
                  </div>
                  <label className="jk-cfg-check">
                    <input
                      type="checkbox"
                      checked={m.ok}
                      onChange={(e) => patchMotiv(i, { ok: e.target.checked })}
                    />
                    {t("chk.process")}
                  </label>
                  <button
                    className="jk-cfg-del"
                    onClick={() => {
                      markTouched();
                      setConfig((c) => ({ ...c, motivs: c.motivs.filter((_, k) => k !== i) }));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="jk-cfg-add"
                onClick={() => {
                  markTouched();
                  setConfig((c) => ({
                    ...c,
                    motivs: [...c.motivs, { text: "…", ok: false, msg: "" }],
                  }));
                }}
              >
                {t("chk.cfgAddMotiv")}
              </button>
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgStates")}</div>
              {config.fomo.map((f, i) => (
                <div className="jk-cfg-row" key={i}>
                  <input
                    className="jk-input"
                    style={{ maxWidth: 140 }}
                    value={f.label}
                    onChange={(e) => patchFomo(i, { label: e.target.value })}
                  />
                  <input
                    className="jk-input"
                    value={f.msg}
                    placeholder={t("chk.msgPlaceholder")}
                    onChange={(e) => patchFomo(i, { msg: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgMantras")}</div>
              {config.mantras.map((m, i) => (
                <div className="jk-cfg-row" key={i}>
                  <div className="jk-cfg-col">
                    <input
                      className="jk-input"
                      value={m.text}
                      onChange={(e) => patchMantra(i, { text: e.target.value })}
                    />
                    <input
                      className="jk-input"
                      value={m.why}
                      onChange={(e) => patchMantra(i, { why: e.target.value })}
                    />
                  </div>
                  <button
                    className="jk-cfg-del"
                    onClick={() => {
                      markTouched();
                      setConfig((c) => ({ ...c, mantras: c.mantras.filter((_, k) => k !== i) }));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="jk-cfg-add"
                onClick={() => {
                  markTouched();
                  setConfig((c) => ({
                    ...c,
                    mantras: [...c.mantras, { text: "…", why: "" }],
                  }));
                }}
              >
                {t("chk.cfgAddMantra")}
              </button>
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgSignals")}</div>
              <div className="jk-cfg-row">
                <div className="jk-cfg-col">
                  <div className="jk-cfg-hint">{t("chk.sigGo")}</div>
                  <textarea
                    className="jk-cfg-textarea"
                    value={config.signalsGo.join("\n")}
                    onChange={(e) =>
                      patch({ signalsGo: e.target.value.split("\n").filter((s) => s.trim()) })
                    }
                  />
                </div>
                <div className="jk-cfg-col">
                  <div className="jk-cfg-hint">{t("chk.sigStop")}</div>
                  <textarea
                    className="jk-cfg-textarea"
                    value={config.signalsStop.join("\n")}
                    onChange={(e) =>
                      patch({ signalsStop: e.target.value.split("\n").filter((s) => s.trim()) })
                    }
                  />
                </div>
                <div className="jk-cfg-col">
                  <div className="jk-cfg-hint">{t("chk.sigWait")}</div>
                  <textarea
                    className="jk-cfg-textarea"
                    value={config.signalsWait.join("\n")}
                    onChange={(e) =>
                      patch({ signalsWait: e.target.value.split("\n").filter((s) => s.trim()) })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgQuotes")}</div>
              <textarea
                className="jk-cfg-textarea"
                value={config.quotes.join("\n")}
                onChange={(e) =>
                  patch({ quotes: e.target.value.split("\n").filter((s) => s.trim()) })
                }
              />
            </div>
            <div className="jk-cfg-section">
              <div className="jk-cfg-title">{t("chk.cfgMissions")}</div>
              <textarea
                className="jk-cfg-textarea"
                value={config.missions.join("\n")}
                onChange={(e) =>
                  patch({ missions: e.target.value.split("\n").filter((s) => s.trim()) })
                }
              />
            </div>
            <button className="jk-btn danger" onClick={resetConfig}>
              {t("chk.cfgReset")}
            </button>
          </div>
        )}

        {/* ══ QUOTE + MISSION ══ */}
        <div className="jk-brief-row">
          <div className="jk-card jk-quote-card">
            <div className="jk-q-label">{t("chk.transmission")}</div>
            <div className="jk-q-text">« {quote} »</div>
          </div>
          <div className="jk-card jk-mission-card">
            <div className="jk-m-label">{t("chk.mission")}</div>
            <div className="jk-m-text">{mission}</div>
          </div>
        </div>

        {/* ══ REACTOR / EDGE SCORE ══ */}
        <div className="jk-card jk-hud-corners jk-reactor-wrap">
          <div className="jk-reactor">
            <svg viewBox="0 0 200 200">
              <g className="jk-ring-ticks">
                <circle
                  cx="100"
                  cy="100"
                  r="94"
                  fill="none"
                  stroke="rgba(34,211,238,.25)"
                  strokeWidth="2"
                  strokeDasharray="2 10"
                />
              </g>
              <g className="jk-ring-ticks2">
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  fill="none"
                  stroke="rgba(34,211,238,.15)"
                  strokeWidth="1"
                  strokeDasharray="14 8"
                />
              </g>
              <circle className="jk-ring-track" cx="100" cy="100" r="74" />
              <circle
                className={cn("jk-ring-prog", (parts.mental < 0 || parts.motiv < 0) && "danger")}
                cx="100"
                cy="100"
                r="74"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - parts.total}
              />
              <g className="jk-ring-comet">
                <circle cx="100" cy="100" r="80" pathLength="100" strokeDasharray="10 90" />
              </g>
              <circle
                className="jk-core"
                cx="100"
                cy="100"
                r="52"
                fill="rgba(34,211,238,.06)"
                stroke="rgba(34,211,238,.3)"
                strokeWidth="1"
              />
              <text className="jk-score-num" x="100" y="108" textAnchor="middle">
                {Math.round(displayScore)}
              </text>
              <text className="jk-score-lbl" x="100" y="130" textAnchor="middle">
                EDGE SCORE / 100
              </text>
            </svg>
          </div>
          <div className="jk-reactor-info">
            <div className="jk-ri-title">{t("chk.edgeAnalysis")}</div>
            <div className="jk-ri-bars">
              <div className="jk-ri-row">
                <span className="jk-ri-name">{t("chk.barChecklist")}</span>
                <div className="jk-ri-track">
                  <div className="jk-ri-fill" style={{ width: `${(parts.check / 60) * 100}%` }} />
                </div>
                <span className="jk-ri-val">{parts.check}/60</span>
              </div>
              <div className="jk-ri-row">
                <span className="jk-ri-name">{t("chk.barMental")}</span>
                <div className="jk-ri-track">
                  <div
                    className={cn(
                      "jk-ri-fill",
                      parts.mental < 0 ? "bad" : day.fomo === 2 && "warn",
                    )}
                    style={{
                      width:
                        parts.mental < 0 ? "100%" : `${(Math.max(0, parts.mental) / 15) * 100}%`,
                    }}
                  />
                </div>
                <span className="jk-ri-val">{parts.mental}/15</span>
              </div>
              <div className="jk-ri-row">
                <span className="jk-ri-name">{t("chk.barMotiv")}</span>
                <div className="jk-ri-track">
                  <div
                    className={cn("jk-ri-fill", parts.motiv < 0 && "bad")}
                    style={{
                      width: parts.motiv < 0 ? "100%" : `${(Math.max(0, parts.motiv) / 15) * 100}%`,
                    }}
                  />
                </div>
                <span className="jk-ri-val">{parts.motiv}/15</span>
              </div>
              <div className="jk-ri-row">
                <span className="jk-ri-name">
                  {t("chk.barWindow")} {config.startTime}
                </span>
                <div className="jk-ri-track">
                  <div className="jk-ri-fill" style={{ width: `${(parts.win / 10) * 100}%` }} />
                </div>
                <span className="jk-ri-val">{parts.win}/10</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ CHECKLIST ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secChecklist")}
        </div>
        <div className="jk-checklist">
          {config.items.map((it, i) => (
            <div
              key={i}
              className={cn("jk-ci", checked[i] && "done")}
              style={{ animationDelay: `${0.05 * (i + 1)}s` }}
              onClick={() => toggleItem(i)}
            >
              <div className="jk-scan-bar" />
              <div className="jk-ci-head">
                <div className="jk-ci-box" />
                <div className="jk-ci-title">
                  <Ed
                    value={it.title}
                    editable={editMode}
                    onCommit={(v) => patchItem(i, { title: v })}
                  />
                </div>
              </div>
              <div className="jk-ci-desc">
                <Ed
                  value={it.desc}
                  editable={editMode}
                  onCommit={(v) => patchItem(i, { desc: v })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ══ MOTIVATION ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secMotiv")}
        </div>
        <div className={cn("jk-card jk-motiv-block", interference && "alert")}>
          <div className="jk-motiv-opts">
            {config.motivs.map((m, i) => (
              <div
                key={i}
                className={cn("jk-mopt", day.motiv === i && (m.ok ? "sel-ok" : "sel-bad"))}
                onClick={() => setMotiv(i)}
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
              "jk-motiv-msg",
              day.motiv >= 0 && (config.motivs[day.motiv]?.ok ? "ok" : "bad"),
            )}
          >
            {day.motiv >= 0 ? config.motivs[day.motiv]?.msg : t("chk.motivDefault")}
          </div>
          {interference && (
            <button
              className="jk-btn danger jk-inline-coach"
              onClick={() => askCoach(coach.interference)}
            >
              {QA_ICONS.coach}
              {t("chk.actCoachCenter")}
            </button>
          )}
        </div>

        <hr />

        {/* ══ FOMO ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secFomo")}
        </div>
        <div className={cn("jk-card jk-fomo-block", day.fomo >= 0 && FOMO_CLASSES[day.fomo])}>
          <div className="jk-fomo-bg" />
          <div className="jk-fomo-label">{t("chk.fomoQuestion")}</div>
          <div className="jk-fomo-track">
            {config.fomo.map((f, i) => (
              <div
                key={i}
                className={cn("jk-fseg", `s${i}`, day.fomo === i && "active")}
                onClick={() => setFomo(i)}
              >
                <span className="jk-fseg-icon">{FOMO_ICONS[i]}</span>
                <span className="jk-fseg-label">
                  <Ed
                    value={f.label}
                    editable={editMode}
                    onCommit={(v) => patchFomo(i, { label: v })}
                  />
                </span>
              </div>
            ))}
          </div>
          <div className={cn("jk-fomo-msg", day.fomo >= 0 && ["on", FOMO_CLASSES[day.fomo]])}>
            {day.fomo >= 0 ? config.fomo[day.fomo]?.msg : t("chk.fomoDefault")}
          </div>
          {day.fomo === 3 && (
            <button className="jk-btn danger jk-inline-coach" onClick={() => askCoach(coach.fomo)}>
              {QA_ICONS.coach}
              {t("chk.actCoachFomo")}
            </button>
          )}
        </div>

        {/* ══ PATIENCE ══ */}
        <div className="jk-card jk-patience">
          <div className="jk-pt-ring">
            <svg viewBox="0 0 100 100">
              <circle className="jk-pt-track" cx="50" cy="50" r="42" />
              <circle
                className="jk-pt-prog"
                cx="50"
                cy="50"
                r="42"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={Math.max(0, 100 - (mins / 40) * 100)}
              />
              <text className="jk-pt-time" x="50" y="55" textAnchor="middle">
                {(mm > 99 ? mm : pad(mm)) + ":" + pad(ss)}
              </text>
            </svg>
          </div>
          <div>
            <div className="jk-pt-title">{t("chk.patienceTitle")}</div>
            <div className="jk-pt-desc">{RANK_DESCS[rank]}</div>
            <span className={cn("jk-pt-rank", rankPulse && "lvl-up")}>{RANKS[rank][1]}</span>
          </div>
        </div>

        <hr />

        {/* ══ SIGNALS ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secSignals")}
        </div>
        <div className="jk-sigs">
          {(
            [
              ["go", t("chk.sigGo"), "signalsGo"],
              ["stop", t("chk.sigStop"), "signalsStop"],
              ["wait", t("chk.sigWait"), "signalsWait"],
            ] as const
          ).map(([cls, head, key]) => (
            <div key={cls} className={cn("jk-sig", cls)}>
              <div className="jk-sig-head">{head}</div>
              {config[key].map((s, i) => (
                <div className="jk-sitem" key={i}>
                  <span className="jk-sdot" />
                  <Ed value={s} editable={editMode} onCommit={(v) => patchSignal(key, i, v)} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <hr />

        {/* ══ CYCLE ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secCycle")}
        </div>
        <div className="jk-card jk-cycle">
          <div className="jk-cycle-steps">
            {config.cycle.map((c, i) => (
              <div key={i} className={cn("jk-cstep", `jk-cs-${c.type}`)}>
                <div className="jk-ccirc">{c.label}</div>
                <div className="jk-ctext">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="jk-cycle-alert">
            <Ed
              value={config.cycleAlert}
              editable={editMode}
              onCommit={(v) => patch({ cycleAlert: v })}
            />
          </div>
        </div>

        <hr />

        {/* ══ MANTRAS ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secMantras")}
        </div>
        <div className="jk-mantras">
          {config.mantras.map((m, i) => (
            <div
              key={i}
              className={cn(
                "jk-mantra",
                i === config.mantras.length - 1 && config.mantras.length % 2 === 1 && "full",
              )}
            >
              <div className="jk-m-num">{pad(i + 1)}</div>
              <div className="jk-m-text">
                <Ed
                  value={m.text}
                  editable={editMode}
                  onCommit={(v) => patchMantra(i, { text: v })}
                />
              </div>
              <div className="jk-m-why">
                <Ed
                  value={m.why}
                  editable={editMode}
                  onCommit={(v) => patchMantra(i, { why: v })}
                />
              </div>
            </div>
          ))}
        </div>

        <hr />

        {/* ══ NOTES ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secNotes")}
        </div>
        <div className="jk-card jk-notes-block">
          <textarea
            className="jk-notes-area"
            placeholder={t("chk.notesPlaceholder")}
            value={day.notes}
            onChange={(e) => setDay((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>

        <hr />

        {/* ══ FINAL GATES ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secLock")}
        </div>
        <div className="jk-card jk-hud-corners jk-gates">
          <div className="jk-gate-list">
            <div className={cn("jk-gate", gates.check && "ok")}>
              <span className="jk-g-ind" />
              <span>
                {t("chk.gateChecklist")} — {nChecked}/{config.items.length}
              </span>
            </div>
            <div className={cn("jk-gate", gates.mental && "ok")}>
              <span className="jk-g-ind" />
              <span>{t("chk.gateMental")}</span>
            </div>
            <div className={cn("jk-gate", gates.motiv && "ok")}>
              <span className="jk-g-ind" />
              <span>{t("chk.gateMotiv")}</span>
            </div>
            <div className={cn("jk-gate", gates.win && "ok")}>
              <span className="jk-g-ind" />
              <span>
                {t("chk.gateWindow")} ({config.startTime}+)
              </span>
            </div>
            <div className={cn("jk-gate", gates.assume && "ok")}>
              <span className="jk-g-ind" />
              <span>{t("chk.gateAssume")}</span>
            </div>
          </div>
          <button className={cn("jk-assume-btn", day.assume && "on")} onClick={toggleAssume}>
            <div className="jk-a-box" />
            <div>
              <div className="jk-a-title">{t("chk.assumeTitle")}</div>
              <div className="jk-a-phrase">{t("chk.assumePhrase")}</div>
            </div>
          </button>
          <button className="jk-initiate-btn" onClick={initiate} disabled={!allGates || day.locked}>
            {day.locked ? t("chk.lockedBtn") : t("chk.initiate")}
          </button>
        </div>

        {/* ══ CONTEXTUAL QUICK ACTIONS ══ */}
        <div className="jk-sl">
          <span className="jk-sl-diamond" />
          {t("chk.secActions")}
        </div>
        <div className="jk-actions">
          {actions.map((a) => (
            <button key={a.id} className={cn("jk-btn", a.kind)} onClick={a.run}>
              {QA_ICONS[a.icon]}
              {a.label}
            </button>
          ))}
        </div>

        {/* ══ BOTTOM ══ */}
        <div className="jk-bottom">
          <div>
            <div className="jk-score-big">
              {nChecked}/{config.items.length}
            </div>
            <div className="jk-score-sub">{t("chk.criteria")}</div>
          </div>
          <div className="jk-bottom-note">
            {t("chk.note1")}
            <br />
            {t("chk.note2")}
          </div>
        </div>
      </div>

      {/* ══ VOICE WIDGET ══ */}
      <div className={cn("jchk-voice-widget", voice.show && "show", voice.speaking && "speaking")}>
        <div className="jk-vw-core" />
        <div className="jk-vw-bars">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="jk-vw-meta">
          <div className="jk-vw-label">JARVIS</div>
          <div className="jk-vw-text">{voice.text}</div>
        </div>
      </div>

      {/* ══ COUNTDOWN OVERLAY ══ */}
      {countdownVal !== null && (
        <div className="jchk-overlay">
          <div className="jk-cd-box">
            <div className="jk-cd-label">{t("chk.cdTitle")}</div>
            <div className="jk-cd-sub">{t("chk.cdSub")}</div>
            <div className="jk-cd-ring">
              <svg viewBox="0 0 200 200">
                <circle className="jk-cd-track" cx="100" cy="100" r="80" />
                <circle
                  className="jk-cd-prog"
                  cx="100"
                  cy="100"
                  r="80"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={((config.countdown - countdownVal) / config.countdown) * 100}
                />
                <text className="jk-cd-num" x="100" y="122" textAnchor="middle">
                  {countdownVal}
                </text>
              </svg>
            </div>
            <button className="jk-cd-cancel" onClick={cancelCountdown}>
              {t("chk.cdCancel")}
            </button>
          </div>
        </div>
      )}

      {/* ══ EDGE LOCKED OVERLAY ══ */}
      {lockOverlay && (
        <div className="jchk-overlay lock">
          <div className="jk-lock-box">
            <div className="jk-lock-reactor">
              <svg viewBox="0 0 200 200">
                <g className="jk-ring-ticks">
                  <circle
                    cx="100"
                    cy="100"
                    r="94"
                    fill="none"
                    stroke="rgba(34,211,238,.35)"
                    strokeWidth="2"
                    strokeDasharray="2 10"
                  />
                </g>
                <g className="jk-ring-ticks2">
                  <circle
                    cx="100"
                    cy="100"
                    r="84"
                    fill="none"
                    stroke="rgba(34,211,238,.2)"
                    strokeWidth="1"
                    strokeDasharray="14 8"
                  />
                </g>
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="4"
                  style={{ filter: "drop-shadow(0 0 12px rgba(34,211,238,.7))" }}
                />
                <circle
                  className="jk-core"
                  cx="100"
                  cy="100"
                  r="48"
                  fill="rgba(34,211,238,.12)"
                  stroke="rgba(34,211,238,.5)"
                  strokeWidth="1"
                />
                <text
                  x="100"
                  y="112"
                  textAnchor="middle"
                  style={{
                    fontFamily: "var(--jk-num)",
                    fontSize: 26,
                    fontWeight: 600,
                    fill: "#22d3ee",
                  }}
                >
                  100
                </text>
              </svg>
            </div>
            <div className="jk-lock-title">Edge Locked</div>
            <div className="jk-lock-lines">
              <div className="ok-line">✓ EDGE CONFIRMED</div>
              <div className="ok-line">✓ DISCIPLINE VERIFIED</div>
              <div>» WAITING FOR EXECUTION</div>
            </div>
            <div className="jk-lock-quote">{t("chk.lockQuote")}</div>
            <div className="jk-lock-actions">
              <button className="jk-lock-go" onClick={confirmLock}>
                {t("chk.enterExec")}
              </button>
              <button className="jk-lock-back" onClick={closeLock}>
                {t("chk.backStation")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWizard && (
        <ChecklistWizard
          lang={lang}
          templates={templates}
          recommendedId={wizardDefaults.rec}
          defaultToggles={wizardDefaults.toggles}
          defaultTime={wizardDefaults.time}
          personalItems={personalizedItems(onb, lang)}
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
