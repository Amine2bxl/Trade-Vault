import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  X,
  Plus,
  CandlestickChart,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FilePenLine,
  ChevronDown,
} from "@/shared/ui/icons";
import { Trade, STRATEGIES, MISTAKE_OPTIONS } from "@/app/types";
import { POINT_VALUES, calcContracts as calcContractsFor } from "@/app/trading/positionCalc";
import { generateId } from "@/app/store";
import {
  loadConfluences,
  saveConfluences,
  loadAccountBalance,
  saveAccountBalance,
  uploadScreenshot,
  deleteScreenshot,
} from "@/app/store";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import { useConfirm } from "@/app/contexts/ConfirmContext";
import { compressImageToFile } from "@/app/utils/image";
import { useScreenshotUrls, invalidateScreenshot } from "@/app/hooks/useScreenshotUrls";
import { useDraftAutosave } from "@/app/hooks/useDraftAutosave";
import Lightbox from "@/app/components/Lightbox";
import {
  Modal,
  Textarea,
  Button,
  Chip,
  RemovableChip,
  CHIP_ROW,
  DateField,
  TimeField,
  Input,
  Field,
  ChoiceGroup,
  Disclosure,
  SelectPicker,
} from "@/shared/ui";
import { intlLocale } from "@/app/i18n/locale";
import {
  tradeDraftKey,
  nsKey,
  readJSON,
  removeKey,
  type TradeDraft,
} from "@/app/utils/persistence";
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
} from "@/app/store/tradeIntel";
import { EMOTIONAL_STATES, type EmotionalState } from "@/app/trading/readiness";
import { currencySymbol, formatMoney } from "@/shared/currency";

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
  // Trade importé : P&L net et exécution, préremplis par le broker et
  // modifiables (le broker peut se tromper de frais, le trader de compte).
  brokerPnl: "",
  quantity: "",
  entryPrice: "",
  exitPrice: "",
  fees: "",
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
  const { t, lang } = useT();

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
        // Un trade importé sans stop retrouvé arrive à risque 0 : le champ
        // reste VIDE (et non « 0 ») pour que le trader voie qu'il est à saisir.
        riskAmount: trade.broker && !(trade.riskAmount > 0) ? "" : String(trade.riskAmount),
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
        brokerPnl: trade.broker ? String(trade.pnl) : "",
        quantity: trade.quantity != null ? String(trade.quantity) : "",
        entryPrice: trade.entryPrice != null ? String(trade.entryPrice) : "",
        exitPrice: trade.exitPrice != null ? String(trade.exitPrice) : "",
        fees: trade.fees != null ? String(trade.fees) : "",
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

  // Flag the restored-draft badge on first mount (post-state, avoids SSR mismatch).
  useEffect(() => {
    if (readJSON<TradeDraft | null>(draftKey, null)) setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [timingOpen, setTimingOpen] = useState(false);
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

  /* LE P&L D'UN TRADE IMPORTÉ EST LA RÉFÉRENCE, PAS UN CALCUL. Pour une
     saisie manuelle, P&L = risque × R. Pour un trade venu du broker, le P&L
     net est ce que le compte a encaissé : c'est lui qui fait foi, et le R qui
     s'en DÉDUIT avec le risque que le trader confirme. Sans ce renversement,
     saisir le risque d'un trade importé (R encore à 0) aurait écrit un P&L
     nul par-dessus celui du broker.
     Les deux restent MODIFIABLES : corriger le P&L recalcule le R, saisir un
     R réécrit le P&L (risque × R). Le trader a toujours le dernier mot. */
  const pnlLocked = !!trade?.broker;
  const brokerPnl = pnlLocked ? parseFloat(form.brokerPnl) || 0 : null;
  const derivedR = pnlLocked && riskDollar > 0 ? (brokerPnl as number) / riskDollar : 0;
  // Saisie du R en cours : le champ montre ce qui est tapé, pas l'arrondi
  // recalculé à chaque frappe (« 1. » deviendrait « 1.00 » sous le curseur).
  const [rDraft, setRDraft] = useState<string | null>(null);
  const editBrokerR = (value: string) => {
    setRDraft(value);
    const r = parseFloat(value);
    if (riskDollar > 0 && Number.isFinite(r)) {
      setForm((f) => ({ ...f, brokerPnl: String(Math.round(riskDollar * r * 100) / 100) }));
    }
  };
  /** Un nombre saisi, ou `null` si le champ est vide (donnée inconnue). */
  const optionalNumber = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const calculatedPnl = useMemo(() => {
    if (pnlLocked) return brokerPnl as number;
    const rm = parseFloat(form.rMultiple) || 0;
    return riskDollar * rm;
  }, [riskDollar, form.rMultiple, pnlLocked, brokerPnl]);

  // Position-size helper — shared math with the Lot Size Calculator page.
  const calcContracts = useMemo(
    () => calcContractsFor(riskDollar, parseFloat(stopPoints) || 0, parseFloat(pointValue) || 0),
    [riskDollar, stopPoints, pointValue],
  );

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

  const confirm = useConfirm();
  /* SUPPRIMER UN BROUILLON SE CONFIRME. Un clic sur le badge effaçait tout ce
     qui avait été saisi, sans retour possible — et le badge est posé à côté du
     titre, là où le pouce passe. */
  const discardDraft = async () => {
    const ok = await confirm(t("trade.discardDraftConfirm"), {
      danger: true,
      detail: t("common.irreversible"),
      confirmLabel: t("trade.discardDraft"),
    });
    if (!ok) return;
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
    const risk = riskDollar;
    // Trade importé : le R se déduit du P&L broker (exact, sans arrondi au
    // centième qui ferait dériver le P&L d'un cent).
    const rm = pnlLocked
      ? Math.round(derivedR * 10000) / 10000
      : isBE
        ? 0
        : parseFloat(form.rMultiple) || 0;
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
        pnl: pnlLocked
          ? Math.round((brokerPnl as number) * 100) / 100
          : isBE
            ? 0
            : Math.round(risk * rm * 100) / 100,
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
        // Le compte du trade VOYAGE avec lui : le formulaire ne l'édite pas, il
        // ne doit pas non plus le perdre (sans `accountId`, un trade modifié
        // depuis un autre compte actif y était réaffecté — voir `tradeToRow`).
        accountId: trade?.accountId,
        // L'exécution d'un trade importé est éditable ; celle d'un trade saisi
        // à la main (souvent absente) est conservée telle quelle.
        quantity: pnlLocked ? optionalNumber(form.quantity) : trade?.quantity,
        entryPrice: pnlLocked ? optionalNumber(form.entryPrice) : trade?.entryPrice,
        exitPrice: pnlLocked ? optionalNumber(form.exitPrice) : trade?.exitPrice,
        fees: pnlLocked ? optionalNumber(form.fees) : trade?.fees,
        broker: trade?.broker,
        externalId: trade?.externalId,
        brokerAccount: trade?.brokerAccount,
        copiedFrom: trade?.copiedFrom,
        // Enregistré depuis le formulaire = relu.
        reviewPending: false,
      },
      {
        intent: isIntentEmpty(intent) ? null : intent,
        reflection: isReflectionEmpty(reflection) ? null : reflection,
      },
    );
  };

  /* Une sortie AVANT l'entrée est une donnée impossible pour un trade du jour
     (le modèle n'a qu'une date par trade : pas de trade de nuit à préserver).
     Même minute = autorisé : un scalp tient souvent dans la minute. Les heures
     sont normalisées (« 9:05 » importé d'un CSV → « 09:05 ») avant comparaison. */
  const hhmm = (v: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(v ?? "");
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  };
  // Un trade IMPORTÉ peut passer minuit (session du soir) : ses heures sont
  // celles du broker, pas une saisie à corriger.
  const timeError =
    !pnlLocked && form.entryTime && form.exitTime && hhmm(form.exitTime) < hhmm(form.entryTime)
      ? t("trade.error.exitBeforeEntry")
      : null;
  const rMultipleError =
    form.direction !== "be" && form.rMultiple !== "" && isNaN(parseFloat(form.rMultiple))
      ? "Le R multiple doit être un nombre valide."
      : null;
  const isValid =
    form.symbol &&
    form.date &&
    parseFloat(form.riskAmount) > 0 &&
    (pnlLocked || form.direction === "be" || form.rMultiple !== "") &&
    // P&L d'un trade importé vidé : refusé plutôt qu'enregistré à 0, ce qui
    // ferait d'un gain un trade nul dans toutes les statistiques.
    (!pnlLocked || (form.brokerPnl.trim() !== "" && Number.isFinite(parseFloat(form.brokerPnl)))) &&
    !timeError &&
    !rMultipleError;

  const labelClass = "tv-label mb-1.5 block text-slate-500";

  return (
    <>
      <Modal
        open
        onClose={onClose}
        closeOnBackdrop={!dirty}
        labelledBy="trade-form-title"
        className="tv-trade-modal tv-compact-form flex max-h-[min(86dvh,680px)] flex-col overflow-hidden md:max-w-xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--tv-border)] px-4 py-2.5">
          <CandlestickChart className="h-5 w-5 shrink-0 text-[var(--tv-highlight)]" />
          <div className="min-w-0 flex-1">
            <h2 id="trade-form-title" className="tv-title">
              {trade ? t("trade.editTitle") : t("trade.newTitle")}
            </h2>
          </div>
          {!trade && draftRestored && (
            <button
              type="button"
              onClick={() => void discardDraft()}
              title={t("trade.discardDraft")}
              className="tv-draft-badge"
            >
              <FilePenLine className="h-3.5 w-3.5" /> {t("trade.draftBadge")}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <form
          id="trade-entry-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid) handleSave();
          }}
          className="tv-trade-form min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        >
          <div className="space-y-3">
            {trade?.broker && (
              <p className="tv-prose text-slate-500">
                {t("trade.importedFrom").replace("{broker}", "Tradovate")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("trade.symbol")}>
                <Input
                  aria-label={t("trade.symbol")}
                  className="tv-trade-symbol"
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                  placeholder="NQ"
                />
              </Field>
              <Field label={t("trade.date")}>
                <DateField
                  value={form.date}
                  onChange={(date) => setForm((f) => ({ ...f, date }))}
                  locale={intlLocale(lang)}
                  todayLabel={t("common.today")}
                  aria-label={t("trade.date")}
                />
              </Field>
            </div>
            <Field label={t("trade.direction")} className="tv-direction">
              <ChoiceGroup
                label={t("trade.direction")}
                value={form.direction}
                options={[
                  {
                    value: "long",
                    label: t("common.long"),
                    icon: <ArrowUpRight className="h-4 w-4" />,
                    tone: "positive",
                  },
                  {
                    value: "short",
                    label: t("common.short"),
                    icon: <ArrowDownRight className="h-4 w-4" />,
                    tone: "negative",
                  },
                  { value: "be", label: t("common.be"), icon: <Minus className="h-4 w-4" /> },
                ]}
                onChange={(direction) =>
                  setForm((f) => ({
                    ...f,
                    direction,
                    ...(direction === "be" ? { rMultiple: "0" } : {}),
                  }))
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("trade.riskAmount")}>
                <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                  <Input
                    aria-label={t("trade.riskAmount")}
                    className="tv-trade-number tv-figure"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.riskAmount}
                    onChange={(e) => setForm((f) => ({ ...f, riskAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                  <SelectPicker
                    variant="field"
                    label={t("trade.riskUnit")}
                    value={form.riskType}
                    onChange={(riskType) => setForm((f) => ({ ...f, riskType }))}
                    options={[
                      { value: "dollar", label: currencySymbol() },
                      { value: "percent", label: "%" },
                    ]}
                  />
                </div>
              </Field>
              <Field label={t("trade.rrMultiple")} error={rMultipleError}>
                {pnlLocked ? (
                  <Input
                    aria-label={t("trade.rrMultiple")}
                    className="tv-trade-number tv-figure"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={rDraft ?? (riskDollar > 0 ? derivedR.toFixed(2) : "")}
                    onChange={(e) => editBrokerR(e.target.value)}
                    onBlur={() => setRDraft(null)}
                    disabled={!(riskDollar > 0)}
                    placeholder="—"
                  />
                ) : (
                  <Input
                    aria-label={t("trade.rrMultiple")}
                    className="tv-trade-number tv-figure"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={form.rMultiple}
                    onChange={(e) => setForm((f) => ({ ...f, rMultiple: e.target.value }))}
                    disabled={form.direction === "be"}
                    placeholder="2.0"
                  />
                )}
              </Field>
            </div>
            {pnlLocked && (
              <Field label={t("trade.brokerPnl")}>
                <Input
                  aria-label={t("trade.brokerPnl")}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={form.brokerPnl}
                  onChange={(e) => {
                    setRDraft(null);
                    setForm((f) => ({ ...f, brokerPnl: e.target.value }));
                  }}
                  className={cn(
                    "tv-figure",
                    calculatedPnl > 0
                      ? "text-emerald-400"
                      : calculatedPnl < 0
                        ? "text-red-400"
                        : "text-slate-300",
                  )}
                />
              </Field>
            )}
            {form.riskType === "percent" && (
              <Field label={t("trade.accountBalance")}>
                <Input
                  aria-label={t("trade.accountBalance")}
                  type="number"
                  value={accountBalance}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setAccountBalance(value);
                    saveAccountBalance(userId, value);
                  }}
                />
                <p className="tv-prose text-slate-500">
                  {formatMoney(riskDollar)} {t("dashboard.riskSuffix")}
                </p>
              </Field>
            )}
            <Disclosure
              title={`${t("trade.timing")} · ${form.entryTime || "—"} → ${form.exitTime || "—"}`}
              open={timingOpen}
              onChange={setTimingOpen}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("trade.entryTime")}>
                  <TimeField
                    value={form.entryTime}
                    onChange={(entryTime) => setForm((f) => ({ ...f, entryTime }))}
                    locale={intlLocale(lang)}
                    aria-label={t("trade.entryTime")}
                    doneLabel={t("common.done")}
                  />
                </Field>
                <Field label={t("trade.exitTime")} error={timeError}>
                  <TimeField
                    value={form.exitTime}
                    onChange={(exitTime) => setForm((f) => ({ ...f, exitTime }))}
                    locale={intlLocale(lang)}
                    aria-label={t("trade.exitTime")}
                    doneLabel={t("common.done")}
                  />
                </Field>
              </div>
              <SelectPicker
                label={t("trade.timePresets")}
                value={`${form.entryTime}|${form.exitTime}`}
                renderTrigger={({ open, toggle, controls }) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={controls}
                  >
                    {t("trade.timePresets")} <ChevronDown className="h-3 w-3" />
                  </Button>
                )}
                onChange={(value) => {
                  const [entryTime, exitTime] = value.split("|");
                  setForm((f) => ({ ...f, entryTime, exitTime }));
                }}
                options={[
                  ["09:30", "10:15"],
                  ["10:00", "11:00"],
                  ["15:30", "16:00"],
                  ["16:00", "17:00"],
                ].map(([a, b]) => ({ value: `${a}|${b}`, label: `${a} → ${b}` }))}
              />
            </Disclosure>
          </div>
          <Disclosure
            title={t("trade.detailsNotes")}
            open={detailsOpen}
            onChange={setDetailsOpen}
            className="mt-3"
          >
            <Field label={t("trade.notes")}>
              <Textarea
                aria-label={t("trade.notes")}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("trade.notesPlaceholder")}
                rows={3}
              />
            </Field>
            <Field label={t("trade.strategy")}>
              <SelectPicker
                variant="field"
                label={t("trade.strategy")}
                value={form.strategy}
                onChange={(strategy) => setForm((f) => ({ ...f, strategy }))}
                searchLabel={t("picker.search")}
                options={Array.from(new Set([...STRATEGIES, form.strategy]))
                  .filter(Boolean)
                  .map((value) => ({ value, label: value }))}
              />
            </Field>
            {trade?.broker && (
              <div className="tv-trade-inset space-y-3">
                <div>
                  <p className="tv-label text-slate-400">
                    {t("trade.importedFrom").replace("{broker}", "Tradovate")}
                  </p>
                  {trade.brokerAccount && (
                    <p className="tv-prose mt-1 text-slate-500">{trade.brokerAccount}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["quantity", "trade.execContracts", "1"],
                      ["entryPrice", "trade.execEntry", "0.25"],
                      ["exitPrice", "trade.execExit", "0.25"],
                      ["fees", "trade.execFees", "0.01"],
                    ] as const
                  ).map(([key, label, step]) => (
                    <Field key={key} label={t(label)}>
                      <Input
                        aria-label={t(label)}
                        type="number"
                        step={step}
                        inputMode="decimal"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder="—"
                      />
                    </Field>
                  ))}
                </div>
                {trade.reviewPending && (
                  <p className="tv-prose text-slate-500">
                    {riskDollar > 0 ? t("trade.reviewHint") : t("trade.reviewHintRisk")}
                  </p>
                )}
              </div>
            )}
            <Disclosure title={t("trade.positionCalc")} open={showCalc} onChange={setShowCalc}>
              <SelectPicker
                inline
                label={t("trade.pointValue")}
                value={pointValue}
                onChange={setPointValue}
                options={POINT_VALUES.map((p) => ({
                  value: String(p.value),
                  label: `${p.label} ${p.value}`,
                }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("trade.stopPoints")}>
                  <Input
                    aria-label={t("trade.stopPoints")}
                    type="number"
                    step="0.25"
                    min="0"
                    value={stopPoints}
                    onChange={(e) => setStopPoints(e.target.value)}
                  />
                </Field>
                <Field label={t("trade.pointValue")}>
                  <Input
                    aria-label={t("trade.pointValue")}
                    type="number"
                    step="0.5"
                    min="0"
                    value={pointValue}
                    onChange={(e) => setPointValue(e.target.value)}
                  />
                </Field>
              </div>
              <p className="tv-prose text-slate-400">
                {calcContracts
                  ? `${calcContracts.contracts} ${t("trade.contracts")} · ${t("trade.effectiveRisk")}: ${formatMoney(calcContracts.effectiveRisk)}`
                  : t("trade.calcHint")}
              </p>
            </Disclosure>
            <Disclosure title={t("trade.advanced")} open={showAdvanced} onChange={setShowAdvanced}>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["mae", `MAE (${currencySymbol()})`],
                    ["mfe", `MFE (${currencySymbol()})`],
                    ["slippage", `${t("trade.slippage")} (${currencySymbol()})`],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Input
                      aria-label={label}
                      type="number"
                      step="0.01"
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder="—"
                    />
                    {key !== "slippage" && (
                      <p className="tv-prose text-slate-500">
                        {t(key === "mae" ? "trade.maeHint" : "trade.mfeHint")}
                      </p>
                    )}
                  </Field>
                ))}
              </div>
            </Disclosure>
            <div className="space-y-3">
              <Field label={t("trade.setupQuality")}>
                <ChoiceGroup
                  label={t("trade.setupQuality")}
                  value={form.setupQuality}
                  options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                  onChange={(setupQuality) => setForm((f) => ({ ...f, setupQuality }))}
                />
                <p className="tv-prose text-slate-500">
                  {t(`trade.quality${form.setupQuality}` as never)}
                </p>
              </Field>
              <Field label={t("trade.confidence")}>
                <div className="tv-trade-inset flex min-h-11 items-center gap-4">
                  <input
                    aria-label={t("trade.confidence")}
                    type="range"
                    min="1"
                    max="100"
                    value={form.confidence}
                    onChange={(e) => setForm((f) => ({ ...f, confidence: Number(e.target.value) }))}
                    className="min-w-0 flex-1"
                  />
                  <span className="tv-figure w-12 shrink-0 text-right text-sm text-white">
                    {form.confidence}%
                  </span>
                </div>
              </Field>
              <Disclosure title={t("trade.intent")} open={showIntent} onChange={setShowIntent}>
                <Field label={t("trade.intentEmotion")}>
                  <div className={CHIP_ROW}>
                    {EMOTIONAL_STATES.map((value) => (
                      <Chip
                        key={value}
                        selected={form.intentEmotion === value}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            intentEmotion: f.intentEmotion === value ? null : value,
                          }))
                        }
                      >
                        {t(EMOTION_LABELS[value] as never)}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label={t("trade.intentReasoning")}>
                  <Textarea
                    aria-label={t("trade.intentReasoning")}
                    value={form.intentReasoning}
                    onChange={(e) => setForm((f) => ({ ...f, intentReasoning: e.target.value }))}
                    placeholder={t("trade.intentReasoningPh")}
                    rows={2}
                  />
                </Field>
                <Field label={t("trade.intentPlan")}>
                  <Textarea
                    aria-label={t("trade.intentPlan")}
                    value={form.intentPlan}
                    onChange={(e) => setForm((f) => ({ ...f, intentPlan: e.target.value }))}
                    placeholder={t("trade.intentPlanPh")}
                    rows={2}
                  />
                </Field>
              </Disclosure>
              <Field label={t("trade.confluences")}>
                <div className={CHIP_ROW}>
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
                  <Input
                    aria-label={t("trade.confluences")}
                    value={newConfluence}
                    onChange={(e) => setNewConfluence(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addConfluence();
                      }
                    }}
                    placeholder={t("trade.addConfluencePlaceholder")}
                  />
                  <Button
                    type="button"
                    variant="subtle"
                    onClick={addConfluence}
                    aria-label={t("common.add")}
                    className="h-11 w-11 shrink-0 px-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>
            <div className="space-y-3 border-t border-[var(--tv-border)] pt-3">
              <Field label={t("trade.mistakes")}>
                <div className={CHIP_ROW}>
                  {(showAllMistakes ? MISTAKE_OPTIONS : MISTAKE_OPTIONS.slice(0, 5)).map((m) => (
                    <Chip
                      key={m}
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
                  <Button variant="ghost" size="sm" onClick={() => setShowAllMistakes((v) => !v)}>
                    {showAllMistakes ? t("common.showLess") : t("common.showMore")}
                  </Button>
                </div>
              </Field>
              <Disclosure
                title={t("trade.reflection")}
                open={showReflection}
                onChange={setShowReflection}
              >
                <Field label={t("trade.reflectionPlanRespected")}>
                  <ChoiceGroup
                    label={t("trade.reflectionPlanRespected")}
                    value={form.reflectionPlan}
                    options={[
                      { value: "yes", label: t("trade.reflectionYes") },
                      { value: "partial", label: t("trade.reflectionPartial") },
                      { value: "no", label: t("trade.reflectionNo") },
                    ]}
                    onChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        reflectionPlan: f.reflectionPlan === value ? null : value,
                      }))
                    }
                  />
                </Field>
                <Field label={t("trade.reflectionReason")}>
                  <div className={CHIP_ROW}>
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
                </Field>
                <Field label={t("trade.reflectionNote")}>
                  <Textarea
                    aria-label={t("trade.reflectionNote")}
                    value={form.reflectionNote}
                    onChange={(e) => setForm((f) => ({ ...f, reflectionNote: e.target.value }))}
                    placeholder={t("trade.reflectionNotePh")}
                    rows={2}
                  />
                </Field>
              </Disclosure>
              {/* Screenshots */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass + " mb-0"}>{t("trade.screenshots")}</label>
                  <span className="text-xs text-slate-600 flex items-center gap-1">
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
                      <span className="absolute top-1 left-1 grid h-5 w-5 place-items-center rounded-md bg-black/70 text-xs font-bold text-white">
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
                        className="absolute top-1 right-1 w-6 h-6 bg-[var(--tv-plate-3)] rounded-full flex items-center justify-center opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {form.screenshots.length < 3 && (
                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--tv-border-accent)] hover:bg-cyan-500/[0.03] transition">
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5 text-slate-600" />
                          <span className="text-xs text-slate-600 mt-1">{t("trade.upload")}</span>
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
            </div>
          </Disclosure>
        </form>
        <footer className="shrink-0 border-t border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-4 py-2.5">
          {(timeError || rMultipleError) && (
            <p role="alert" className="tv-prose mb-2 text-red-400">
              {timeError || rMultipleError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <span className="tv-label block truncate text-slate-500">
                {pnlLocked ? t("trade.brokerPnl") : t("trade.estPnl")}
              </span>
              <span
                className={cn(
                  "tv-figure block truncate text-xl",
                  calculatedPnl > 0
                    ? "text-emerald-400"
                    : calculatedPnl < 0
                      ? "text-red-400"
                      : "text-slate-400",
                )}
              >
                {formatMoney(calculatedPnl, { signed: true })}
              </span>
            </div>
            <Button
              variant="entry"
              type="submit"
              form="trade-entry-form"
              disabled={!isValid}
              className="h-11"
            >
              {trade ? t("trade.updateTrade") : t("trade.saveTrade")}
            </Button>
          </div>
        </footer>
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
