import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Trash2,
  X,
  Clock,
  Percent,
  Hash,
  OctagonX,
  PenLine,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import {
  type TradingRule,
  type RuleKind,
  loadTradingRules,
  saveTradingRules,
} from "../utils/tradingRules";

// "Mes règles de trading" card on the profile page. The trader writes their
// own rules; structured kinds are auto-checked on every trade save (the
// anti-bias push), custom ones stand as written commitments.

const KIND_META: Record<
  RuleKind,
  { icon: typeof Clock; needsValue: "time" | "number" | null; defFr: string; defEn: string }
> = {
  no_trade_after: {
    icon: Clock,
    needsValue: "time",
    defFr: "Pas de trade après {v}",
    defEn: "No trades after {v}",
  },
  no_trade_before: {
    icon: Clock,
    needsValue: "time",
    defFr: "Pas de trade avant {v}",
    defEn: "No trades before {v}",
  },
  max_risk_pct: {
    icon: Percent,
    needsValue: "number",
    defFr: "Risque max {v}% par trade",
    defEn: "Max {v}% risk per trade",
  },
  max_trades_day: {
    icon: Hash,
    needsValue: "number",
    defFr: "Max {v} trades par jour",
    defEn: "Max {v} trades per day",
  },
  stop_after_losses: {
    icon: OctagonX,
    needsValue: "number",
    defFr: "Stop après {v} trades perdants",
    defEn: "Stop after {v} losing trades",
  },
  custom: { icon: PenLine, needsValue: null, defFr: "", defEn: "" },
};

export default function TradingRulesSection() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const fr = lang === "fr";
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<RuleKind>("no_trade_after");
  const [value, setValue] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadTradingRules(user.id)
      .then((r) => active && setRules(r))
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [user]);

  const persist = async (next: TradingRule[]) => {
    setRules(next);
    if (!user) return;
    try {
      await saveTradingRules(user.id, next);
      // The app-level rule checker caches rules in a ref — tell it to refresh.
      window.dispatchEvent(new CustomEvent("tv-rules-updated", { detail: next }));
    } catch (e) {
      console.error("Failed to save rules", e);
    }
  };

  const defaultText = (k: RuleKind, v: string) =>
    (fr ? KIND_META[k].defFr : KIND_META[k].defEn).replace("{v}", v || "…");

  const add = () => {
    const meta = KIND_META[kind];
    if (meta.needsValue && !value.trim()) return;
    const finalText = text.trim() || defaultText(kind, value.trim());
    if (!finalText || finalText.includes("…")) return;
    const rule: TradingRule = {
      id: crypto.randomUUID(),
      kind,
      value: value.trim(),
      text: finalText,
      enabled: true,
    };
    void persist([...rules, rule]);
    setAdding(false);
    setValue("");
    setText("");
  };

  const kindLabel = (k: RuleKind) => t(`rules.kind.${k}` as Parameters<typeof t>[0]);

  return (
    <div className="glass-strong rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          {t("rules.title")}
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-xs font-bold text-cyan-300 hover:bg-cyan-500/15 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> {t("rules.add")}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed -mt-1">{t("rules.hint")}</p>

      {/* Existing rules */}
      {loaded && rules.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-5 text-center text-xs text-slate-500">
          {t("rules.empty")}
        </div>
      )}
      <div className="space-y-2">
        {rules.map((r) => {
          const Icon = KIND_META[r.kind].icon;
          return (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all",
                r.enabled
                  ? "bg-white/[0.03] border-white/[0.07]"
                  : "bg-white/[0.015] border-white/[0.04] opacity-55",
              )}
            >
              <span className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white truncate">{r.text}</div>
                <div className="text-[10px] text-slate-500">
                  {r.kind === "custom" ? t("rules.manualCheck") : t("rules.autoCheck")}
                </div>
              </div>
              <button
                onClick={() =>
                  persist(rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))
                }
                aria-label={r.enabled ? t("rules.disable") : t("rules.enable")}
                className={cn(
                  "w-10 h-5.5 rounded-full p-0.5 shrink-0 transition-colors",
                  r.enabled ? "bg-cyan-500" : "bg-white/[0.12]",
                )}
              >
                <div
                  className={cn(
                    "w-4.5 h-4.5 rounded-full bg-white transition-transform",
                    r.enabled && "translate-x-[18px]",
                  )}
                />
              </button>
              <button
                onClick={() => persist(rules.filter((x) => x.id !== r.id))}
                aria-label={t("common.delete")}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              {t("rules.new")}
            </span>
            <button
              onClick={() => setAdding(false)}
              aria-label={t("common.close")}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND_META) as RuleKind[]).map((k) => {
              const Icon = KIND_META[k].icon;
              return (
                <button
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setText("");
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 border text-left text-xs font-semibold transition-all",
                    kind === k
                      ? "bg-cyan-500/15 border-cyan-400/50 text-white"
                      : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20",
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{kindLabel(k)}</span>
                </button>
              );
            })}
          </div>
          {KIND_META[kind].needsValue && (
            <input
              type={KIND_META[kind].needsValue === "time" ? "time" : "number"}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={KIND_META[kind].needsValue === "time" ? "18:00" : "1"}
              className="w-full h-10 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "custom" ? t("rules.customPlaceholder") : defaultText(kind, value || "…")
            }
            maxLength={120}
            className="w-full h-10 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
          />
          <button
            onClick={add}
            className="w-full h-10 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all"
          >
            {t("rules.save")}
          </button>
        </div>
      )}
    </div>
  );
}
