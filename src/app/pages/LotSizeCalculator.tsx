import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  Lock,
  Crosshair,
  Plus,
  AlertTriangle,
  CalendarDays,
  Gauge,
  Layers,
} from "lucide-react";
import { POINT_VALUES, FOREX_PAIRS, calcContracts, calcForexLots } from "../utils/positionCalc";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { FIELD_BASE, Button } from "@/shared/ui";
import { usePageActions } from "../contexts/PageActionsContext";
import type { Page } from "../types";

interface LotSizeCalculatorProps {
  onAddTrade: () => void;
  setPage: (p: Page) => void;
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

export default function LotSizeCalculator({ onAddTrade, setPage }: LotSizeCalculatorProps) {
  const { t } = useT();
  const { activeAccount } = useAccounts();
  const persisted = useMemo(readPersisted, []);

  // Capital = le capital du compte sélectionné. PRÉREMPLI et VERROUILLÉ : on ne
  // saisit pas son capital ici, on le lit — il vit dans le compte et il suit la
  // sélection (le calcul se re-dimensionne dès qu'on change de compte).
  const balance = activeAccount?.startingBalance ?? 0;

  const [mode, setMode] = useState<Mode>(persisted.mode === "futures" ? "futures" : "forex");
  const [riskPct, setRiskPct] = useState(persisted.riskPct ?? "1");
  const [stopPips, setStopPips] = useState(persisted.stopPips ?? "");
  const [pairIdx, setPairIdx] = useState(Math.min(persisted.pairIdx ?? 0, FOREX_PAIRS.length - 1));
  const [stopPoints, setStopPoints] = useState(persisted.stopPoints ?? "");
  const [pointValue, setPointValue] = useState(persisted.pointValue ?? "20");
  const [copied, setCopied] = useState(false);

  // Persist the setup so the tool remembers you between sessions.
  const persist = (patch: Partial<PersistedState>) => {
    try {
      const prev = readPersisted();
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ ...prev, ...patch }));
    } catch {
      // storage may be unavailable (private mode) — persistence is best-effort
    }
  };
  const setModePersisted = (m: Mode) => {
    setMode(m);
    persist({ mode: m });
  };
  const setRiskPctPersisted = (v: string) => {
    setRiskPct(v);
    persist({ riskPct: v });
  };
  const setStopPipsPersisted = (v: string) => {
    setStopPips(v);
    persist({ stopPips: v });
  };
  const setPairPersisted = (i: number) => {
    setPairIdx(i);
    persist({ pairIdx: i });
  };
  const setStopPointsPersisted = (v: string) => {
    setStopPoints(v);
    persist({ stopPoints: v });
  };
  const setPointValuePersisted = (v: string) => {
    setPointValue(v);
    persist({ pointValue: v });
  };

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
  const labelClass = "tv-label block text-slate-400 mb-1.5";
  const hasResult =
    mode === "forex" ? !!forex && forex.lots > 0 : !!futures && futures.contracts > 0;

  const riskPctNum = parseFloat(riskPct) || 0;
  const riskTooHigh = riskPctNum > RECOMMENDED_RISK_PCT;
  const fiveLossDrawdown = `${Math.min(100, riskPctNum * 5).toFixed(0)}%`;
  const gaugePct = Math.max(0, Math.min(100, (riskPctNum / RECOMMENDED_RISK_PCT) * 100));

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="subtle"
          size="sm"
          onClick={() => setPage("news")}
          title={t("calc.economicCalendar")}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">{t("calc.economicCalendar")}</span>
        </Button>
        <div className="inline-flex p-1 rounded-xl bg-black/30 border border-white/[0.08]">
          {(["forex", "futures"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModePersisted(m)}
              className={cn(
                "h-8 px-4 rounded-lg text-xs font-bold transition",
                mode === m ? "tv-accent-fill" : "text-slate-500 hover:text-slate-300",
              )}
            >
              {t(m === "forex" ? "calc.forex" : "calc.futures")}
            </button>
          ))}
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, setPage, t],
  );
  usePageActions(headerActions);

  return (
    <div className="p-4 md:p-5 max-w-[1400px] mx-auto">
      <div className="grid md:grid-cols-[1fr_320px] gap-4 md:gap-5 items-start">
        {/* ══ Colonne gauche : capital → risque → instrument ══ */}
        <div className="space-y-4">
          {/* ── Capital — verrouillé, prérempli depuis le compte sélectionné ── */}
          <div className="glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="tv-label text-slate-500">{t("calc.capital")}</span>
              </div>
              <span className="tv-figure text-2xl md:text-3xl text-white">
                ${balance.toLocaleString()}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
              {activeAccount?.name ? (
                <span className="text-slate-400 font-semibold">{activeAccount.name}</span>
              ) : null}
              <span>{t("calc.capitalLocked")}</span>
            </p>
          </div>

          {/* ── Risque — un clic, quatre tailles ── */}
          <div className="glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-2">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <Gauge className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="tv-label text-slate-500">{t("calc.riskPresets")}</span>
              </div>
              <span
                className={cn(
                  "tv-figure text-sm",
                  riskTooHigh ? "text-amber-300" : "text-cyan-300",
                )}
              >
                ${riskDollar.toFixed(2)}
                <span className="ml-1 text-[10px] font-medium text-slate-500 normal-case">
                  {t("calc.perTrade")}
                </span>
              </span>
            </div>

            {/* One-tap risk sizes — chaque bouton affiche le % ET le $ en jeu. */}
            <div className="grid grid-cols-4 gap-2">
              {RISK_PRESETS.map((p) => {
                const active = riskPct === p;
                const dollar = ((balance * parseFloat(p)) / 100).toFixed(0);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRiskPctPersisted(p)}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-center transition",
                      active
                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                        : "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/[0.12]",
                    )}
                  >
                    <span className="tv-figure block text-sm">{p}%</span>
                    <span
                      className={cn(
                        "tv-figure block text-[10px] mt-0.5",
                        active ? "text-cyan-300" : "text-slate-500",
                      )}
                    >
                      ${dollar}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Jauge de risque — le $ en jeu, en live */}
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="tv-label text-slate-500">{t("calc.riskBudget")}</span>
                <span className="tv-figure text-[10px] text-slate-500">{riskPctNum}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-250",
                    riskTooHigh ? "bg-gradient-to-r from-amber-500 to-red-500" : "tv-accent-fill",
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

          {/* ── Instrument — une seule saisie : la distance de stop ── */}
          <div className="glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-3">
            <div className="flex items-center gap-2.5 mb-3">
              <Layers className="w-4 h-4 text-cyan-300 shrink-0" />
              <span className="tv-label text-slate-500">{t("calc.sectionInstrument")}</span>
            </div>

            {mode === "forex" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {FOREX_PAIRS.map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPairPersisted(i)}
                      className={cn(
                        "h-9 px-3 rounded-xl border text-xs font-bold transition",
                        i === pairIdx
                          ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
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
                    onChange={(e) => setStopPipsPersisted(e.target.value)}
                    placeholder="20"
                    className={cn(inputClass, "tv-figure")}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {POINT_VALUES.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPointValuePersisted(String(p.value))}
                      className={cn(
                        "h-9 px-3 rounded-xl border text-xs font-bold transition",
                        pointValue === String(p.value)
                          ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                          : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300",
                      )}
                    >
                      {p.label} <span className="font-medium text-slate-500">${p.value}</span>
                    </button>
                  ))}
                </div>
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
                    onChange={(e) => setStopPointsPersisted(e.target.value)}
                    placeholder="10"
                    className={cn(inputClass, "tv-figure")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ Colonne droite : la taille, en direct ══ */}
        <div
          className={cn(
            "relative overflow-hidden glass-strong rounded-3xl p-4 md:p-5 animate-fade-in-up stagger-4 border transition-colors md:sticky md:top-4",
            hasResult ? "border-cyan-500/25" : "border-transparent",
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md tv-accent-fill">
              <Gauge className="w-3 h-3" />
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
                  <Crosshair className="w-5 h-5 text-slate-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                {t("calc.fillHint")}
              </p>
            </div>
          ) : mode === "forex" && forex ? (
            <div className="animate-fade-in">
              <div className="relative text-center pt-2 pb-3">
                <div className="relative inline-block text-white tv-figure text-6xl">
                  {forex.lots.toFixed(2)}
                </div>
                <div className="tv-label-wide relative mt-1 text-[var(--tv-highlight)]">
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
                <div className="relative inline-block text-white tv-figure text-6xl">
                  {futures.contracts}
                </div>
                <div className="tv-label-wide relative mt-1 text-[var(--tv-highlight)]">
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
                <span className="tv-label text-slate-500">{t("calc.riskBudget")}</span>
                <span className="tv-figure text-xs text-cyan-300">
                  ${riskDollar.toFixed(2)} · {riskPctNum || 0}% {t("calc.riskOfAccount")}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                <Button variant="subtle" onClick={copyResult} className="flex-1 h-10">
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? t("calc.copied") : t("calc.copy")}
                </Button>
                <Button variant="accent" onClick={onAddTrade} className="flex-1 h-10">
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
      <span className={cn("tv-figure text-sm", accent ? "text-cyan-300" : "text-slate-200")}>
        {value}
      </span>
    </div>
  );
}
