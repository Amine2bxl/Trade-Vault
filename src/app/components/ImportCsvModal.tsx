import { useMemo, useRef, useState } from "react";
import { X, Upload, FileSpreadsheet, Check, Loader2, AlertCircle } from "lucide-react";
import { Trade } from "../types";
import { formatPnl } from "../utils/tradeCalcs";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { Button, Modal } from "@/shared/ui";
import {
  FIELDS,
  REQUIRED,
  detectFormat,
  guessMapping,
  mapRowsToTrades,
  parseCsv,
  rejectFile,
  splitDuplicates,
  type Field,
  type FileRejection,
} from "../utils/csvImport";

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
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{
    headers: string[];
    rows: string[][];
    format: string | null;
  } | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<Field, number>>>({});
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
      const text = await file.text();
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0 || rows.length === 0) {
        setError("noHeaders");
        return;
      }
      setParsed({ headers, rows, format: detectFormat(headers) });
      setMapping(guessMapping(headers));
      setResult(null);
    } catch (e) {
      console.error("Could not read the CSV file", e);
      setError("unreadable");
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setMapping({});
    setError(null);
    setConfirming(false);
  };

  const mappedTrades = useMemo(
    () => (parsed ? mapRowsToTrades(parsed.rows, mapping) : { valid: [] as Trade[], invalid: 0 }),
    [parsed, mapping],
  );

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
        invalid: mappedTrades.invalid,
        failed,
      });
    } catch (e) {
      console.error("Import failed", e);
      setResult({
        imported: 0,
        duplicates: plan.duplicates,
        invalid: mappedTrades.invalid,
        failed: plan.fresh.length,
      });
    } finally {
      setProgress(null);
    }
  };

  const canImport =
    REQUIRED.every((f) => mapping[f] !== undefined) && mappedTrades.valid.length > 0;
  const selectClass =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40 cursor-pointer";

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-2xl max-h-[96vh] md:max-h-[90vh] overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
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
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-[width] duration-300"
                style={{
                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-3">{t("import.dontClose")}</p>
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
            <div className="text-xl font-bold text-white mb-1">
              {result.imported} {t("import.imported")}
            </div>
            <div className="text-xs text-slate-500">
              {result.duplicates > 0 && (
                <span>
                  {result.duplicates} {t("import.duplicatesSkipped")} ·{" "}
                </span>
              )}
              {result.invalid > 0 && (
                <span>
                  {result.invalid} {t("import.invalidSkipped")}
                </span>
              )}
            </div>
            {/* Un échec silencieux ferait croire que tout est passé. */}
            {result.failed > 0 && (
              <p className="mt-3 text-xs text-red-400">
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
                <p className="text-xs text-red-300 leading-relaxed">{t(ERROR_KEY[error])}</p>
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
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-slate-400">
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

            {/* Column mapping */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {t("import.mapColumns")}
              </div>
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
                    <select
                      value={mapping[f] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m,
                          [f]: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `(col ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                    <span className="text-slate-500 uppercase text-[10px]">{tr.direction}</span>
                    {tr.entryTime && (
                      <span className="text-slate-600 text-[10px]">{tr.entryTime}</span>
                    )}
                    <span
                      className={cn(
                        "ml-auto font-bold tabular-nums",
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
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {plan.fresh.length}
                    </span>{" "}
                    {t("import.willAdd")}
                  </li>
                  {plan.duplicates > 0 && (
                    <li>
                      <span className="font-bold text-slate-300 tabular-nums">
                        {plan.duplicates}
                      </span>{" "}
                      {t("import.duplicatesSkipped")}
                    </li>
                  )}
                  {mappedTrades.invalid > 0 && (
                    <li>
                      <span className="font-bold text-slate-300 tabular-nums">
                        {mappedTrades.invalid}
                      </span>{" "}
                      {t("import.invalidSkipped")}
                    </li>
                  )}
                </ul>
                <p className="text-[11px] text-slate-500">{t("import.confirmSafe")}</p>
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
                  canImport
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed",
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
