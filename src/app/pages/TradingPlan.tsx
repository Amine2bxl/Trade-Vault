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
  ChevronRight,
  Scale,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { PageToolbar, SubNav, Textarea, type SubNavItem } from "@/shared/ui";
import { cn } from "../utils/cn";
import type { Page } from "../types";
import {
  EMPTY_PLAN,
  loadTradingPlan,
  planCompletion,
  planSectionCompletion,
  saveTradingPlan,
  type PlanSetup,
  type TradingPlanData,
} from "../utils/tradingPlan";
import TradingRulesSection from "../components/TradingRulesSection";
import { usePageActions } from "../contexts/PageActionsContext";

// Trading Plan — the trader's written constitution. Every field autosaves
// (debounced) to profiles.trading_plan; the completion ring fills as the
// plan takes shape. Copy is inline fr/en like Goals.tsx.

/** Les six parties du plan — l'ordre des onglets. */
const PARTIES = ["mission", "risk", "setups", "limits", "routine", "rules"] as const;
type PartieId = (typeof PARTIES)[number];
const PARTIE_KEY = "tv.planSection";

export default function TradingPlan({ setPage }: { setPage: (p: Page) => void }) {
  const { user } = useAuth();
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const MAX_SETUPS = 5;

  const [plan, setPlan] = useState<TradingPlanData>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    /* PAS D'UTILISATEUR = RIEN À CHARGER, DONC PLUS RIEN À ATTENDRE.
       Le retour anticipé laissait `loading` à `true` pour toujours : la page
       restait sur son rond qui tourne au lieu de rendre un plan vide. Le shell
       garantit un utilisateur en production, mais une page ne doit pas
       dépendre d'une garantie qu'elle ne vérifie pas. */
    if (!user) {
      setLoading(false);
      return;
    }
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

  usePageActions(
    useMemo(
      () => <CompletionRing value={completion} label={tr("complet", "complete")} />,

      [completion, tr],
    ),
  );

  /* ── LA PARTIE OUVERTE ────────────────────────────────────────────────
     Le plan se lisait d'un seul rouleau : six sections `glass-strong` ouvertes
     en même temps, soit quatre écrans de formulaire sur un téléphone, dont le
     trader ne modifie qu'une partie à la fois. Une partie à la fois, donc, et
     son nom écrit dans la barre — il sait où il est, et ce qu'il peut changer
     ici tient dans un écran.

     Le choix survit au changement de page : rouvrir le plan pour finir « Mes
     setups » ne doit pas rendre la main sur « Mission ». */
  const [partie, setPartie] = useState<PartieId>(() => {
    try {
      const v = localStorage.getItem(PARTIE_KEY);
      return PARTIES.some((x) => x === v) ? (v as PartieId) : "mission";
    } catch {
      return "mission";
    }
  });
  const ouvrirPartie = useCallback((id: PartieId) => {
    setPartie(id);
    try {
      localStorage.setItem(PARTIE_KEY, id);
    } catch {
      /* navigation privée : la partie ne se mémorise pas, tout marche quand même */
    }
  }, []);

  /* Chaque onglet porte CE QU'IL LUI RESTE À REMPLIR. Sans ce compte, ouvrir
     les six parties était le seul moyen de savoir laquelle est incomplète. */
  const restes = useMemo(() => planSectionCompletion(plan), [plan]);
  const onglets = useMemo<readonly SubNavItem<PartieId>[]>(
    () => [
      {
        id: "mission",
        label: tr("Mission", "Mission"),
        icon: <Compass className="hidden h-3.5 w-3.5 sm:block" />,
        count: restes.mission[1] - restes.mission[0] || undefined,
      },
      {
        id: "risk",
        label: tr("Risque", "Risk"),
        icon: <ShieldAlert className="hidden h-3.5 w-3.5 sm:block" />,
        count: restes.risk[1] - restes.risk[0] || undefined,
      },
      {
        id: "setups",
        label: tr("Setups", "Setups"),
        icon: <Layers className="hidden h-3.5 w-3.5 sm:block" />,
        count: restes.setups[1] - restes.setups[0] || undefined,
      },
      {
        id: "limits",
        label: tr("Limites", "Limits"),
        icon: <Ban className="hidden h-3.5 w-3.5 sm:block" />,
        count: restes.limits[1] - restes.limits[0] || undefined,
      },
      {
        id: "routine",
        label: tr("Routine", "Routine"),
        icon: <SunMedium className="hidden h-3.5 w-3.5 sm:block" />,
        count: restes.routine[1] - restes.routine[0] || undefined,
      },
      {
        id: "rules",
        label: tr("Règles", "Rules"),
        icon: <Scale className="hidden h-3.5 w-3.5 sm:block" />,
      },
    ],
    [restes, tr],
  );

  if (loading) {
    return (
      <div className="p-4 md:p-5 max-w-[1400px] mx-auto">
        <div className="glass rounded-3xl p-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-3 p-4 md:p-5">
      {/* ══ LA BARRE DU PLAN ═════════════════════════════════════════════
          Les six parties à gauche, l'état d'enregistrement à droite. Elle est
          collante : on passe de « Risque » à « Setups » depuis n'importe quel
          point du formulaire, sans remonter. */}
      <PageToolbar actions={<EtatSauvegarde etat={saveState} tr={tr} />}>
        <SubNav
          items={onglets}
          value={partie}
          onChange={ouvrirPartie}
          ariaLabel={tr("Parties du plan", "Plan sections")}
        />
      </PageToolbar>

      {/* ── Mission & terrain ── */}
      {partie === "mission" && (
        <Section
          icon={Compass}
          title={tr("Mission & terrain de jeu", "Mission & playing field")}
          sub={tr(
            "Pourquoi tu trades, sur quoi, et quand.",
            "Why you trade, what you trade, and when.",
          )}
        >
          <Field
            label={tr("Ma mission (relue les jours de tilt)", "My mission (re-read on tilt days)")}
          >
            <Textarea
              value={plan.mission}
              onChange={(e) => update({ mission: e.target.value })}
              placeholder={tr(
                "Ex : Devenir constant avant de devenir gros. Je protège mon capital d'abord.",
                "E.g.: Become consistent before becoming big. I protect my capital first.",
              )}
              rows={3}
              className={inputCls}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
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
                placeholder={tr(
                  "Ex : 15h30 – 17h30 (ouverture NY)",
                  "E.g.: 9:30 – 11:30 (NY open)",
                )}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>
      )}

      {/* ── Risk management ── */}
      {partie === "risk" && (
        <Section
          icon={ShieldAlert}
          title={tr("Gestion du risque", "Risk management")}
          sub={tr(
            "Les chiffres qui te gardent en vie. Non négociables.",
            "The numbers that keep you alive. Non-negotiable.",
          )}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <NumField
              label={tr("Risque max / trade", "Max risk / trade")}
              unit="%"
              value={plan.risk.maxRiskPerTradePct}
              onChange={(v) =>
                update((p) => ({ ...p, risk: { ...p.risk, maxRiskPerTradePct: v } }))
              }
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
      )}

      {/* ── Setups ── */}
      {partie === "setups" && (
        <Section
          icon={Layers}
          title={tr("Mes setups", "My setups")}
          sub={tr(
            "Seuls les setups écrits ici méritent ton argent.",
            "Only the setups written here deserve your money.",
          )}
          action={
            <span
              className={cn(
                "tv-figure inline-flex h-6 shrink-0 items-center rounded-lg border px-2 text-[11px]",
                plan.setups.length >= MAX_SETUPS
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                  : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-400",
              )}
            >
              {plan.setups.length}/{MAX_SETUPS}
            </span>
          }
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

            {/* Le rappel de concentration n'apparaît qu'à partir du troisième
                setup — avant, il n'a rien à dire. */}
            {plan.setups.length >= 3 && (
              <p
                className={cn(
                  "tv-prose flex items-start gap-2 rounded-xl border px-3 py-2",
                  plan.setups.length >= MAX_SETUPS
                    ? "border-amber-500/20 bg-amber-500/[0.07] text-amber-200/90"
                    : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-400",
                )}
              >
                <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {plan.setups.length >= MAX_SETUPS
                    ? tr(
                        `Tu as atteint la limite de ${MAX_SETUPS} setups. Trop de setups disperse l'attention. Maîtrise ces ${MAX_SETUPS} avant d'en changer.`,
                        `You've reached the ${MAX_SETUPS} setup limit. Too many setups scatter focus. Master these ${MAX_SETUPS} before switching.`,
                      )
                    : tr(
                        `Déjà ${plan.setups.length} setup${plan.setups.length > 1 ? "s" : ""}. Reste concentré : 3-5 setups maîtrisés valent mieux que 10 survolés.`,
                        `Already ${plan.setups.length} setup${plan.setups.length > 1 ? "s" : ""}. Stay focused: 3-5 mastered setups beat 10 half-known ones.`,
                      )}
                </span>
              </p>
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

            {plan.setups.length < MAX_SETUPS && (
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--tv-border-accent)] text-sm font-semibold text-[var(--tv-highlight)] transition hover:bg-[rgb(var(--tv-accent-rgb)/0.07)]"
              >
                <Plus className="h-4 w-4" /> {tr("Ajouter un setup", "Add a setup")}
              </button>
            )}
          </div>
        </Section>
      )}

      {/* ── Limits & discipline ── */}
      {partie === "limits" && (
        <Section
          icon={Ban}
          title={tr("Limites & discipline", "Limits & discipline")}
          sub={tr(
            "Les garde-fous qui coupent l'overtrading avant qu'il commence.",
            "The guardrails that stop overtrading before it starts.",
          )}
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <NumField
              label={tr("Trades max / jour", "Max trades / day")}
              unit=""
              value={plan.limits.maxTradesPerDay}
              onChange={(v) =>
                update((p) => ({ ...p, limits: { ...p.limits, maxTradesPerDay: v } }))
              }
              placeholder="3"
            />
            <NumField
              label={tr("Stop après X pertes", "Stop after X losses")}
              unit=""
              value={plan.limits.stopAfterLosses}
              onChange={(v) =>
                update((p) => ({ ...p, limits: { ...p.limits, stopAfterLosses: v } }))
              }
              placeholder="2"
            />
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
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
      )}

      {/* ── Routine ── */}
      {partie === "routine" && (
        <Section
          icon={SunMedium}
          title={tr("Routine", "Routine")}
          sub={tr(
            "Ce que tu fais avant, après, et chaque semaine.",
            "What you do before, after, and every week.",
          )}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={tr("Avant la session", "Pre-market")}>
              <Textarea
                value={plan.routine.preMarket}
                onChange={(e) =>
                  update((p) => ({ ...p, routine: { ...p.routine, preMarket: e.target.value } }))
                }
                placeholder={tr("Checklist, niveaux clés, news…", "Checklist, key levels, news…")}
                rows={4}
                className={inputCls}
              />
            </Field>
            <Field label={tr("Après la session", "Post-market")}>
              <Textarea
                value={plan.routine.postMarket}
                onChange={(e) =>
                  update((p) => ({ ...p, routine: { ...p.routine, postMarket: e.target.value } }))
                }
                placeholder={tr(
                  "Journal, screenshots, note /10…",
                  "Journal, screenshots, grade /10…",
                )}
                rows={4}
                className={inputCls}
              />
            </Field>
            <Field label={tr("Chaque semaine", "Weekly")}>
              <Textarea
                value={plan.routine.weekly}
                onChange={(e) =>
                  update((p) => ({ ...p, routine: { ...p.routine, weekly: e.target.value } }))
                }
                placeholder={tr(
                  "Revue des trades, stats, leçons…",
                  "Trade review, stats, lessons…",
                )}
                rows={4}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>
      )}

      {/* ── Anti-bias rules engine (checked live on every trade save) ── */}
      {partie === "rules" && (
        <div className="animate-fade-in-up">
          <TradingRulesSection />
        </div>
      )}

      {/* ── Passerelle vers les objectifs ──
          Elle reste visible dans TOUTES les parties : c'est la suite naturelle
          du plan, pas une septième partie. Une ligne, pas une carte de 72px. */}
      <button
        onClick={() => setPage("goals")}
        className="tv-row-toggle glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <Target className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-white">
            {tr("Mes objectifs", "My goals")}
          </span>
          <span className="tv-row-label block truncate">
            {tr(
              "Fixe tes objectifs — TradeVault génère ton plan d'action mensuel.",
              "Set your goals — TradeVault generates your monthly action plan.",
            )}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
    </div>
  );
}

/**
 * L'ÉTAT D'ENREGISTREMENT — dans la barre, à droite, à hauteur constante.
 *
 * Il vivait dans une bande de 16px au-dessus du premier bloc, alignée à
 * droite, et cette bande existait même quand il n'y avait rien à dire : une
 * ligne vide en tête de page, en permanence. Ici il occupe une place qui
 * existe déjà.
 */
function EtatSauvegarde({
  etat,
  tr,
}: {
  etat: "idle" | "saving" | "saved";
  tr: (f: string, e: string) => string;
}) {
  if (etat === "idle") return null;
  return (
    <span
      className={cn(
        "tv-label flex items-center gap-1 pr-1 whitespace-nowrap",
        etat === "saved" ? "text-emerald-400" : "text-slate-500",
      )}
      role="status"
    >
      {etat === "saved" ? (
        <>
          <Check className="h-3 w-3" />
          <span className="hidden sm:inline">{tr("Enregistré", "Saved")}</span>
        </>
      ) : (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="hidden sm:inline">{tr("Enregistrement…", "Saving…")}</span>
        </>
      )}
    </span>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors";

/**
 * UNE PARTIE DU PLAN.
 *
 * Elle portait `glass-strong` — la plaque de ce qui FLOTTE (modale, menu) — et
 * un décalage d'animation calculé sur son rang, hérité du temps où les six
 * s'empilaient. Une seule est rendue à la fois : le rang n'existe plus, et la
 * partie est une carte posée sur la page, pas une fenêtre par-dessus.
 *
 * La vignette d'icône passe de la surface d'accent pleine (`tv-accent-fill`,
 * réservée à ce qui AGIT) au liseré discret : un en-tête de section ne
 * déclenche rien.
 */
function Section({
  icon: Icon,
  title,
  sub,
  action,
  children,
}: {
  icon: typeof Map;
  title: string;
  sub: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass animate-fade-in-up rounded-3xl p-4 md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="card-header-icon shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="tv-title">{title}</h2>
            {action}
          </div>
          <p className="tv-row-label mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="tv-label block text-slate-500 mb-1.5">{label}</span>
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
      <span className="tv-label block text-slate-500 mb-1.5 truncate">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(inputCls, "tv-figure pr-8")}
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
        "flex items-center gap-3 rounded-xl px-3.5 py-3 border text-left transition",
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
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition",
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
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-2.5">
        <Textarea
          value={setup.rules}
          onChange={(e) => onChange({ ...setup, rules: e.target.value })}
          placeholder={tr("Conditions d'entrée / confluences…", "Entry conditions / confluences…")}
          rows={3}
          className={inputCls + " text-xs"}
        />
        <Textarea
          value={setup.invalidation}
          onChange={(e) => onChange({ ...setup, invalidation: e.target.value })}
          placeholder={tr(
            "Invalidation — quand NE PAS le prendre…",
            "Invalidation — when NOT to take it…",
          )}
          rows={3}
          className={inputCls + " text-xs"}
        />
      </div>
    </div>
  );
}

/**
 * LA JAUGE DE COMPLÉTION — horizontale, et non plus un anneau.
 *
 * L'anneau posait trois problèmes qu'une barre n'a pas :
 *   • sur 64px de diamètre, il fallait loger le pourcentage ET son libellé au
 *     centre, en 10 et 12px. On lisait mal les deux ;
 *   • un arc ne se compare pas d'un coup d'œil. Une longueur, si — c'est tout
 *     l'intérêt d'une jauge : voir « il m'en reste un quart » sans compter ;
 *   • il portait une pointe lumineuse en dur (`#a5f3fc`, un cyan de l'ancienne
 *     identité) qui ne suivait aucun thème.
 *
 * Le remplissage garde son dégradé — de l'accent vers le point clair — parce
 * qu'ici il porte une DIRECTION : la barre se lit de gauche à droite, et la
 * lumière l'accompagne. Le liseré de fin marque la tête de la progression sans
 * pastille rapportée.
 */
function CompletionRing({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="animate-fade-in-up w-full min-w-[168px] max-w-[260px] shrink-0 sm:w-auto">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="tv-label text-slate-500">{label}</span>
        <span className="tv-figure text-sm leading-none text-white">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]"
          style={{
            width: `${Math.max(value > 0 ? 4 : 0, pct)}%`,
            background: "linear-gradient(90deg, var(--tv-accent) 0%, var(--tv-highlight) 100%)",
            boxShadow: value > 0 ? "inset -1px 0 0 rgb(255 255 255 / 0.35)" : undefined,
          }}
        />
      </div>
    </div>
  );
}
