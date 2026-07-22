import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  Compass,
  ShieldAlert,
  Layers,
  Ban,
  SunMedium,
  Target,
  Plus,
  Trash2,
  Check,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Page } from "../types";
import {
  EMPTY_PLAN,
  loadTradingPlan,
  planCompletion,
  saveTradingPlan,
  type PlanSetup,
  type TradingPlanData,
} from "../utils/tradingPlan";
import TradingRulesSection from "../components/TradingRulesSection";
import { PageHeader } from "@/shared/ui";

// Trading Plan — the trader's written constitution. Every field autosaves
// (debounced) to profiles.trading_plan; the completion ring fills as the
// plan takes shape. Copy is inline fr/en like Goals.tsx.

export default function TradingPlan({ setPage }: { setPage: (p: Page) => void }) {
  const { user } = useAuth();
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);

  const [plan, setPlan] = useState<TradingPlanData>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadTradingPlan(user.id)
      .then((p) => {
        if (!active) return;
        setPlan(p);
        loadedRef.current = true;
      })
      .catch((e) => console.error("Failed to load trading plan", e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Debounced autosave — only after the initial load, never for it.
  const update = useCallback(
    (patch: Partial<TradingPlanData> | ((p: TradingPlanData) => TradingPlanData)) => {
      setPlan((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        if (user && loadedRef.current) {
          setSaveState("saving");
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            saveTradingPlan(user.id, next)
              .then(() => {
                setSaveState("saved");
                setTimeout(() => setSaveState("idle"), 1600);
              })
              .catch((e) => {
                console.error("Failed to save trading plan", e);
                setSaveState("idle");
              });
          }, 800);
        }
        return next;
      });
    },
    [user],
  );

  const completion = useMemo(() => planCompletion(plan), [plan]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="glass rounded-3xl p-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      {/* Header + completion */}
      <PageHeader
        className="mb-2 items-center"
        title={tr("Plan de trading", "Trading Plan")}
        subtitle={tr(
          "Ta constitution de trader — écrite une fois, relue chaque jour.",
          "Your trader's constitution — written once, re-read every day.",
        )}
        actions={<CompletionRing value={completion} label={tr("complet", "complete")} />}
      />

      {/* Autosave indicator */}
      <div className="h-4 -mt-2 text-right text-[10px] font-semibold uppercase tracking-wider">
        {saveState === "saving" && (
          <span className="text-slate-500">{tr("Enregistrement…", "Saving…")}</span>
        )}
        {saveState === "saved" && (
          <span className="text-emerald-400 inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> {tr("Enregistré", "Saved")}
          </span>
        )}
      </div>

      {/* ── Mission & terrain ── */}
      <Section
        icon={Compass}
        title={tr("Mission & terrain de jeu", "Mission & playing field")}
        sub={tr(
          "Pourquoi tu trades, sur quoi, et quand.",
          "Why you trade, what you trade, and when.",
        )}
        delay={0}
      >
        <Field
          label={tr("Ma mission (relue les jours de tilt)", "My mission (re-read on tilt days)")}
        >
          <textarea
            value={plan.mission}
            onChange={(e) => update({ mission: e.target.value })}
            placeholder={tr(
              "Ex : Devenir constant avant de devenir gros. Je protège mon capital d'abord.",
              "E.g.: Become consistent before becoming big. I protect my capital first.",
            )}
            rows={3}
            className={inputCls + " resize-none leading-relaxed"}
          />
        </Field>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label={tr("Marchés tradés", "Markets traded")}>
            <MarketChips
              markets={plan.markets}
              onChange={(m) => update({ markets: m })}
              placeholder={tr("NQ, EURUSD… + Entrée", "NQ, EURUSD… + Enter")}
            />
          </Field>
          <Field label={tr("Fenêtre de trading", "Trading window")}>
            <input
              value={plan.sessions}
              onChange={(e) => update({ sessions: e.target.value })}
              placeholder={tr("Ex : 15h30 – 17h30 (ouverture NY)", "E.g.: 9:30 – 11:30 (NY open)")}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* ── Risk management ── */}
      <Section
        icon={ShieldAlert}
        title={tr("Gestion du risque", "Risk management")}
        sub={tr(
          "Les chiffres qui te gardent en vie. Non négociables.",
          "The numbers that keep you alive. Non-negotiable.",
        )}
        delay={1}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumField
            label={tr("Risque max / trade", "Max risk / trade")}
            unit="%"
            value={plan.risk.maxRiskPerTradePct}
            onChange={(v) => update((p) => ({ ...p, risk: { ...p.risk, maxRiskPerTradePct: v } }))}
            placeholder="1"
          />
          <NumField
            label={tr("Perte max / jour", "Max daily loss")}
            unit="%"
            value={plan.risk.maxDailyLossPct}
            onChange={(v) => update((p) => ({ ...p, risk: { ...p.risk, maxDailyLossPct: v } }))}
            placeholder="3"
          />
          <NumField
            label={tr("Perte max / semaine", "Max weekly loss")}
            unit="%"
            value={plan.risk.maxWeeklyLossPct}
            onChange={(v) => update((p) => ({ ...p, risk: { ...p.risk, maxWeeklyLossPct: v } }))}
            placeholder="6"
          />
          <NumField
            label={tr("R:R minimum", "Minimum R:R")}
            unit="R"
            value={plan.risk.minRR}
            onChange={(v) => update((p) => ({ ...p, risk: { ...p.risk, minRR: v } }))}
            placeholder="2"
          />
        </div>
      </Section>

      {/* ── Setups ── */}
      <Section
        icon={Layers}
        title={tr("Mes setups", "My setups")}
        sub={tr(
          "Seuls les setups écrits ici méritent ton argent.",
          "Only the setups written here deserve your money.",
        )}
        delay={2}
      >
        <div className="space-y-3">
          {plan.setups.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-xs text-slate-500">
              {tr(
                "Aucun setup défini. Ajoute ton premier setup — nom, conditions, invalidation.",
                "No setup defined yet. Add your first one — name, conditions, invalidation.",
              )}
            </div>
          )}
          {plan.setups.map((s, i) => (
            <SetupCard
              key={s.id}
              setup={s}
              index={i}
              fr={fr}
              onChange={(next) =>
                update((p) => ({
                  ...p,
                  setups: p.setups.map((x) => (x.id === next.id ? next : x)),
                }))
              }
              onDelete={() =>
                update((p) => ({ ...p, setups: p.setups.filter((x) => x.id !== s.id) }))
              }
            />
          ))}
          <button
            onClick={() =>
              update((p) => ({
                ...p,
                setups: [
                  ...p.setups,
                  { id: crypto.randomUUID(), name: "", rules: "", invalidation: "" },
                ],
              }))
            }
            className="w-full h-11 rounded-xl border border-dashed border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/[0.06] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> {tr("Ajouter un setup", "Add a setup")}
          </button>
        </div>
      </Section>

      {/* ── Limits & discipline ── */}
      <Section
        icon={Ban}
        title={tr("Limites & discipline", "Limits & discipline")}
        sub={tr(
          "Les garde-fous qui coupent l'overtrading avant qu'il commence.",
          "The guardrails that stop overtrading before it starts.",
        )}
        delay={3}
      >
        <div className="grid grid-cols-2 gap-3 mb-3">
          <NumField
            label={tr("Trades max / jour", "Max trades / day")}
            unit=""
            value={plan.limits.maxTradesPerDay}
            onChange={(v) => update((p) => ({ ...p, limits: { ...p.limits, maxTradesPerDay: v } }))}
            placeholder="3"
          />
          <NumField
            label={tr("Stop après X pertes", "Stop after X losses")}
            unit=""
            value={plan.limits.stopAfterLosses}
            onChange={(v) => update((p) => ({ ...p, limits: { ...p.limits, stopAfterLosses: v } }))}
            placeholder="2"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-2.5">
          <Toggle
            checked={plan.limits.noNews}
            onChange={(v) => update((p) => ({ ...p, limits: { ...p.limits, noNews: v } }))}
            label={tr(
              "Pas de trade pendant les news à fort impact",
              "No trading during high-impact news",
            )}
          />
          <Toggle
            checked={plan.limits.noRevenge}
            onChange={(v) => update((p) => ({ ...p, limits: { ...p.limits, noRevenge: v } }))}
            label={tr("Pas de revenge trade — jamais", "No revenge trading — ever")}
          />
        </div>
      </Section>

      {/* ── Routine ── */}
      <Section
        icon={SunMedium}
        title={tr("Routine", "Routine")}
        sub={tr(
          "Ce que tu fais avant, après, et chaque semaine.",
          "What you do before, after, and every week.",
        )}
        delay={4}
      >
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={tr("Avant la session", "Pre-market")}>
            <textarea
              value={plan.routine.preMarket}
              onChange={(e) =>
                update((p) => ({ ...p, routine: { ...p.routine, preMarket: e.target.value } }))
              }
              placeholder={tr("Checklist, niveaux clés, news…", "Checklist, key levels, news…")}
              rows={4}
              className={inputCls + " resize-none leading-relaxed"}
            />
          </Field>
          <Field label={tr("Après la session", "Post-market")}>
            <textarea
              value={plan.routine.postMarket}
              onChange={(e) =>
                update((p) => ({ ...p, routine: { ...p.routine, postMarket: e.target.value } }))
              }
              placeholder={tr(
                "Journal, screenshots, note /10…",
                "Journal, screenshots, grade /10…",
              )}
              rows={4}
              className={inputCls + " resize-none leading-relaxed"}
            />
          </Field>
          <Field label={tr("Chaque semaine", "Weekly")}>
            <textarea
              value={plan.routine.weekly}
              onChange={(e) =>
                update((p) => ({ ...p, routine: { ...p.routine, weekly: e.target.value } }))
              }
              placeholder={tr("Revue des trades, stats, leçons…", "Trade review, stats, lessons…")}
              rows={4}
              className={inputCls + " resize-none leading-relaxed"}
            />
          </Field>
        </div>
      </Section>

      {/* ── Anti-bias rules engine (checked live on every trade save) ── */}
      <div className="animate-fade-in-up stagger-5">
        <TradingRulesSection />
      </div>

      {/* ── Goals bridge ── */}
      <button
        onClick={() => setPage("goals")}
        className="w-full glass rounded-2xl p-4 flex items-center gap-3.5 card-premium text-left animate-fade-in-up stagger-6"
      >
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 shrink-0">
          <Target className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white flex items-center gap-1.5">
            {tr("Mes objectifs", "My goals")}
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xs text-slate-500">
            {tr(
              "Fixe tes objectifs — TradeVault génère ton plan d'action mensuel.",
              "Set your goals — TradeVault generates your monthly action plan.",
            )}
          </div>
        </div>
        <span className="text-cyan-400 text-lg shrink-0">→</span>
      </button>
    </div>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors";

function Section({
  icon: Icon,
  title,
  sub,
  delay,
  children,
}: {
  icon: typeof Map;
  title: string;
  sub: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="glass-strong rounded-3xl p-5 md:p-6 animate-fade-in-up"
      style={{ animationDelay: `${delay * 70}ms` }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 truncate">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(inputCls, "pr-8 font-bold tabular-nums")}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-3 border text-left transition-all",
        checked
          ? "bg-cyan-500/10 border-cyan-500/30"
          : "bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14]",
      )}
    >
      <span
        className={cn(
          "w-9 h-5 rounded-full relative transition-colors shrink-0",
          checked ? "bg-cyan-500" : "bg-white/[0.1]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      <span className={cn("text-xs font-medium", checked ? "text-white" : "text-slate-400")}>
        {label}
      </span>
    </button>
  );
}

function MarketChips({
  markets,
  onChange,
  placeholder,
}: {
  markets: string[];
  onChange: (m: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim().toUpperCase();
    if (v && !markets.includes(v)) onChange([...markets, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2 focus-within:border-cyan-500/40 transition-colors">
      {markets.map((m) => (
        <span
          key={m}
          className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/15 border border-cyan-500/25 px-2 py-0.5 text-[11px] font-bold text-cyan-300"
        >
          {m}
          <button
            onClick={() => onChange(markets.filter((x) => x !== m))}
            aria-label={`remove ${m}`}
            className="hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && markets.length) {
            onChange(markets.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={markets.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[90px] bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none py-0.5"
      />
    </div>
  );
}

function SetupCard({
  setup,
  index,
  fr,
  onChange,
  onDelete,
}: {
  setup: PlanSetup;
  index: number;
  fr: boolean;
  onChange: (s: PlanSetup) => void;
  onDelete: () => void;
}) {
  const tr = (f: string, e: string) => (fr ? f : e);
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <input
          value={setup.name}
          onChange={(e) => onChange({ ...setup, name: e.target.value })}
          placeholder={tr("Nom du setup (ex : FVG London)", "Setup name (e.g.: FVG London)")}
          className="flex-1 bg-transparent text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none"
        />
        <button
          onClick={onDelete}
          aria-label={tr("Supprimer le setup", "Delete setup")}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-2.5">
        <textarea
          value={setup.rules}
          onChange={(e) => onChange({ ...setup, rules: e.target.value })}
          placeholder={tr("Conditions d'entrée / confluences…", "Entry conditions / confluences…")}
          rows={3}
          className={inputCls + " resize-none leading-relaxed text-xs"}
        />
        <textarea
          value={setup.invalidation}
          onChange={(e) => onChange({ ...setup, invalidation: e.target.value })}
          placeholder={tr(
            "Invalidation — quand NE PAS le prendre…",
            "Invalidation — when NOT to take it…",
          )}
          rows={3}
          className={inputCls + " resize-none leading-relaxed text-xs"}
        />
      </div>
    </div>
  );
}

function CompletionRing({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 shrink-0 animate-fade-in-up">
      <svg viewBox="0 0 60 60" className="w-16 h-16 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="url(#tpGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="tpGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--tv-accent)" />
            <stop offset="100%" stopColor="var(--tv-highlight)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-white tabular-nums leading-none">{pct}%</span>
        <span className="text-[7px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}
