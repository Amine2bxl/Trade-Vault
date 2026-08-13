import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Check,
  Wallet,
  Percent,
  Crosshair,
  Plus,
  AlertTriangle,
  Shield,
  Layers,
  Gauge,
  ArrowDown,
} from "lucide-react";
import { POINT_VALUES, FOREX_PAIRS, calcContracts, calcForexLots } from "../utils/positionCalc";
import { loadAccountBalance, saveAccountBalance } from "../store";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { FIELD_BASE, Button } from "@/shared/ui";

interface LotSizeCalculatorProps {
  onAddTrade: () => void;
}

type Mode = "forex" | "futures";

const PERSIST_KEY = "tv-lot-calc";

// The four sizes a disciplined trader actually uses. One tap beats typing, and
// putting 2% at the end of the row makes it read as the ceiling it should be.
const RISK_PRESETS = ["0.25", "0.5", "1", "2"] as const;

/** Le budget conseillé par la discipline TradeVault (jamais au-delà). */
const RECOMMENDED_RISK_PCT = 2;

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

  const inputClass = cn(FIELD_BASE, "h-11");
  const labelClass =
    "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";
  const hasResult =
    mode === "forex" ? !!forex && forex.lots > 0 : !!futures && futures.contracts > 0;

  // Sizing is only as good as the risk behind it: past 2% per trade the maths
  // stops protecting the account, so we say so — with the number, not a lecture.
  const riskPctNum = parseFloat(riskPct) || 0;
  const riskTooHigh = riskPctNum > RECOMMENDED_RISK_PCT;
  const fiveLossDrawdown = `${Math.min(100, riskPctNum * 5).toFixed(0)}%`;
  const gaugePct = Math.max(0, Math.min(100, (riskPctNum / RECOMMENDED_RISK_PCT) * 100));

  return (
    <div className="p-4 md:p-5 max-w-[920px] mx-auto">
      {/* ── Mode (forex / futures) — le seul contrôle de tête, aligné à droite
          comme les CTA des autres pages (titre + icône retirés : la barre
          d'onglets nomme déjà la page). ── */}
      <div className="flex items-center justify-end mb-4 animate-fade-in-up stagger-0">
        <div className="inline-flex p-1 rounded-2xl bg-black/30 border border-white/[0.08]">
          {(["forex", "futures"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "h-9 px-5 rounded-xl text-xs font-bold transition",
                mode === m
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              {t(m === "forex" ? "calc.forex" : "calc.futures")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-4 md:gap-5 items-start">
        {/* ══ Colonne gauche : les deux étapes ══ */}
        <div className="space-y-4">
          {/* ── ÉTAPE 1 · Ton risque ── */}
          <div className="relative glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
                <Shield className="w-3.5 h-3.5 text-white" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">{t("calc.sectionRisk")}</h2>
              </div>
            </div>

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
                    className={cn(inputClass, "pl-7 tabular-nums")}
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
                    className={cn(inputClass, "pr-8 tabular-nums")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* One-tap risk sizes */}
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-0.5">
                {t("calc.riskPresets")}
              </span>
              {RISK_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRiskPct(p)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-[11px] font-bold border transition",
                    riskPct === p
                      ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                      : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
                  )}
                >
                  {p}%
                </button>
              ))}
            </div>

            {/* Jauge de risque — le $ en jeu, en live */}
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Gauge className="w-3.5 h-3.5" /> {t("calc.riskBudget")}
                </span>
                <span
                  className={cn(
                    "font-display text-sm font-extrabold tabular-nums",
                    riskTooHigh ? "text-amber-300" : "text-cyan-300",
                  )}
                >
                  ${riskDollar.toFixed(2)}
                  <span className="ml-1 text-[10px] font-medium text-slate-500 normal-case">
                    {t("calc.perTrade")}
                  </span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition duration-250",
                    riskTooHigh
                      ? "bg-gradient-to-r from-amber-500 to-red-500"
                      : "bg-gradient-to-r from-cyan-500 to-teal-400",
                  )}
                  style={{ width: `${gaugePct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-600 leading-relaxed">
                {gaugePct <= 100
                  ? `${Math.round(gaugePct)}% ${t("calc.riskGauge")}`
                  : t("calc.riskSuggestion")}
              </p>
            </div>

            {riskTooHigh && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-300 mt-3 animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {t("calc.riskHigh").replace("{v}", fiveLossDrawdown)}
              </p>
            )}
          </div>

          {/* ── ÉTAPE 2 · L'instrument ── */}
          <div className="relative glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-2">
            <div className="flex items-center gap-3 mb-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
                <Layers className="w-3.5 h-3.5 text-white" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">{t("calc.sectionInstrument")}</h2>
              </div>
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
                      className={cn(inputClass, "tabular-nums")}
                    />
                  </div>
                </div>
                <p className="flex items-start gap-1.5 text-[10px] text-slate-600 leading-relaxed mt-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 flex items-center justify-center shrink-0 mt-px">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                  </span>
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
                        "h-8 px-2.5 rounded-lg text-[10px] font-bold transition border",
                        pointValue === String(p.value)
                          ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                      )}
                    >
                      {p.label} ${p.value}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
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
                      className={cn(inputClass, "tabular-nums")}
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
                      className={cn(inputClass, "tabular-nums")}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ══ Colonne droite : la taille, en direct ══ */}
        <div
          className={cn(
            "relative overflow-hidden glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-3 border transition-colors md:sticky md:top-4",
            hasResult ? "border-cyan-500/25" : "border-transparent",
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-teal-600">
              <Gauge className="w-3 h-3 text-white" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">{t("calc.resultLive")}</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {mode === "forex" ? t("calc.standardLots") : t("calc.contracts")}
              </p>
            </div>
          </div>

          {!hasResult ? (
            <div className="text-center py-8">
              <div className="relative mx-auto w-14 h-14 mb-3">
                <span className="absolute inset-0 rounded-2xl bg-cyan-500/20 blur-lg" />
                <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                  <ArrowDown className="w-5 h-5 text-slate-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                {t("calc.fillHint")}
              </p>
            </div>
          ) : mode === "forex" && forex ? (
            <div className="animate-fade-in">
              <div className="relative text-center pt-2 pb-3">
                <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-40 h-24 rounded-full bg-cyan-500/15 blur-2xl" />
                <div className="relative inline-block bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent font-display text-6xl font-extrabold tabular-nums tracking-tight drop-shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                  {forex.lots.toFixed(2)}
                </div>
                <div className="relative mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">
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
            <div className="animate-fade-in">
              <div className="relative text-center pt-2 pb-3">
                <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-40 h-24 rounded-full bg-cyan-500/15 blur-2xl" />
                <div className="relative inline-block bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent font-display text-6xl font-extrabold tabular-nums tracking-tight drop-shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                  {futures.contracts}
                </div>
                <div className="relative mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">
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
            <>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2 mt-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {t("calc.riskBudget")}
                </span>
                <span className="text-xs font-bold text-cyan-300 tabular-nums">
                  ${riskDollar.toFixed(2)} · {riskPctNum || 0}% {t("calc.riskOfAccount")}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={copyResult}
                  className="flex-1 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? t("calc.copied") : t("calc.copy")}
                </button>
                <Button onClick={onAddTrade} className="flex-1 h-10">
                  <Plus className="w-3.5 h-3.5" /> {t("calc.logTrade")}
                </Button>
              </div>
            </>
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
