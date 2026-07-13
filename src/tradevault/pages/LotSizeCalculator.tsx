import { useEffect, useMemo, useState } from "react";
import { Calculator, Copy, Check, Wallet, Percent, Crosshair, Plus, Info } from "lucide-react";
import { POINT_VALUES, FOREX_PAIRS, calcContracts, calcForexLots } from "../utils/positionCalc";
import { loadAccountBalance, saveAccountBalance } from "../store";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

interface LotSizeCalculatorProps {
  onAddTrade: () => void;
}

type Mode = "forex" | "futures";

const PERSIST_KEY = "tv-lot-calc";

interface PersistedState {
  mode: Mode;
  riskPct: string;
  stopPips: string;
  pairIdx: number;
  stopPoints: string;
  pointValue: string;
}

function readPersisted(): Partial<PersistedState> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PERSIST_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function LotSizeCalculator({ onAddTrade }: LotSizeCalculatorProps) {
  const { user } = useAuth();
  const { t } = useT();
  const persisted = useMemo(readPersisted, []);

  const [mode, setMode] = useState<Mode>(persisted.mode === "futures" ? "futures" : "forex");
  const [balance, setBalance] = useState<number>(25000);
  const [riskPct, setRiskPct] = useState(persisted.riskPct ?? "1");
  const [stopPips, setStopPips] = useState(persisted.stopPips ?? "");
  const [pairIdx, setPairIdx] = useState(Math.min(persisted.pairIdx ?? 0, FOREX_PAIRS.length - 1));
  const [stopPoints, setStopPoints] = useState(persisted.stopPoints ?? "");
  const [pointValue, setPointValue] = useState(persisted.pointValue ?? "20");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadAccountBalance(user.id)
      .then((b) => {
        if (active) setBalance(b);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Persist the setup so the tool remembers you between sessions.
  useEffect(() => {
    try {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          mode,
          riskPct,
          stopPips,
          pairIdx,
          stopPoints,
          pointValue,
        } satisfies PersistedState),
      );
    } catch {
      // storage may be unavailable (private mode) — persistence is best-effort
    }
  }, [mode, riskPct, stopPips, pairIdx, stopPoints, pointValue]);

  const riskDollar = useMemo(() => {
    const pct = parseFloat(riskPct) || 0;
    return Math.max(0, (balance * pct) / 100);
  }, [balance, riskPct]);

  const pair = FOREX_PAIRS[pairIdx];
  const forex = useMemo(
    () => calcForexLots(riskDollar, parseFloat(stopPips) || 0, pair.pipValue),
    [riskDollar, stopPips, pair],
  );
  const futures = useMemo(
    () => calcContracts(riskDollar, parseFloat(stopPoints) || 0, parseFloat(pointValue) || 0),
    [riskDollar, stopPoints, pointValue],
  );

  const copyResult = async () => {
    const text =
      mode === "forex"
        ? forex
          ? `${pair.label} · ${forex.lots} lots · risk $${forex.effectiveRisk.toFixed(2)} · stop ${stopPips} pips`
          : ""
        : futures
          ? `${futures.contracts} contracts · risk $${futures.effectiveRisk.toFixed(2)} · stop ${stopPoints} pts @ $${pointValue}/pt`
          : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard permission denied — button simply doesn't flash "copied"
    }
  };

  const inputClass =
    "w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all";
  const labelClass =
    "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";
  const hasResult =
    mode === "forex" ? !!forex && forex.lots > 0 : !!futures && futures.contracts > 0;

  return (
    <div className="p-4 md:p-8 max-w-[860px] mx-auto">
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {t("calc.title")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">{t("calc.subtitle")}</p>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex p-1 rounded-2xl bg-white/[0.03] border border-white/[0.07] mb-5 animate-fade-in-up stagger-1">
        {(["forex", "futures"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "h-9 px-5 rounded-xl text-xs font-bold transition-all",
              mode === m
                ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            {t(m === "forex" ? "calc.forex" : "calc.futures")}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Inputs */}
        <div className="glass-strong rounded-3xl p-5 md:p-6 space-y-4 animate-fade-in-up stagger-2">
          {/* Risk budget — shared by both modes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                <Wallet className="w-3 h-3 inline mr-1 -mt-0.5" />
                {t("calc.accountBalance")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={balance}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setBalance(v);
                    if (user) saveAccountBalance(user.id, v).catch(() => {});
                  }}
                  className={cn(inputClass, "pl-7")}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>
                <Percent className="w-3 h-3 inline mr-1 -mt-0.5" />
                {t("calc.riskPercent")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={100}
                  value={riskPct}
                  onChange={(e) => setRiskPct(e.target.value)}
                  placeholder="1.0"
                  className={cn(inputClass, "pr-8")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-cyan-500/[0.05] border border-cyan-500/15 px-3.5 h-11">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t("calc.riskBudget")}
            </span>
            <span className="text-sm font-bold text-cyan-300 tabular-nums">
              ${riskDollar.toFixed(2)}
            </span>
          </div>

          {mode === "forex" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("calc.pair")}</label>
                  <select
                    value={pairIdx}
                    onChange={(e) => setPairIdx(Number(e.target.value))}
                    className={cn(inputClass, "cursor-pointer appearance-none")}
                  >
                    {FOREX_PAIRS.map((p, i) => (
                      <option key={p.label} value={i} className="bg-[#0a0f1e]">
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    <Crosshair className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {t("calc.stopPips")}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    value={stopPips}
                    onChange={(e) => setStopPips(e.target.value)}
                    placeholder="20"
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-[10px] text-slate-600 leading-relaxed">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                {t("calc.pipValueInfo")}: ${pair.pipValue.toFixed(2)} / pip
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {POINT_VALUES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPointValue(String(p.value))}
                    className={cn(
                      "h-8 px-2.5 rounded-lg text-[10px] font-bold transition-all border",
                      pointValue === String(p.value)
                        ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                        : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {p.label} ${p.value}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    <Crosshair className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {t("calc.stopPoints")}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min={0}
                    value={stopPoints}
                    onChange={(e) => setStopPoints(e.target.value)}
                    placeholder="10"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("calc.pointValue")}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    value={pointValue}
                    onChange={(e) => setPointValue(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Result */}
        <div
          className={cn(
            "glass-strong rounded-3xl p-5 md:p-6 animate-fade-in-up stagger-3 border transition-colors",
            hasResult ? "border-cyan-500/20" : "border-transparent",
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Calculator className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              {t("calc.positionSize")}
            </h2>
          </div>

          {!hasResult ? (
            <p className="text-xs text-slate-500 leading-relaxed py-6 text-center">
              {t("calc.fillHint")}
            </p>
          ) : mode === "forex" && forex ? (
            <div className="space-y-1 animate-fade-in">
              <div className="text-center py-3">
                <div className="text-4xl font-bold text-white font-display tabular-nums">
                  {forex.lots.toFixed(2)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mt-1">
                  {t("calc.standardLots")} · {pair.label}
                </div>
              </div>
              <ResultRow label={t("calc.miniLots")} value={forex.miniLots.toFixed(1)} />
              <ResultRow label={t("calc.microLots")} value={forex.microLots.toFixed(0)} />
              <ResultRow label={t("calc.units")} value={forex.units.toLocaleString()} />
              <ResultRow
                label={t("calc.pipValueAtSize")}
                value={`$${forex.pipValueAtSize.toFixed(2)}`}
              />
              <ResultRow
                label={t("calc.effectiveRisk")}
                value={`$${forex.effectiveRisk.toFixed(2)}`}
                accent
              />
            </div>
          ) : futures ? (
            <div className="space-y-1 animate-fade-in">
              <div className="text-center py-3">
                <div className="text-4xl font-bold text-white font-display tabular-nums">
                  {futures.contracts}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mt-1">
                  {t("calc.contracts")}
                </div>
              </div>
              <ResultRow label={t("calc.stopPoints")} value={stopPoints} />
              <ResultRow label={t("calc.pointValue")} value={`$${parseFloat(pointValue) || 0}`} />
              <ResultRow
                label={t("calc.effectiveRisk")}
                value={`$${futures.effectiveRisk.toFixed(2)}`}
                accent
              />
            </div>
          ) : null}

          {hasResult && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={copyResult}
                className="flex-1 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? t("calc.copied") : t("calc.copy")}
              </button>
              <button
                onClick={onAddTrade}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> {t("calc.logTrade")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between h-9 px-3 rounded-xl odd:bg-white/[0.02]">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          accent ? "text-cyan-300" : "text-slate-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}
