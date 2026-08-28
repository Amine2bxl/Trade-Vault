import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  X,
  Star,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Plus,
  Wallet,
  Calculator,
  SlidersHorizontal,
  CandlestickChart,
  Brain,
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Trade, STRATEGIES, MISTAKE_OPTIONS } from "../types";
import { getSession } from "../utils/quantStats";
import { getDuration } from "../utils/tradeCalcs";
import { POINT_VALUES, calcContracts as calcContractsFor } from "../utils/positionCalc";
import { generateId } from "../store";
import {
  loadConfluences,
  saveConfluences,
  loadAccountBalance,
  saveAccountBalance,
  uploadScreenshot,
  deleteScreenshot,
} from "../store";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { compressImageToFile } from "../utils/image";
import { useScreenshotUrls, invalidateScreenshot } from "../hooks/useScreenshotUrls";
import { useDraftAutosave } from "../hooks/useDraftAutosave";
import Lightbox from "./Lightbox";
import { Modal, FIELD_BASE, Textarea, Button, Chip, RemovableChip, CHIP_ROW } from "@/shared/ui";
import { tradeDraftKey, nsKey, readJSON, removeKey, type TradeDraft } from "../utils/persistence";
import {
  REFLECTION_REASONS,
  isIntentEmpty,
  isReflectionEmpty,
  type PlanRespected,
  type ReflectionReason,
  type TradeIntentInput,
  type TradeReflectionInput,
  type TradeJournalMeta,
  loadTradeIntent,
  loadTradeReflection,
} from "../store/tradeIntel";
import { EMOTIONAL_STATES, type EmotionalState } from "../utils/readiness";

interface TradeModalProps {
  trade: Trade | null;
  onClose: () => void;
  onSave: (trade: Trade, meta: TradeJournalMeta) => void;
}

const defaultForm = {
  date: new Date().toISOString().split("T")[0],
  symbol: "",
  direction: "long" as "long" | "short" | "be",
  riskAmount: "",
  riskType: "dollar" as "dollar" | "percent",
  rMultiple: "",
  pnl: 0,
  strategy: "Scalping",
  mistakes: [] as string[],
  setupQuality: 3,
  notes: "",
  screenshots: [] as string[],
  entryTime: "09:30",
  exitTime: "10:00",
  confluences: [] as string[],
  confidence: 70,
  mae: "",
  mfe: "",
  slippage: "",
  intentEmotion: null as EmotionalState | null,
  intentReasoning: "",
  intentPlan: "",
  reflectionPlan: null as PlanRespected | null,
  reflectionReason: null as ReflectionReason | null,
  reflectionNote: "",
};

// L'émotion reprend `EMOTIONAL_STATES` de readiness.ts — un seul vocabulaire.
const EMOTION_LABELS: Record<EmotionalState, string> = {
  calm: "session.stateCalm",
  focused: "session.stateFocused",
  tired: "session.stateTired",
  anxious: "session.stateAnxious",
  frustrated: "session.stateFrustrated",
  overconfident: "session.stateOverconfident",
};

const REASON_LABELS: Record<ReflectionReason, string> = {
  fomo: "trade.reason.fomo",
  revenge: "trade.reason.revenge",
  early_entry: "trade.reason.early_entry",
  late_entry: "trade.reason.late_entry",
  wrong_setup: "trade.reason.wrong_setup",
  wrong_timing: "trade.reason.wrong_timing",
  wrong_risk: "trade.reason.wrong_risk",
  other: "trade.reason.other",
};

export default function TradeModal({ trade, onClose, onSave }: TradeModalProps) {
  const { user } = useAuth();
  const userId = user?.id || "";
  const { t } = useT();

  const [userConfluences, setUserConfluences] = useState<string[]>([]);
  const [newConfluence, setNewConfluence] = useState("");
  const [accountBalance, setAccountBalance] = useState<number>(25000);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadConfluences(userId)
      .then((c) => {
        if (active) setUserConfluences(c);
      })
      .catch(() => {});
    loadAccountBalance(userId)
      .then((b) => {
        if (active) setAccountBalance(b);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  // Draft memory: a NEW trade restores from the auto-saved draft (text fields
  // only — screenshots can't outlive the modal). Editing an existing trade never
  // touches the draft. `draftRestored` drives the "brouillon" badge in the header.
  // Un trade EN COURS D'ÉDITION a son propre brouillon, distinct de celui du
  // formulaire vierge : corriger la note d'un trade existant, cliquer à côté
  // par accident et tout reperdre était exactement le même drame que pour une
  // nouvelle saisie — la seule différence était qu'on ne protégeait que l'une
  // des deux.
  const draftKey = trade ? nsKey(userId, `draft.trade.${trade.id}`) : tradeDraftKey(userId);
  const [draftRestored, setDraftRestored] = useState(false);
  const [form, setForm] = useState(() => {
    if (trade) {
      const base = {
        ...defaultForm,
        date: trade.date,
        symbol: trade.symbol,
        direction: trade.direction,
        riskAmount: String(trade.riskAmount),
        rMultiple: String(trade.rMultiple),
        pnl: trade.pnl,
        strategy: trade.strategy,
        mistakes: trade.mistakes,
        setupQuality: trade.setupQuality,
        notes: trade.notes,
        screenshots: trade.screenshots,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        confluences: trade.confluences,
        confidence: trade.confidence,
        mae: trade.mae != null ? String(trade.mae) : "",
        mfe: trade.mfe != null ? String(trade.mfe) : "",
        slippage: trade.slippage != null ? String(trade.slippage) : "",
      };
      // Modifications non enregistrées récupérées telles quelles (hors
      // captures : leurs fichiers ne survivent pas à la popup).
      const pending = readJSON<TradeDraft | null>(draftKey, null);
      return pending ? { ...base, ...pending, screenshots: trade.screenshots } : base;
    }
    const saved = readJSON<TradeDraft | null>(draftKey, null);
    if (saved) return { ...defaultForm, ...saved, screenshots: [] as string[] };
    return { ...defaultForm };
  });

  // Couleur de la jauge de confiance = celle du badge de statut (cohérence).
  const confidenceColor = useMemo(() => {
    if (form.confidence >= 75) return { from: "#34d399", to: "#10b981", text: "text-emerald-400" };
    if (form.confidence >= 50) return { from: "#fbbf24", to: "#f59e0b", text: "text-amber-400" };
    return { from: "#f87171", to: "#ef4444", text: "text-red-400" };
  }, [form.confidence]);

  // Flag the restored-draft badge on first mount (post-state, avoids SSR mismatch).
  useEffect(() => {
    if (readJSON<TradeDraft | null>(draftKey, null)) setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showCalc, setShowCalc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showIntent, setShowIntent] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [stopPoints, setStopPoints] = useState("");
  const [pointValue, setPointValue] = useState("20");

  // ÉDITION : recharge l'intention et la réflexion DÉJÀ capturées pour ce trade.
  // Sans ça, les sections « Avant/après trade » s'ouvraient vides même quand le
  // trader avait rempli ces champs au moment du log — la donnée existait mais
  // devenait INVISIBLE dès qu'on réouvrait le formulaire. On les rouvre aussi
  // quand elles existent, pour que le trader les VOIE.
  useEffect(() => {
    if (!userId || !trade) return;
    let active = true;
    void Promise.all([
      loadTradeIntent(userId, trade.id).catch(() => null),
      loadTradeReflection(userId, trade.id).catch(() => null),
    ]).then(([intent, reflection]) => {
      if (!active) return;
      if (!intent && !reflection) return;
      setForm((f) => ({
        ...f,
        intentEmotion: intent?.emotion ?? f.intentEmotion,
        intentReasoning: intent?.reasoning ?? f.intentReasoning,
        intentPlan: intent?.plan ?? f.intentPlan,
        reflectionPlan: reflection?.planRespected ?? f.reflectionPlan,
        reflectionReason: reflection?.reason ?? f.reflectionReason,
        reflectionNote: reflection?.note ?? f.reflectionNote,
      }));
      if (intent) setShowIntent(true);
      if (reflection) setShowReflection(true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, trade?.id]);

  const [showAllMistakes, setShowAllMistakes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const riskDollar = useMemo(() => {
    const val = parseFloat(form.riskAmount) || 0;
    if (form.riskType === "dollar") return val;
    return (val / 100) * accountBalance;
  }, [form.riskAmount, form.riskType, accountBalance]);

  const calculatedPnl = useMemo(() => {
    const rm = parseFloat(form.rMultiple) || 0;
    return riskDollar * rm;
  }, [riskDollar, form.rMultiple]);

  // Position-size helper — shared math with the Lot Size Calculator page.
  const calcContracts = useMemo(
    () => calcContractsFor(riskDollar, parseFloat(stopPoints) || 0, parseFloat(pointValue) || 0),
    [riskDollar, stopPoints, pointValue],
  );

  const session = getSession(form.entryTime);

  // Screenshots upload straight to Supabase Storage (bucket path stored on the
  // trade) instead of inlining base64 into the row. Uploads made in this modal
  // session are tracked so they can be cleaned up if the user cancels.
  const sessionUploadsRef = useRef<string[]>([]);
  const savedRef = useRef(false);
  const screenshotUrls = useScreenshotUrls(form.screenshots);

  const handleScreenshotUpload = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0 || !userId) return;
      setUploading(true);
      const newScreenshots: string[] = [];
      for (
        let i = 0;
        i < files.length && form.screenshots.length + newScreenshots.length < 3;
        i++
      ) {
        try {
          const compressed = await compressImageToFile(files[i]);
          const path = await uploadScreenshot(userId, compressed);
          sessionUploadsRef.current.push(path);
          newScreenshots.push(path);
        } catch {
          // skip files that fail to compress/upload; the rest still go through
        }
      }
      setForm((f) => ({ ...f, screenshots: [...f.screenshots, ...newScreenshots] }));
      setUploading(false);
    },
    [form.screenshots.length, userId],
  );

  // Cancel/close without saving → remove files uploaded during this session.
  useEffect(
    () => () => {
      if (savedRef.current) return;
      for (const path of sessionUploadsRef.current) {
        deleteScreenshot(path).catch(() => {});
      }
    },
    [],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length === 0) return;
      e.preventDefault();
      handleScreenshotUpload(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleScreenshotUpload]);

  // Sauvegarde automatique du travail en cours (nouveau trade ET édition).
  //
  // Ce qui est tapé est écrit en continu et, surtout, IMMÉDIATEMENT quand la
  // popup se ferme ou que la page passe en arrière-plan : un clic à côté, un
  // onglet fermé ou une coupure réseau ne fait plus disparaître une note
  // écrite d'un jet. Les captures sont exclues (leur cycle de vie Storage ne
  // survit pas à la popup) ; en édition, celles du trade sont reprises telles
  // quelles à la réouverture.
  const initialSnapshot = useRef<string | null>(null);
  const draftBody = useMemo(() => {
    const { screenshots: _omit, ...rest } = form;
    void _omit;
    return JSON.stringify(rest);
  }, [form]);
  if (initialSnapshot.current === null) initialSnapshot.current = draftBody;

  const hasContent =
    form.symbol.trim() !== "" ||
    form.riskAmount !== "" ||
    form.rMultiple !== "" ||
    form.notes.trim() !== "" ||
    form.mistakes.length > 0 ||
    form.confluences.length > 0;
  // « Sale » = différent de l'état d'ouverture. En édition, rouvrir sans rien
  // toucher n'écrit donc aucun brouillon fantôme.
  const dirty = draftBody !== initialSnapshot.current && hasContent;

  useDraftAutosave(draftKey, form, {
    dirty,
    omit: ["screenshots"],
    guard: () => !savedRef.current,
  });

  useEffect(() => {
    if (dirty) setDraftRestored(true);
  }, [dirty]);

  const discardDraft = () => {
    removeKey(draftKey);
    setDraftRestored(false);
    setForm({ ...defaultForm });
  };

  // Ordre des captures : la première image est la vignette du trade et la
  // séquence raconte le trade (contexte → entrée → sortie). On peut la
  // réarranger sans devoir tout resupprimer et réuploader : glisser-déposer
  // au bureau, flèches au doigt sur mobile.
  const dragIndex = useRef<number | null>(null);
  const moveScreenshot = useCallback((from: number, to: number) => {
    setForm((f) => {
      if (to < 0 || to >= f.screenshots.length || from === to) return f;
      const next = [...f.screenshots];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...f, screenshots: next };
    });
  }, []);

  const removeScreenshot = (idx: number) => {
    const removed = form.screenshots[idx];
    // Only delete the file immediately if it was uploaded in this session —
    // pre-existing files stay until the trade is saved without them.
    if (removed && sessionUploadsRef.current.includes(removed)) {
      sessionUploadsRef.current = sessionUploadsRef.current.filter((p) => p !== removed);
      deleteScreenshot(removed).catch(() => {});
    }
    setForm((f) => ({ ...f, screenshots: f.screenshots.filter((_, i) => i !== idx) }));
  };

  const addConfluence = () => {
    const trimmed = newConfluence.trim();
    if (trimmed && !userConfluences.includes(trimmed)) {
      const updated = [...userConfluences, trimmed];
      setUserConfluences(updated);
      saveConfluences(userId, updated);
    }
    setNewConfluence("");
  };

  const removeConfluence = (c: string) => {
    const updated = userConfluences.filter((x) => x !== c);
    setUserConfluences(updated);
    saveConfluences(userId, updated);
    setForm((f) => ({ ...f, confluences: f.confluences.filter((x) => x !== c) }));
  };

  const toggleConfluence = (c: string) => {
    setForm((f) => ({
      ...f,
      confluences: f.confluences.includes(c)
        ? f.confluences.filter((x) => x !== c)
        : [...f.confluences, c],
    }));
  };

  const handleSave = () => {
    const isBE = form.direction === "be";
    const rm = isBE ? 0 : parseFloat(form.rMultiple) || 0;
    const risk = riskDollar;
    savedRef.current = true;
    // Trade committed — the draft has served its purpose.
    removeKey(draftKey);
    // Pre-existing screenshots the user removed in this session: their files
    // are no longer referenced once the trade saves — delete them now.
    if (trade) {
      for (const old of trade.screenshots) {
        if (!old.startsWith("data:") && !form.screenshots.includes(old)) {
          deleteScreenshot(old).catch(() => {});
        }
      }
    }
    const intent: TradeIntentInput = {
      emotion: form.intentEmotion,
      reasoning: form.intentReasoning.trim() ? form.intentReasoning : null,
      plan: form.intentPlan.trim() ? form.intentPlan : null,
    };
    const reflection: TradeReflectionInput = {
      planRespected: form.reflectionPlan,
      reason: form.reflectionReason,
      note: form.reflectionNote.trim() ? form.reflectionNote : null,
    };
    onSave(
      {
        id: trade?.id || generateId(),
        date: form.date,
        symbol: form.symbol.toUpperCase(),
        direction: form.direction,
        pnl: isBE ? 0 : Math.round(risk * rm * 100) / 100,
        riskAmount: Math.round(risk * 100) / 100,
        rMultiple: rm,
        strategy: form.strategy,
        mistakes: form.mistakes,
        setupQuality: form.setupQuality,
        notes: form.notes,
        screenshots: form.screenshots,
        entryTime: form.entryTime,
        exitTime: form.exitTime,
        confluences: form.confluences,
        confidence: form.confidence,
        mae: form.mae === "" ? null : parseFloat(form.mae) || 0,
        mfe: form.mfe === "" ? null : parseFloat(form.mfe) || 0,
        slippage: form.slippage === "" ? null : parseFloat(form.slippage) || 0,
        // Any save through the form makes the trade "real" — demo badge drops.
        isExample: false,
      },
      {
        intent: isIntentEmpty(intent) ? null : intent,
        reflection: isReflectionEmpty(reflection) ? null : reflection,
      },
    );
  };

  const timeError =
    form.entryTime && form.exitTime && form.entryTime >= form.exitTime
      ? "L'heure d'entrée doit être antérieure à l'heure de sortie."
      : null;
  const rMultipleError =
    form.direction !== "be" && form.rMultiple !== "" && isNaN(parseFloat(form.rMultiple))
      ? "Le R multiple doit être un nombre valide."
      : null;
  const isValid =
    form.symbol &&
    form.date &&
    parseFloat(form.riskAmount) > 0 &&
    (form.direction === "be" || form.rMultiple !== "") &&
    !timeError &&
    !rMultipleError;

  // Shared visual base so every field reads as one system. `inputClass` locks a
  // single control height (h-11 / 44px touch target) so text, number, date, time
  // and select inputs line up pixel-perfect across every row; `textareaClass`
  // reuses the same skin but stays auto-height for multiline notes.
  const fieldBase = FIELD_BASE;
  // Mobile: compact 36px controls so every top field matches the confluence
  // chip height (equal, symmetric bubbles). Desktop keeps the roomier 44px.
  const inputClass = cn(fieldBase, "h-9 sm:h-11 text-xs sm:text-sm");
  const textareaClass = cn(fieldBase, "py-2.5");
  const labelClass =
    "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <>
      <Modal
        open
        onClose={onClose}
        // Un clic à côté ne referme JAMAIS une saisie en cours : c'est le
        // geste accidentel qui faisait perdre une note écrite d'un jet. Sans
        // modification en attente, le comportement habituel reste.
        closeOnBackdrop={!dirty}
        className="md:max-w-2xl max-h-[96vh] md:max-h-[92vh] overflow-hidden"
      >
        {/* Dynamic accent: green when the entry is a gain, red when a loss */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-colors duration-300",
            form.direction === "be"
              ? "bg-slate-500/40"
              : calculatedPnl > 0
                ? "bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
                : calculatedPnl < 0
                  ? "bg-gradient-to-r from-transparent via-red-400/70 to-transparent"
                  : "bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent",
          )}
        />
        {/* Header premium — même matière que le widget compte/Jarvis */}
        <div className="relative flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.06] bg-gradient-to-b from-cyan-500/[0.07] to-transparent overflow-hidden">
          <div className="pointer-events-none absolute -top-10 left-1/3 w-56 h-20 rounded-full bg-cyan-500/10 blur-2xl" />
          <div className="relative flex items-center gap-2.5 min-w-0">
            <span className="relative shrink-0">
              <span
                className={cn(
                  "absolute -inset-1 rounded-xl blur-md transition-colors",
                  form.direction === "be"
                    ? "bg-slate-500/30"
                    : calculatedPnl > 0
                      ? "bg-emerald-500/30"
                      : calculatedPnl < 0
                        ? "bg-red-500/30"
                        : "bg-cyan-500/30",
                )}
              />
              <span
                className={cn(
                  "relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br transition-colors",
                  form.direction === "be"
                    ? "from-slate-400 to-slate-600"
                    : calculatedPnl > 0
                      ? "from-emerald-500 to-teal-500"
                      : calculatedPnl < 0
                        ? "from-red-500 to-orange-500"
                        : "from-cyan-500 to-teal-600",
                )}
              >
                <CandlestickChart className="w-4.5 h-4.5 text-white" />
              </span>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white leading-tight">
                {trade ? t("trade.editTitle") : t("trade.newTitle")}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {form.symbol ? `${form.symbol} · ` : ""}
                {form.direction === "long"
                  ? "Long"
                  : form.direction === "short"
                    ? "Short"
                    : "Break-even"}
              </p>
            </div>
            {!trade && draftRestored && (
              <button
                onClick={discardDraft}
                title={t("trade.discardDraft")}
                className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wide transition hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:bg-red-400" />
                {t("trade.draftBadge")}
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-130px)] px-4 sm:px-6 py-4 space-y-3.5">
          {/* Row 1: Symbol, Direction, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t("trade.symbol")}</label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                placeholder="TSLA"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("trade.direction")}</label>
              <div className="grid grid-cols-3 gap-2">
                {(["long", "short", "be"] as const).map((dir) => {
                  const activeClass =
                    dir === "long"
                      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                      : dir === "short"
                        ? "bg-red-500/15 border-red-500/25 text-red-400"
                        : "bg-slate-500/15 border-slate-500/25 text-slate-300";
                  const label =
                    dir === "be"
                      ? t("common.be")
                      : dir === "long"
                        ? t("common.long")
                        : t("common.short");
                  const shortLabel = dir === "long" ? "L" : dir === "short" ? "S" : "BE";
                  return (
                    <button
                      key={dir}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          direction: dir,
                          ...(dir === "be" ? { rMultiple: "0" } : {}),
                        }))
                      }
                      className={cn(
                        "w-full h-9 sm:h-11 flex items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition border",
                        form.direction === dir
                          ? activeClass
                          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                      )}
                    >
                      {/* Compact single-letter labels on mobile, full words on ≥sm */}
                      <span className="sm:hidden">{shortLabel}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("trade.date")}</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 2: Risk Amount + R:R + P&L */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t("trade.riskAmount")}</label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    {form.riskType === "dollar" ? "$" : ""}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.riskAmount}
                    onChange={(e) => setForm((f) => ({ ...f, riskAmount: e.target.value }))}
                    placeholder={form.riskType === "dollar" ? "0.00" : "1.0"}
                    className={cn(inputClass, "pl-7")}
                  />
                  {form.riskType === "percent" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                      %
                    </span>
                  )}
                </div>
                <button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      riskType: f.riskType === "dollar" ? "percent" : "dollar",
                    }))
                  }
                  className="px-3 rounded-xl border border-white/[0.08] text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition shrink-0"
                >
                  {form.riskType === "dollar" ? "$" : "%"}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("trade.rrMultiple")}</label>
              <input
                type="number"
                step="0.1"
                value={form.rMultiple}
                onChange={(e) => setForm((f) => ({ ...f, rMultiple: e.target.value }))}
                placeholder="2.0"
                className={inputClass}
              />
              <div className="text-[10px] text-slate-600 mt-1">{t("trade.rrHint")}</div>
            </div>
            <div>
              <label className={labelClass}>{t("trade.estPnl")}</label>
              <div
                className={cn(
                  "w-full h-11 flex items-center rounded-xl px-3 text-sm font-bold border tabular-nums",
                  calculatedPnl > 0
                    ? "bg-emerald-500/10 border-emerald-500/15 text-emerald-400"
                    : calculatedPnl < 0
                      ? "bg-red-500/10 border-red-500/15 text-red-400"
                      : "bg-white/[0.03] border-white/[0.06] text-slate-400",
                )}
              >
                {calculatedPnl >= 0 ? "+" : ""}
                {calculatedPnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Account Balance (for % risk) */}
          {form.riskType === "percent" && (
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
              <Wallet className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs text-slate-500 shrink-0">{t("trade.accountBalance")}</span>
              <input
                type="number"
                value={accountBalance}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setAccountBalance(v);
                  saveAccountBalance(userId, v);
                }}
                className="flex-1 bg-transparent text-sm text-white focus:outline-none"
              />
              <span className="text-xs text-slate-600">
                → ${riskDollar.toFixed(2)} {t("dashboard.riskSuffix")}
              </span>
            </div>
          )}

          {/* Position size calculator */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <button
              type="button"
              onClick={() => setShowCalc((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <Calculator className="w-3.5 h-3.5 text-cyan-400/70" />
              {t("trade.positionCalc")}
              {showCalc ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </button>
            {showCalc && (
              <div className="px-3 pb-3 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {POINT_VALUES.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPointValue(String(p.value))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold transition border",
                        pointValue === String(p.value)
                          ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                      )}
                    >
                      {p.label} ${p.value}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>{t("trade.stopPoints")}</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={stopPoints}
                      onChange={(e) => setStopPoints(e.target.value)}
                      placeholder="10"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("trade.pointValue")}</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={pointValue}
                      onChange={(e) => setPointValue(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-xs font-semibold border flex items-center justify-between",
                    calcContracts
                      ? "bg-cyan-500/[0.06] border-cyan-500/15 text-cyan-300"
                      : "bg-white/[0.02] border-white/[0.04] text-slate-500",
                  )}
                >
                  {calcContracts ? (
                    <>
                      <span>
                        {calcContracts.contracts} {t("trade.contracts")}
                      </span>
                      <span className="text-slate-400">
                        {t("trade.effectiveRisk")}: ${calcContracts.effectiveRisk.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span>{t("trade.calcHint")}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Entry/Exit Time + Strategy — temps en un tap (presets) ou picker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t("trade.entryTime")}</label>
              <input
                type="time"
                value={form.entryTime}
                onChange={(e) => setForm((f) => ({ ...f, entryTime: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("trade.exitTime")}</label>
              <input
                type="time"
                value={form.exitTime}
                onChange={(e) => setForm((f) => ({ ...f, exitTime: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("trade.strategy")}</label>
              <select
                value={form.strategy}
                onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
                className={cn(inputClass, "cursor-pointer appearance-none")}
              >
                {STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Presets d'heure — un tap remplit entrée + sortie (puis ajustables) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-0.5">
              {t("trade.timePresets")}
            </span>
            {[
              { t: "09:30", v: "10:15" },
              { t: "10:00", v: "11:00" },
              { t: "15:30", v: "16:00" },
              { t: "16:00", v: "17:00" },
            ].map((p) => (
              <button
                key={p.t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, entryTime: p.t, exitTime: p.v }))}
                className="h-8 px-2.5 rounded-lg text-[11px] font-bold border transition bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-cyan-500/30"
              >
                {p.t} → {p.v}
              </button>
            ))}
          </div>

          {/* Setup Quality — jauges d'étoiles premium dans un conteneur */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + " mb-0"}>{t("trade.setupQuality")}</label>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                  form.setupQuality <= 1 && "text-red-300 bg-red-500/10 border-red-500/25",
                  form.setupQuality === 2 && "text-amber-300 bg-amber-500/10 border-amber-500/25",
                  form.setupQuality === 3 && "text-slate-200 bg-white/[0.05] border-white/[0.1]",
                  form.setupQuality === 4 && "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
                  form.setupQuality >= 5 &&
                    "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
                )}
              >
                {
                  [
                    t("trade.quality1"),
                    t("trade.quality2"),
                    t("trade.quality3"),
                    t("trade.quality4"),
                    t("trade.quality5"),
                  ][form.setupQuality - 1]
                }
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = n <= form.setupQuality;
                return (
                  <button
                    key={n}
                    onClick={() => setForm((f) => ({ ...f, setupQuality: n }))}
                    aria-label={`${n} / 5`}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 transition active:scale-95",
                      on
                        ? "bg-amber-500/15 border-amber-500/30"
                        : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]",
                    )}
                  >
                    <Star
                      className={cn(
                        "w-4 h-4 transition duration-200",
                        on
                          ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]"
                          : "text-slate-600",
                      )}
                      strokeWidth={on ? 2 : 1.75}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confidence — jauge RADIALE premium + slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + " mb-0"}>{t("trade.confidence")}</label>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                  form.confidence >= 75 &&
                    "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
                  form.confidence >= 50 &&
                    form.confidence < 75 &&
                    "text-amber-300 bg-amber-500/10 border-amber-500/25",
                  form.confidence < 50 && "text-red-300 bg-red-500/10 border-red-500/25",
                )}
              >
                {form.confidence >= 75
                  ? t("trade.confHigh")
                  : form.confidence >= 50
                    ? t("trade.confMid")
                    : t("trade.confLow")}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {/* Jauge radiale — la couleur suit le niveau, comme le badge */}
              <div className="relative shrink-0">
                <svg
                  width="68"
                  height="68"
                  viewBox="0 0 68 68"
                  className="-rotate-90"
                  style={{ overflow: "visible" }}
                >
                  <circle
                    cx="34"
                    cy="34"
                    r="27"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r="27"
                    fill="none"
                    stroke={confidenceColor.from}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 27}
                    strokeDashoffset={2 * Math.PI * 27 * (1 - form.confidence / 100)}
                    opacity="0.25"
                    filter="url(#confGlow)"
                    className="transition-[stroke-dashoffset] duration-250"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r="27"
                    fill="none"
                    stroke={`url(#confGrad)`}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 27}
                    strokeDashoffset={2 * Math.PI * 27 * (1 - form.confidence / 100)}
                    className="transition-[stroke-dashoffset] duration-250"
                  />
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={confidenceColor.from} />
                      <stop offset="100%" stopColor={confidenceColor.to} />
                    </linearGradient>
                    <filter id="confGlow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="4" />
                    </filter>
                  </defs>
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <span
                    className={cn(
                      "font-display text-base font-extrabold tabular-nums",
                      confidenceColor.text,
                    )}
                  >
                    {form.confidence}%
                  </span>
                </div>
              </div>
              {/* Slider */}
              <input
                type="range"
                min="1"
                max="100"
                value={form.confidence}
                onChange={(e) => setForm((f) => ({ ...f, confidence: parseInt(e.target.value) }))}
                className="flex-1 min-w-0"
              />
            </div>
          </div>

          {/* Intention — avant le trade (optionnel, ~5 s) */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <button
              type="button"
              onClick={() => setShowIntent((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-cyan-400/70" />
              {t("trade.intent")}
              {showIntent ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </button>
            {showIntent && (
              <div className="px-3 pb-3 space-y-2.5">
                <div>
                  <label className={labelClass}>{t("trade.intentEmotion")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOTIONAL_STATES.map((s) => (
                      <Chip
                        key={s}
                        selected={form.intentEmotion === s}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            intentEmotion: f.intentEmotion === s ? null : s,
                          }))
                        }
                      >
                        {t(EMOTION_LABELS[s] as never)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t("trade.intentReasoning")}</label>
                  <Textarea
                    value={form.intentReasoning}
                    onChange={(e) => setForm((f) => ({ ...f, intentReasoning: e.target.value }))}
                    placeholder={t("trade.intentReasoningPh")}
                    rows={2}
                    className={cn(textareaClass, "text-xs sm:text-sm")}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("trade.intentPlan")}</label>
                  <Textarea
                    value={form.intentPlan}
                    onChange={(e) => setForm((f) => ({ ...f, intentPlan: e.target.value }))}
                    placeholder={t("trade.intentPlanPh")}
                    rows={2}
                    className={cn(textareaClass, "text-xs sm:text-sm")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confluences (customizable) and Mistakes below both render the one
              shared `Chip` from the design system — same size, shape, spacing
              and states, here and in the Missed Setup modal. */}
          <div>
            <label className={labelClass}>{t("trade.confluences")}</label>
            <div className={cn(CHIP_ROW, "mb-2")}>
              {userConfluences.map((c) => (
                <RemovableChip
                  key={c}
                  selected={form.confluences.includes(c)}
                  onClick={() => toggleConfluence(c)}
                  onRemove={() => removeConfluence(c)}
                  removeLabel={t("common.remove")}
                >
                  {c}
                </RemovableChip>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newConfluence}
                onChange={(e) => setNewConfluence(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addConfluence())}
                placeholder={t("trade.addConfluencePlaceholder")}
                className={cn(inputClass, "flex-1 py-2 text-xs")}
              />
              <button
                onClick={addConfluence}
                aria-label={t("common.add")}
                className="px-3 rounded-xl border border-white/[0.08] text-cyan-400 hover:bg-cyan-500/10 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mistakes */}
          <div>
            <label className={labelClass}>{t("trade.mistakes")}</label>
            <div className={CHIP_ROW}>
              {(showAllMistakes ? MISTAKE_OPTIONS : MISTAKE_OPTIONS.slice(0, 5)).map((m) => (
                <Chip
                  key={m}
                  tone="danger"
                  selected={form.mistakes.includes(m)}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      mistakes: f.mistakes.includes(m)
                        ? f.mistakes.filter((x) => x !== m)
                        : [...f.mistakes, m],
                    }))
                  }
                >
                  {m}
                </Chip>
              ))}
              <button
                onClick={() => setShowAllMistakes(!showAllMistakes)}
                aria-label={showAllMistakes ? t("common.showLess") : t("common.showMore")}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 px-2 py-1.5"
              >
                {showAllMistakes ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* Réflexion — après le trade (optionnel, 2 clics) */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <button
              type="button"
              onClick={() => setShowReflection((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-cyan-400/70" />
              {t("trade.reflection")}
              {showReflection ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </button>
            {showReflection && (
              <div className="px-3 pb-3 space-y-2.5">
                <div>
                  <label className={labelClass}>{t("trade.reflectionPlanRespected")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["yes", "partial", "no"] as const).map((p) => {
                      const label =
                        p === "yes"
                          ? t("trade.reflectionYes")
                          : p === "partial"
                            ? t("trade.reflectionPartial")
                            : t("trade.reflectionNo");
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              reflectionPlan: f.reflectionPlan === p ? null : p,
                            }))
                          }
                          className={cn(
                            "h-9 sm:h-10 rounded-xl text-xs font-semibold border transition",
                            form.reflectionPlan === p
                              ? p === "yes"
                                ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                                : p === "partial"
                                  ? "bg-amber-500/15 border-amber-500/25 text-amber-400"
                                  : "bg-red-500/15 border-red-500/25 text-red-400"
                              : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t("trade.reflectionReason")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {REFLECTION_REASONS.map((r) => (
                      <Chip
                        key={r}
                        selected={form.reflectionReason === r}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            reflectionReason: f.reflectionReason === r ? null : r,
                          }))
                        }
                      >
                        {t(REASON_LABELS[r] as never)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t("trade.reflectionNote")}</label>
                  <Textarea
                    value={form.reflectionNote}
                    onChange={(e) => setForm((f) => ({ ...f, reflectionNote: e.target.value }))}
                    placeholder={t("trade.reflectionNotePh")}
                    rows={2}
                    className={cn(textareaClass, "text-xs sm:text-sm")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Screenshots */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + " mb-0"}>{t("trade.screenshots")}</label>
              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                {t("common.pasteHint")}
              </span>
            </div>
            <div className="flex gap-3 flex-wrap items-start">
              {form.screenshots.map((shot, i) => (
                <div
                  key={shot || i}
                  draggable
                  onDragStart={() => {
                    dragIndex.current = i;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) moveScreenshot(dragIndex.current, i);
                    dragIndex.current = null;
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null;
                  }}
                  className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/[0.08] group cursor-grab active:cursor-grabbing"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="block w-full h-full"
                  >
                    {screenshotUrls[shot] ? (
                      <img
                        src={screenshotUrls[shot]}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={() => {
                          invalidateScreenshot(shot);
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                  {/* Rang + flèches de réordonnancement (tactile). */}
                  <span className="absolute top-1 left-1 grid h-5 w-5 place-items-center rounded-md bg-black/70 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  {form.screenshots.length > 1 && (
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => moveScreenshot(i, i - 1)}
                        aria-label={t("trade.moveScreenshotLeft")}
                        className="flex-1 py-1 grid place-items-center text-white disabled:opacity-25"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={i === form.screenshots.length - 1}
                        onClick={() => moveScreenshot(i, i + 1)}
                        aria-label={t("trade.moveScreenshotRight")}
                        className="flex-1 py-1 grid place-items-center text-white disabled:opacity-25"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => removeScreenshot(i)}
                    aria-label={t("common.remove")}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {form.screenshots.length < 3 && (
                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/30 hover:bg-cyan-500/[0.03] transition">
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-5 h-5 text-slate-600" />
                      <span className="text-[10px] text-slate-600 mt-1">{t("trade.upload")}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleScreenshotUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Advanced: MAE / MFE / slippage */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400/70" />
              {t("trade.advanced")}
              {showAdvanced ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>MAE ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mae}
                    onChange={(e) => setForm((f) => ({ ...f, mae: e.target.value }))}
                    placeholder="—"
                    className={inputClass}
                  />
                  <div className="text-[11px] text-slate-600 mt-1">{t("trade.maeHint")}</div>
                </div>
                <div>
                  <label className={labelClass}>MFE ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mfe}
                    onChange={(e) => setForm((f) => ({ ...f, mfe: e.target.value }))}
                    placeholder="—"
                    className={inputClass}
                  />
                  <div className="text-[11px] text-slate-600 mt-1">{t("trade.mfeHint")}</div>
                </div>
                <div>
                  <label className={labelClass}>{t("trade.slippage")} ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.slippage}
                    onChange={(e) => setForm((f) => ({ ...f, slippage: e.target.value }))}
                    placeholder="—"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>{t("trade.notes")}</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={t("trade.notesPlaceholder")}
              className={textareaClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-t border-white/[0.06]">
          {/* Live recap: what will be saved */}
          <div className="flex-1 min-w-0 flex items-center gap-2 text-[11px] text-slate-500 overflow-hidden">
            {isValid ? (
              <>
                <span className="font-bold text-white shrink-0">{form.symbol.toUpperCase()}</span>
                {session && (
                  <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[11px] font-bold uppercase shrink-0">
                    {t(`session.${session}` as never)}
                  </span>
                )}
                <span className="hidden sm:inline shrink-0">
                  {getDuration(form.entryTime, form.exitTime)}
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums shrink-0",
                    form.direction === "be"
                      ? "text-slate-300"
                      : calculatedPnl >= 0
                        ? "text-emerald-400"
                        : "text-red-400",
                  )}
                >
                  {form.direction === "be"
                    ? "BE"
                    : `${calculatedPnl >= 0 ? "+" : ""}$${Math.abs(calculatedPnl).toFixed(2)}`}
                </span>
              </>
            ) : (
              <span className="truncate">{t("trade.fillRequired")}</span>
            )}
          </div>
        </div>
        {(timeError || rMultipleError) && (
          <div className="px-4 md:px-6 pb-2 space-y-1">
            {timeError && <p className="text-xs text-red-400">{timeError}</p>}
            {rMultipleError && <p className="text-xs text-red-400">{rMultipleError}</p>}
          </div>
        )}
        <div className="sticky bottom-0 bg-[#0a1220] border-t border-white/[.06] px-4 md:px-6 py-3 md:py-4 flex items-center justify-end gap-2 z-10">
          <button
            onClick={onClose}
            className="px-4 md:px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            {t("common.cancel")}
          </button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition",
              isValid
                ? "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed",
            )}
          >
            {trade ? t("trade.updateTrade") : t("trade.saveTrade")}
          </Button>
        </div>
      </Modal>

      {lightboxIndex !== null && (
        <Lightbox
          images={form.screenshots.map((s) => screenshotUrls[s] || "")}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </>
  );
}
