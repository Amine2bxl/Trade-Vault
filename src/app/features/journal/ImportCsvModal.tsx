import { useMemo, useRef, useState } from "react";
import { X, Upload, FileSpreadsheet, Check, Loader2, AlertCircle } from "@/shared/ui/icons";
import { Trade } from "@/app/types";
import { formatPnl } from "@/domain/tradeCalcs";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { Button, Modal, SelectPicker } from "@/shared/ui";
import {
  analyzeTradingViewOrders, decodeImportBuffer, isTradingViewOrders,
  parseCsvWithRescue, suggestedPointValue,
} from "./importRescue";
import {
  FIELDS,
  REQUIRED,
  detectFormat,
  guessMapping,
  mapRowsToTrades,
  rejectFile,
  splitDuplicates,
  type Field,
  type FileRejection,
} from "./csvImport";

interface ImportCsvModalProps {
  existing: Trade[];
  onClose: () => void;
  /** Rend le nombre de trades réellement écrits et le nombre d'échecs. */
  onImport: (
    trades: Trade[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ saved: number; failed: number }>;
}

/** Chaque refus a son message : « il ne s'est rien passé » n'est pas une
 *  réponse acceptable quand l'utilisateur vient de choisir un fichier. */
const ERROR_KEY = {
  tooLarge: "import.errTooLarge",
  notCsv: "import.errNotCsv",
  empty: "import.errEmpty",
  noHeaders: "import.errNoHeaders",
  unreadable: "import.errUnreadable",
} as const;

export default function ImportCsvModal({ existing, onClose, onImport }: ImportCsvModalProps) {
  const { t, lang } = useT();
  const tr = (fr: string, en: string) => lang === "fr" ? fr : en;
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{
    headers: string[];
    rows: string[][];
    format: string | null;
  } | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<Field, number>>>({});
  const [sourceMode, setSourceMode] = useState<"journal" | "orders" | "manual">("journal");
  const [recovery, setRecovery] = useState<{ warnings: string[]; discarded: number; fragments: string[] } | null>(null);
  const [fragmentIndex, setFragmentIndex] = useState(0);
  const [pointValues, setPointValues] = useState<Record<string, string>>({});
  const [anchorDecision, setAnchorDecision] = useState<Record<string, "exclude" | "keep">>({});
  const [confirmedData, setConfirmedData] = useState(false);
  const [manualTrades, setManualTrades] = useState<Trade[]>([]);
  const [repairedRows, setRepairedRows] = useState<Record<number, Trade>>({});
  const [repairIndex, setRepairIndex] = useState<number | null>(null);
  const [manualForm, setManualForm] = useState({ date: "", symbol: "", pnl: "", direction: "long" });
  const [manualError, setManualError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<FileRejection | "unreadable" | null>(null);
  /** Étape de confirmation : ce qui SERA écrit, avant d'écrire quoi que ce soit. */
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    duplicates: number;
    invalid: number;
    failed: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const importing = progress !== null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Contrôle AVANT lecture : sans lui, choisir un PDF ou un fichier vide ne
    // produisait rien du tout à l'écran et l'application semblait figée.
    const rejection = rejectFile(file);
    if (rejection) {
      setError(rejection);
      return;
    }
    setReading(true);
    try {
      const decoded = decodeImportBuffer(await file.arrayBuffer());
      const recovered = parseCsvWithRescue(decoded.text);
      const { headers, rows } = recovered;
      const warnings = [...(decoded.warning ? [decoded.warning] : []), ...recovered.warnings];
      setRecovery({ warnings, discarded: recovered.discarded, fragments: recovered.fragments });
      setFragmentIndex(0);
      setManualTrades([]);
      setRepairedRows({});
      setRepairIndex(null);
      setShowManual(false);
      setAnchorDecision({});
      setConfirmedData(false);
      if (headers.length === 0 || rows.length === 0) {
        // Même si le fichier est irrécupérable, le parcours de saisie reste ouvert.
        setParsed({ headers: ["Date", "Symbol", "P&L", "Direction"], rows: [], format: "Manual" });
        setMapping({ date: 0, symbol: 1, pnl: 2, direction: 3 });
        setSourceMode("manual");
        setRecovery({ warnings: [...warnings, tr(
          "Le fichier ne contient aucune ligne exploitable. Tu peux encoder tes trades ici.",
          "No usable rows found. You can enter your trades here.",
        )], discarded: recovered.discarded, fragments: recovered.fragments });
      } else {
        const orders = isTradingViewOrders(headers);
        setParsed({ headers, rows, format: orders ? "TradingView Paper Trading" : detectFormat(headers) });
        setMapping(guessMapping(headers));
        setSourceMode(orders ? "orders" : "journal");
        if (orders) {
          const symIndex = headers.findIndex((h) => h.trim().toLowerCase() === "symbol");
          const values: Record<string, string> = {};
          for (const row of rows) {
            const symbol = (row[symIndex] || "").trim().toUpperCase();
            if (symbol && values[symbol] === undefined) {
              values[symbol] = String(suggestedPointValue(symbol) ?? "");
            }
          }
          setPointValues(values);
        }
      }
      setResult(null);
      setConfirming(false);
    } catch (e) {
      console.error("Could not read the CSV file", e);
      setError("unreadable");
      setParsed({ headers: ["Date", "Symbol", "P&L", "Direction"], rows: [], format: "Manual" });
      setMapping({ date: 0, symbol: 1, pnl: 2, direction: 3 });
      setSourceMode("manual");
      setRecovery({ warnings: [tr(
        "Le fichier est illisible. Saisie manuelle disponible ci-dessous.",
        "The file is unreadable. Manual entry is available below.",
      )], discarded: 0, fragments: [] });
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setMapping({});
    setError(null);
    setConfirming(false);
    setSourceMode("journal");
    setRecovery(null);
    setFragmentIndex(0);
    setRepairedRows({});
    setManualTrades([]);
    setAnchorDecision({});
    setPointValues({});
    setConfirmedData(false);
    setRepairIndex(null);
    setShowManual(false);
  };

  const orderAnalysis = useMemo(() => {
    if (!parsed || sourceMode !== "orders") return null;
    const values: Record<string, number> = {};
    for (const [symbol, value] of Object.entries(pointValues)) {
      if (value.trim() && Number.isFinite(Number(value)) && Number(value) > 0) values[symbol] = Number(value);
    }
    return analyzeTradingViewOrders(parsed.headers, parsed.rows, values,
      Object.entries(anchorDecision).filter(([, decision]) => decision === "exclude").map(([symbol]) => symbol));
  }, [parsed, sourceMode, pointValues, anchorDecision]);

  const problems = useMemo(() => {
    if (!parsed || sourceMode !== "journal") return [] as number[];
    return parsed.rows.map((row, index) => mapRowsToTrades([row], mapping).valid.length ? -1 : index)
      .filter((index) => index >= 0 && repairedRows[index] === undefined);
  }, [parsed, sourceMode, mapping, repairedRows]);

  const mappedTrades = useMemo(() => {
    const base = parsed && sourceMode === "journal"
      ? mapRowsToTrades(parsed.rows, mapping)
      : { valid: [] as Trade[], invalid: 0 };
    return {
      valid: [...(sourceMode === "orders" ? (orderAnalysis?.trades ?? []) : base.valid),
        ...Object.values(repairedRows), ...manualTrades],
      invalid: sourceMode === "journal" ? Math.max(0, base.invalid - Object.keys(repairedRows).length) : 0,
    };
  }, [parsed, sourceMode, mapping, orderAnalysis, repairedRows, manualTrades]);

  const startManual = (rowIndex: number | null) => {
    setShowManual(true);
    setManualError("");
    setRepairIndex(rowIndex);
    const row = rowIndex === null ? null : parsed?.rows[rowIndex];
    const get = (f: Field) => row?.[mapping[f] ?? -1] ?? "";
    setManualForm({
      date: get("date").slice(0, 10), symbol: get("symbol"), pnl: get("pnl"),
      direction: /short|sell/i.test(get("direction")) ? "short" : "long",
    });
  };
  const saveManual = () => {
    const { date, symbol, pnl, direction } = manualForm;
    const fixed = mapRowsToTrades([[date, symbol, pnl, direction]], {
      date: 0, symbol: 1, pnl: 2, direction: 3,
    }).valid[0];
    if (!fixed || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(new Date(date + "T00:00:00").getTime())) {
      setManualError(tr("Vérifie la date, le symbole et le P&L.", "Check the date, symbol, and P&L."));
      return;
    }
    fixed.reviewPending = true;
    fixed.notes = repairIndex === null
      ? "Trade saisi manuellement pendant l'import."
      : "Ligne " + (repairIndex + 2) + " corrigée manuellement pendant l'import ; vérifier la source.";
    if (repairIndex === null) setManualTrades((prev) => [...prev, fixed]);
    else setRepairedRows((prev) => ({ ...prev, [repairIndex]: fixed }));
    setManualError("");
    setRepairIndex(null);
    if (sourceMode !== "manual") setShowManual(false);
    setManualForm({ date: "", symbol: "", pnl: "", direction: "long" });
  };

  /** Ce que l'import fera exactement — calculé AVANT toute écriture, pour que
   *  la confirmation porte sur des chiffres et pas sur une promesse. */
  const plan = useMemo(
    () => splitDuplicates(mappedTrades.valid, existing),
    [mappedTrades.valid, existing],
  );

  const doImport = async () => {
    if (plan.fresh.length === 0) return;
    setConfirming(false);
    setProgress({ done: 0, total: plan.fresh.length });
    try {
      const { saved, failed } = await onImport(plan.fresh, (done, total) =>
        setProgress({ done, total }),
      );
      setResult({
        imported: saved,
        duplicates: plan.duplicates,
        invalid: mappedTrades.invalid + (recovery?.discarded ?? 0),
        failed,
      });
    } catch (e) {
      console.error("Import failed", e);
      setResult({
        imported: 0,
        duplicates: plan.duplicates,
        invalid: mappedTrades.invalid + (recovery?.discarded ?? 0),
        failed: plan.fresh.length,
      });
    } finally {
      setProgress(null);
    }
  };

  const anchorsReviewed = orderAnalysis?.anchors.every((candidate) => Boolean(anchorDecision[candidate.symbol])) ?? true;
  const canImport = mappedTrades.valid.length > 0 &&
    (sourceMode !== "journal" || REQUIRED.every((f) => mapping[f] !== undefined) || manualTrades.length > 0) &&
    (sourceMode !== "orders" || (
      (orderAnalysis?.missingMultipliers.length ?? 0) === 0 && anchorsReviewed && confirmedData
    ));
  const selectClass =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40 cursor-pointer";

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-2xl max-h-[96vh] md:max-h-[90vh] overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h2 className="tv-title flex items-center gap-2">
          <Upload className="w-4 h-4 text-cyan-400" />
          {t("import.title")}
        </h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(90vh-70px)] px-6 py-5 space-y-4">
        {importing ? (
          /* Progression réelle : le compteur vient des lots effectivement
             écrits, pas d'une animation décorative. */
          <div className="py-10 text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
            <div className="text-sm font-semibold text-white mb-3">
              {t("import.importing")
                .replace("{done}", String(progress.done))
                .replace("{total}", String(progress.total))}
            </div>
            <div className="h-1.5 w-full max-w-xs mx-auto rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--tv-accent)] transition-[width] duration-300"
                style={{
                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="tv-row-label mt-3">{t("import.dontClose")}</p>
          </div>
        ) : result ? (
          <div className="text-center py-8">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4",
                result.imported > 0 ? "bg-emerald-500/10" : "bg-red-500/10",
              )}
            >
              {result.imported > 0 ? (
                <Check className="w-7 h-7 text-emerald-400" />
              ) : (
                <AlertCircle className="w-7 h-7 text-red-400" />
              )}
            </div>
            <div className="tv-num text-sm font-bold text-white mb-1">
              {result.imported} {t("import.imported")}
            </div>
            <div className="text-xs text-slate-500">
              {result.duplicates > 0 && (
                <span className="tv-num">
                  {result.duplicates} {t("import.duplicatesSkipped")} ·{" "}
                </span>
              )}
              {result.invalid > 0 && (
                <span className="tv-num">
                  {result.invalid} {t("import.invalidSkipped")}
                </span>
              )}
            </div>
            {/* Un échec silencieux ferait croire que tout est passé. */}
            {result.failed > 0 && (
              <p className="mt-3 tv-prose text-red-400">
                {t("import.failedRows").replace("{n}", String(result.failed))}
              </p>
            )}
            <Button onClick={onClose} className="mt-6">
              {t("common.close")}
            </Button>
          </div>
        ) : !parsed ? (
          <>
            {/* Message d'erreur explicite : avant, un fichier refusé ne
                déclenchait strictement rien. */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/[0.07] border border-red-500/20 px-3.5 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="tv-prose text-red-300">{t(ERROR_KEY[error])}</p>
              </div>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition",
                dragOver
                  ? "border-cyan-500/50 bg-cyan-500/[0.05]"
                  : "border-white/[0.08] hover:border-cyan-500/30 hover:bg-cyan-500/[0.02]",
              )}
            >
              {reading ? (
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
              ) : (
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              )}
              <div className="text-sm font-semibold text-white mb-1">
                {reading ? t("import.analyzing") : t("import.dropHint")}
              </div>
              <div className="text-[11px] text-slate-500">
                NinjaTrader · TradingView · TopStep · TradeVault · CSV
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />
            </div>
            <button type="button" onClick={() => {
              setParsed({ headers: ["Date", "Symbol", "P&L", "Direction"], rows: [], format: "Manual" });
              setSourceMode("manual");
              setMapping({ date: 0, symbol: 1, pnl: 2, direction: 3 });
              setRecovery(null);
              setManualTrades([]);
              setShowManual(true);
            }} className="w-full text-sm rounded-xl border border-white/10 p-3 text-slate-300 hover:bg-white/[0.05]">
              {tr("Je n'ai pas de CSV exploitable — encoder mes trades avec de l'aide",
                "I don't have a usable CSV — guide me through entering my trades")}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="tv-num text-xs text-slate-400">
                {parsed.rows.length} {t("import.rowsDetected")}
                {parsed.format && (
                  <span className="ml-2 px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">
                    {parsed.format}
                  </span>
                )}
              </div>
              <button
                onClick={reset}
                className="text-[11px] text-slate-500 hover:text-white transition-colors"
              >
                {t("import.otherFile")}
              </button>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">
                {sourceMode === "orders" ? tr("Étape 1 — Reconstruction des exécutions", "Step 1 — Reconstruct fills")
                : sourceMode === "manual" ? tr("Saisie accompagnée — un trade à la fois", "Guided entry — one trade at a time")
                : tr("Étape 1 — Vérification des colonnes", "Step 1 — Verify columns")}
              </p>
              {recovery?.warnings.map((warning, i) => <p key={i} className="text-amber-300">{warning}</p>)}
              {sourceMode === "orders" && <p>{tr(
                "Les ordres annulés/rejetés ne créent jamais de trade. Seules les positions clôturées et vérifiables sont proposées.",
                "Cancelled/rejected orders never create trades. Only verifiable closed positions are proposed.",
              )}</p>}
              {sourceMode === "journal" && <p>{tr(
                "TradeVault importe ce qui est certain et t'aide à corriger le reste avant confirmation.",
                "TradeVault imports reliable rows and helps you repair the rest before confirmation.",
              )}</p>}
            </div>

            {recovery && recovery.fragments.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-300">
                  {tr("Données abîmées à examiner", "Damaged data to review")} ·
                  {" "}{fragmentIndex + 1}/{recovery.fragments.length}
                </p>
                <p className="text-[11px] text-slate-400">{tr(
                  "Le contenu brut n'a pas été supprimé. S'il contient un trade, utilise la saisie guidée ; TradeVault ne complète jamais les valeurs illisibles à ta place.",
                  "The raw content was kept. If it contains a trade, use guided entry; TradeVault never invents unreadable values.",
                )}</p>
                <pre className="text-[11px] text-slate-200 whitespace-pre-wrap break-all p-2 rounded-lg bg-white/[0.04] max-h-24 overflow-y-auto">
                  {recovery.fragments[fragmentIndex]?.slice(0, 800)}
                </pre>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setFragmentIndex((i) => Math.max(0, i - 1))}
                    disabled={fragmentIndex === 0}
                    className="text-xs rounded-lg border border-white/10 px-2 py-1 text-slate-300 disabled:opacity-40">
                    {tr("Précédent", "Previous")}
                  </button>
                  <button type="button" onClick={() => setFragmentIndex((i) => Math.min(recovery.fragments.length - 1, i + 1))}
                    disabled={fragmentIndex === recovery.fragments.length - 1}
                    className="text-xs rounded-lg border border-white/10 px-2 py-1 text-slate-300 disabled:opacity-40">
                    {tr("Suivant", "Next")}
                  </button>
                  {sourceMode !== "orders" && (
                    <button type="button" onClick={() => {
                      startManual(null);
                      const candidate = recovery.fragments[fragmentIndex].match(/\b\d{4}-\d{2}-\d{2}\b/);
                      if (candidate) setManualForm((v) => ({ ...v, date: candidate[0] }));
                    }} className="ml-auto text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-300">
                      {tr("Saisir ce trade", "Enter this trade")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Column mapping — uniquement pour les exports de TRADES, pas les ordres. */}
            {sourceMode === "journal" && (
            <div>
              <div className="tv-label text-slate-400 mb-2">{t("import.mapColumns")}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {FIELDS.map((f) => (
                  <div key={f}>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      {f === "date"
                        ? t("trade.date")
                        : f === "symbol"
                          ? t("trade.symbol")
                          : f === "pnl"
                            ? t("journal.colPnl")
                            : f === "direction"
                              ? t("trade.direction")
                              : f === "entryTime"
                                ? t("trade.entryTime")
                                : f === "exitTime"
                                  ? t("trade.exitTime")
                                  : f === "risk"
                                    ? t("trade.riskAmount")
                                    : f === "rMultiple"
                                      ? t("trade.rrMultiple")
                                      : f === "strategy"
                                        ? t("trade.strategy")
                                        : f === "slippage"
                                          ? t("trade.slippage")
                                          : t("trade.notes")}
                      {REQUIRED.includes(f) && <span className="text-red-400"> *</span>}
                    </label>
                    <SelectPicker
                      variant="field"
                      label={f}
                      value={mapping[f] === undefined ? "" : String(mapping[f])}
                      onChange={(v) =>
                        setMapping((m) => ({
                          ...m,
                          [f]: v === "" ? undefined : Number(v),
                        }))
                      }
                      className={selectClass}
                      searchLabel={t("picker.search")}
                      options={[
                        { value: "", label: "—" },
                        ...parsed.headers.map((h, i) => ({
                          value: String(i),
                          label: h || `(col ${i + 1})`,
                        })),
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
            )}

            {sourceMode === "orders" && orderAnalysis && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  <span className="text-white font-semibold">{orderAnalysis.filled}</span> {tr("exécutions Filled",
                    "filled orders")} · <span className="text-white font-semibold">{orderAnalysis.trades.length}</span> {tr(
                    "trades clôturés calculés", "closed trades reconstructed")} · {orderAnalysis.skipped} {tr(
                      "ordres/lignes ignorés", "orders/rows ignored")}
                </div>
                <div className="rounded-xl border border-white/[0.08] p-3 space-y-3">
                  <p className="text-xs font-semibold text-white">{tr(
                    "Étape 2 — Vérifier la valeur monétaire du point", "Step 2 — Verify each instrument's point value")}</p>
                  <p className="text-[11px] text-slate-400">{tr(
                    "Le P&L = variation de prix × quantité × valeur du point. Les valeurs Futures suggérées doivent être vérifiées ; les CFD et autres instruments ne sont jamais devinés.",
                    "P&L = price change × quantity × point value. Suggested futures values require verification; CFD and other instruments are never guessed.",
                  )}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(pointValues).map((symbol) => (
                      <label key={symbol} className="text-xs text-slate-300 space-y-1">
                        <span className="block truncate" title={symbol}>{symbol}</span>
                        <input type="number" min="0.0000001" step="any" inputMode="decimal"
                          value={pointValues[symbol]} onChange={(e) => { setPointValues((v) => ({
                            ...v, [symbol]: e.target.value,
                          })); setConfirmedData(false); }}
                          placeholder={tr("Valeur du point en devise du compte", "Point value in account currency")}
                          className="w-full bg-white/[0.04] border border-white/[0.12] rounded-lg p-2 text-white" />
                      </label>
                    ))}
                  </div>
                  {orderAnalysis.missingMultipliers.length > 0 && <p className="text-amber-300 text-xs">
                    {tr("À compléter pour calculer : ", "Point value needed for: ")}
                    {orderAnalysis.missingMultipliers.join(", ")}
                  </p>}
                </div>
                {orderAnalysis.anchors.map((anchor) => (
                  <div key={anchor.symbol} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
                    <p className="text-xs font-semibold text-white">{tr("Historique possiblement incomplet : ",
                      "Possibly incomplete history: ")}{anchor.symbol}</p>
                    <p className="text-[11px] text-slate-300">{tr(
                      "Les premières exécutions pourraient clôturer une position antérieure absente du CSV. Confirme ce qu'il faut en faire ; aucune opération n'est masquée automatiquement.",
                      "The first fills may close a position opened before this export. Choose explicitly; nothing is hidden automatically.",
                    )} ({anchor.initialExecutions} {tr("exécution(s)", "fill(s)")})</p>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => { setAnchorDecision((v) => ({ ...v, [anchor.symbol]: "exclude" })); setConfirmedData(false); }}
                        className={cn("rounded-lg border p-2 text-xs", anchorDecision[anchor.symbol] === "exclude"
                          ? "border-cyan-500 text-cyan-300" : "border-white/10 text-slate-300")}>
                        {tr("Exclure les exécutions antérieures non appariables", "Exclude unmatched historic fills")}
                      </button>
                      <button type="button" onClick={() => { setAnchorDecision((v) => ({ ...v, [anchor.symbol]: "keep" })); setConfirmedData(false); }}
                        className={cn("rounded-lg border p-2 text-xs", anchorDecision[anchor.symbol] === "keep"
                          ? "border-cyan-500 text-cyan-300" : "border-white/10 text-slate-300")}>
                        {tr("Conserver l'historique tel quel", "Keep the history as-is")}
                      </button>
                    </div>
                  </div>
                ))}
                {orderAnalysis.warnings.length > 0 && (
                  <div className="space-y-1 text-[11px] text-amber-300" role="status">
                    {orderAnalysis.warnings.map((warning, i) => <p key={i}>{warning}</p>)}
                  </div>
                )}
                <label className="flex gap-2 text-xs items-start text-slate-300 border border-white/[0.08] rounded-xl p-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={confirmedData}
                    onChange={(e) => setConfirmedData(e.target.checked)} />
                  <span>{tr(
                    "J'ai vérifié les multiplicateurs et compris que le P&L calculé est estimé (brut si frais manquants), que des exécutions peuvent rester non appariées et que les horaires suivent le fuseau exporté.",
                    "I checked point values and understand that computed P&L is an estimate (gross when fees are missing), some fills may remain unmatched, and times follow the source timezone.",
                  )}</span>
                </label>
              </div>
            )}

            {(sourceMode === "manual" || sourceMode === "journal") && (
              <div className="rounded-xl border border-white/[0.08] p-3 space-y-3">
                {sourceMode === "journal" && problems.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-amber-300">{tr("Étape 2 — ", "Step 2 — ")}{problems.length} {tr(
                      "ligne(s) à compléter, sans les perdre.", "row(s) need your help, not discarded.")}</p>
                    {!showManual && <button type="button" onClick={() => startManual(problems[0])}
                      className="text-xs rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-300">
                      {tr("Corriger ensemble", "Guide me through repairs")}
                    </button>}
                  </div>
                )}
                {sourceMode === "manual" && <p className="text-xs text-slate-300">{tr(
                  "Remplis les trois champs indispensables pour chaque trade. Ajoute-en autant que nécessaire, puis vérifie le récapitulatif.",
                  "Fill in the three required fields for each trade. Add as many as needed, then review the summary.",
                )}</p>}
                {(sourceMode === "manual" || showManual) && (
                  <div className="space-y-3">
                    {repairIndex !== null && <div className="text-xs text-slate-400">
                      {tr("Ligne du fichier", "File row")} {repairIndex + 2} · {parsed.rows[repairIndex]?.slice(0, 6).join(" | ")}
                    </div>}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-slate-400">{tr("Date", "Date")}
                        <input type="date" value={manualForm.date} onChange={(e) => setManualForm((v) => ({ ...v, date: e.target.value }))}
                          className="block w-full mt-1 rounded-lg bg-white/[0.04] border border-white/10 p-2 text-white" />
                      </label>
                      <label className="text-[11px] text-slate-400">{tr("Symbole", "Symbol")}
                        <input value={manualForm.symbol} onChange={(e) => setManualForm((v) => ({ ...v, symbol: e.target.value }))}
                          placeholder="NQ / ES / EURUSD"
                          className="block w-full mt-1 rounded-lg bg-white/[0.04] border border-white/10 p-2 text-white" />
                      </label>
                      <label className="text-[11px] text-slate-400">{tr("P&L réalisé", "Realized P&L")}
                        <input value={manualForm.pnl} onChange={(e) => setManualForm((v) => ({ ...v, pnl: e.target.value }))}
                          placeholder="-125.50"
                          className="block w-full mt-1 rounded-lg bg-white/[0.04] border border-white/10 p-2 text-white" />
                      </label>
                      <label className="text-[11px] text-slate-400">{tr("Sens", "Direction")}
                        <select value={manualForm.direction} onChange={(e) => setManualForm((v) => ({ ...v, direction: e.target.value }))}
                          className="block w-full mt-1 rounded-lg bg-slate-900 border border-white/10 p-2 text-white">
                          <option value="long">Long</option><option value="short">Short</option>
                        </select>
                      </label>
                    </div>
                    {manualError && <p className="text-xs text-red-400" role="alert">{manualError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveManual}
                        className="rounded-lg bg-cyan-500 text-slate-950 font-semibold px-3 py-2 text-xs">
                        {tr("Enregistrer cette ligne", "Save this trade")}
                      </button>
                      {sourceMode === "journal" && <button type="button" onClick={() => { setShowManual(false); setRepairIndex(null); }}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">
                        {tr("Passer cette ligne", "Skip this row")}
                      </button>}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => startManual(null)}
                  className="text-xs text-cyan-300 hover:text-cyan-200">
                  {tr("+ Ajouter un trade manuellement", "+ Add a trade manually")}
                </button>
                {manualTrades.length > 0 && <p className="text-xs text-slate-400">{manualTrades.length} {tr(
                  "trade(s) ajoutés manuellement", "trade(s) entered manually")}</p>}
              </div>
            )}

            {/* Preview */}
            <div>
              <div className="tv-num tv-label text-slate-400 mb-2">
                {t("import.preview")} · {mappedTrades.valid.length} {t("import.validRows")}
                {mappedTrades.invalid > 0
                  ? ` · ${mappedTrades.invalid} ${t("import.invalidSkipped")}`
                  : ""}
              </div>
              <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                {mappedTrades.valid.slice(0, 5).map((tr, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="text-slate-500 w-20 shrink-0">{tr.date}</span>
                    <span className="font-bold text-white w-16 truncate">{tr.symbol}</span>
                    <span className="tv-label text-slate-500">{tr.direction}</span>
                    {tr.entryTime && (
                      <span className="text-slate-600 text-[10px]">{tr.entryTime}</span>
                    )}
                    <span
                      className={cn(
                        "tv-figure ml-auto",
                        tr.pnl >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {formatPnl(tr.pnl)}
                    </span>
                  </div>
                ))}
                {mappedTrades.valid.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-slate-600">
                    {t("import.noValidRows")}
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation chiffrée AVANT écriture : l'utilisateur voit
                exactement ce qui sera ajouté et ce qui sera ignoré. */}
            {confirming ? (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">{t("import.confirmTitle")}</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>
                    <span className="tv-figure text-emerald-400">{plan.fresh.length}</span>{" "}
                    {t("import.willAdd")}
                  </li>
                  {plan.duplicates > 0 && (
                    <li>
                      <span className="tv-figure text-slate-300">{plan.duplicates}</span>{" "}
                      {t("import.duplicatesSkipped")}
                    </li>
                  )}
                  {mappedTrades.invalid > 0 && (
                    <li>
                      <span className="tv-figure text-slate-300">{mappedTrades.invalid}</span>{" "}
                      {t("import.invalidSkipped")}
                    </li>
                  )}
                </ul>
                <p className="tv-row-label">{t("import.confirmSafe")}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirming(false)} className="flex-1">
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={doImport} disabled={plan.fresh.length === 0} className="flex-1">
                    <Upload className="w-4 h-4" />
                    {t("import.confirmBtn")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setConfirming(true)}
                disabled={!canImport}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2",
                  canImport ? "tv-accent-fill" : "bg-slate-800 text-slate-500 cursor-not-allowed",
                )}
              >
                <Upload className="w-4 h-4" />
                {t("import.importBtn")} ({mappedTrades.valid.length})
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
