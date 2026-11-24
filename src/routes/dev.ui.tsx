import { CaptureAssist } from "@/app/features/capture/CaptureAssist";
import {
  applyProposals,
  ESSENTIAL_TRADE_FIELDS,
  tradeProposals,
  type TradeFormField,
} from "@/app/features/capture/capturePrefill";
import { normalizeExtraction } from "@/domain/capture";
import { enrichCapture } from "@/domain/captureEnrich";
import {
  PageContainer,
  Button,
  Input,
  Field,
  DateField,
  TimeField,
  SelectPicker,
  MultiPicker,
  RangePicker,
  type RangeValue,
} from "@/shared/ui";
import { PAGE_META } from "@/app/shell/navigation";
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { ThemeProvider } from "@/app/contexts/ThemeContext";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { AccountProvider } from "@/app/contexts/AccountContext";
import { LanguageProvider } from "@/app/i18n/LanguageContext";
import { ToastProvider } from "@/app/contexts/ToastContext";
import { ConfirmProvider } from "@/app/contexts/ConfirmContext";
import { PageActionsProvider } from "@/app/contexts/PageActionsContext";
import { previewTrades } from "@/app/utils/previewTrades";
import { handOff } from "@/app/utils/handoff";
import { computeStats } from "@/domain/tradeCalcs";
import { computeQuantStats } from "@/domain/quantStats";
import { isPage, type Page, type Trade } from "@/app/types";
import type { Subscription as AboApercu } from "@/app/hooks/useSubscription";
import PageHead from "@/app/shell/PageHead";
import { PreviewWall } from "@/app/features/billing/PremiumGate";
import { PAGE_VALUE } from "@/app/utils/pricing";
import Sidebar from "@/app/shell/Sidebar";
import MobileNav from "@/app/shell/MobileNav";

/**
 * BANC D'ESSAI VISUEL — `/dev/ui`, EN DÉVELOPPEMENT UNIQUEMENT.
 *
 * Les écrans du produit vivent derrière l'authentification : les vérifier
 * demandait de se connecter avec un vrai compte, ce qui n'est ni reproductible
 * ni possible en revue. Cette page monte la MÊME pile de fournisseurs que
 * `App` (thème, langue, comptes, toasts, confirmation, en-tête de page) et
 * rend un écran choisi, nourri par les trades de démonstration déjà utilisés
 * par le mur d'aperçu — donc sans jeu de données de plus à maintenir.
 *
 * Elle ne rend RIEN hors développement (`import.meta.env.DEV`), et tous les
 * écrans sont importés en différé : le bundle de production ne gagne que cette
 * poignée de lignes.
 */

const TradeModal = lazy(() => import("@/app/features/journal/TradeModal"));
const CalendarPage = lazy(() => import("@/app/features/calendar/CalendarPage"));
const Dashboard = lazy(() => import("@/app/features/dashboard/Dashboard"));
const Journal = lazy(() => import("@/app/features/journal/Journal"));
const Onboarding = lazy(() => import("@/app/features/onboarding/Onboarding"));
const Checklist = lazy(() => import("@/app/features/checklist/Checklist"));
const LotSizeCalculator = lazy(() => import("@/app/features/calculator/LotSizeCalculator"));
const EconomicNews = lazy(() => import("@/app/features/news/EconomicNews"));
const MissedEditor = lazy(() =>
  import("@/app/features/missed/MissedOpportunities").then((m) => ({ default: m.MissedEditor })),
);
const AccountsManager = lazy(() => import("@/app/features/settings/AccountsManager"));
const MissedOpportunities = lazy(() => import("@/app/features/missed/MissedOpportunities"));
const Seasonality = lazy(() => import("@/app/features/seasonality/Seasonality"));
const Reports = lazy(() => import("@/app/features/reports/Reports"));
const Settings = lazy(() => import("@/app/features/settings/Settings"));
const Profile = lazy(() => import("@/app/features/settings/Profile"));
const Appearance = lazy(() => import("@/app/features/settings/Appearance"));
const Brokers = lazy(() => import("@/app/features/brokers/Brokers"));
const Jarvis = lazy(() => import("@/app/features/jarvis/Jarvis"));

const MonteCarlo = lazy(() => import("@/app/features/monte-carlo/MonteCarlo"));
const Analytics = lazy(() => import("@/app/features/analytics/Analytics"));
const Mistakes = lazy(() => import("@/app/features/mistakes/Mistakes"));
const Goals = lazy(() => import("@/app/features/goals/Goals"));
const TradingPlan = lazy(() => import("@/app/features/trading-plan/TradingPlan"));
const Subscription = lazy(() => import("@/app/features/billing/Subscription"));
const Inbox = lazy(() => import("@/app/features/inbox/Inbox"));
const GoalsPlan = lazy(() =>
  import("@/app/features/goals/views").then((m) => ({ default: m.PlanView })),
);

const noop = () => {};

const IDS = [
  "trade",
  "capture",
  "missedform",
  "controls",
  "icons",
  "calendar",
  "dashboard",
  "journal",
  "checklist",
  "calculator",
  "news",
  "missed",
  "seasonality",
  "reports",
  "settings",
  "accounts",
  "profile",
  "appearance",
  "brokers",
  "jarvis",
  "montecarlo",
  "analytics",
  "mistakes",
  "goals",
  "goalsplan",
  "tradingplan",
  "subscription",
  "inbox",
  "onboarding",
] as const;
type EcranId = (typeof IDS)[number];

export const Route = createFileRoute("/dev/ui")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: () => <ClientOnly fallback={null}>{<DevUiPage />}</ClientOnly>,
});

function DevUiPage() {
  /* L'écran choisi survit au rechargement à chaud : sans ça, chaque
     modification de style ramenait le banc sur le premier écran, et il fallait
     re-cliquer avant chaque capture. */
  const [ecran, setEcran] = useState<EcranId>(() => {
    try {
      const v =
        new URLSearchParams(location.search).get("screen") ?? localStorage.getItem("tv.devUi");
      return (IDS as readonly string[]).includes(v ?? "") ? (v as EcranId) : "montecarlo";
    } catch {
      return "montecarlo";
    }
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const already = document.body.classList.contains("tv-app-type");
    document.body.classList.add("tv-app-type");
    return () => {
      if (!already) document.body.classList.remove("tv-app-type");
    };
  }, []);

  const trades = useMemo(
    () => (new URLSearchParams(location.search).get("empty") === "1" ? [] : previewTrades()),
    [],
  );
  if (!import.meta.env.DEV) return null;

  /* Les fournisseurs restent AU-DESSUS de l'état de l'en-tête : posé ici, cet
     état re-rendait toute la pile de fournisseurs à chaque déclaration
     d'actions, la page recréait ses nœuds d'en-tête, les redéclarait… et le
     banc tombait en boucle (« Maximum update depth exceeded »). */
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccountProvider>
          <LanguageProvider>
            <ToastProvider>
              <ConfirmProvider>
                <DevUiBody ecran={ecran} setEcran={setEcran} trades={trades} />
              </ConfirmProvider>
            </ToastProvider>
          </LanguageProvider>
        </AccountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function DevUiBody({
  ecran,
  setEcran,
  trades,
}: {
  ecran: EcranId;
  setEcran: (id: EcranId) => void;
  trades: Trade[];
}) {
  const [actions, setActions] = useState<ReactNode>(null);
  const [lead, setLead] = useState<ReactNode>(null);
  /* Mémorisé : un abonnement fictif recréé à chaque rendu relançait la
     barre de tête de la page, qui relançait ce rendu — une boucle. */
  const apercu = useMemo(() => apercuAbonnement(), []);
  const setHeader = useCallback((slot: "actions" | "lead", node: ReactNode) => {
    if (slot === "lead") setLead(node);
    else setActions(node);
  }, []);
  const head = { actions, lead };
  const previewPage = ecran === "jarvis" ? "insights" : ecran === "goalsplan" ? "goals" : ecran;
  /* `&shell=1` monte le rail et la barre mobile autour de l'écran, comme dans
     `App` : la coque se vérifie avec la page, pas à part. */
  const withShell = new URLSearchParams(location.search).get("shell") === "1";
  const verrou = new URLSearchParams(location.search).get("locked") === "1";
  const shellPage: Page = isPage(previewPage) ? previewPage : "dashboard";

  const body = (
    <PageActionsProvider setActions={setHeader}>
      <div className="min-h-screen bg-[var(--tv-bg)]">
        <div
          data-dev-ui-navigation
          className="flex flex-wrap items-center gap-1.5 border-b border-[var(--tv-border)] px-3 py-2"
        >
          {IDS.map((id) => (
            <button
              key={id}
              onClick={() => {
                setEcran(id);
                try {
                  localStorage.setItem("tv.devUi", id);
                } catch {
                  /* mode privé : le banc marche quand même */
                }
              }}
              className={`tv-subnav-item ${id === ecran ? "tv-subnav-item-active" : ""}`}
            >
              {id}
            </button>
          ))}
        </div>
        {isPage(previewPage) && (
          <PageHead page={previewPage} setPage={noop} actions={head.actions} lead={head.lead} />
        )}
        {/* `&locked=1` pose le mur d'aperçu sur l'écran, comme `PageGate`. */}
        <PreviewWall
          locked={verrou}
          requiredTier="pro"
          onUpgrade={noop}
          benefit={isPage(previewPage) ? PAGE_VALUE[previewPage]?.benefit.en : undefined}
        >
          <Suspense fallback={<div className="p-6 text-sm text-slate-500">…</div>}>
            {ecran === "trade" && <TradeHarness />}
            {ecran === "capture" && <CaptureHarness />}
            {ecran === "missedform" && <MissedHarness />}
            {ecran === "controls" && <ControlHarness />}
            {ecran === "icons" && <IconHarness />}
            {ecran === "calendar" && <CalendarPage trades={trades} />}
            {ecran === "dashboard" && <DashboardHarness trades={trades} />}
            {ecran === "journal" && (
              <Journal
                trades={trades}
                onEdit={noop}
                onDelete={noop}
                onDeleteAll={noop}
                onAdd={noop}
                onOpenMissed={noop}
              />
            )}
            {ecran === "checklist" && (
              <Checklist trades={trades} setPage={noop} onAddTrade={noop} onEditTrade={noop} />
            )}
            {ecran === "calculator" && <LotSizeCalculator onAddTrade={noop} setPage={noop} />}
            {ecran === "news" && <EconomicNews />}
            {ecran === "missed" && <MissedOpportunities />}
            {ecran === "seasonality" && <Seasonality trades={trades} />}
            {ecran === "reports" && <Reports trades={trades} />}
            {ecran === "accounts" && (
              <PageContainer className="max-w-3xl">
                <AccountsManager trades={trades} />
              </PageContainer>
            )}
            {ecran === "settings" && (
              <Settings
                trades={trades}
                onDeleteAll={noop}
                onOpenImport={noop}
                onOpenReports={noop}
              />
            )}
            {ecran === "profile" && <Profile trades={trades} />}
            {ecran === "appearance" && <Appearance />}
            {ecran === "brokers" && <Brokers />}
            {ecran === "jarvis" && <Jarvis />}
            {ecran === "montecarlo" && <MonteCarlo trades={trades} />}
            {ecran === "analytics" && <Analytics trades={trades} />}
            {ecran === "mistakes" && <Mistakes trades={trades} />}
            {ecran === "goals" && <Goals trades={trades} />}
            {ecran === "goalsplan" && <PlanHarness trades={trades} />}
            {ecran === "tradingplan" && <TradingPlan setPage={noop} />}
            {ecran === "subscription" && <Subscription trades={trades} preview={apercu} />}
            {ecran === "inbox" && <Inbox />}
            {ecran === "onboarding" && <Onboarding userId="dev-onboarding" onDone={noop} />}
          </Suspense>
        </PreviewWall>
      </div>
    </PageActionsProvider>
  );
  if (!withShell) return body;
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar page={shellPage} setPage={noop} totalPnl={0} />
      <main className="app-main app-frame relative z-0 flex-1 overflow-y-auto md:my-3 md:mr-3 md:ml-2">
        {body}
      </main>
      <MobileNav page={shellPage} setPage={noop} onAddTrade={noop} />
    </div>
  );
}

/**
 * La vue « plan généré » de Goals demande un plan enregistré et un contexte de
 * mesure : sans utilisateur, la page n'affiche que le sélecteur. Ce montage
 * fabrique les deux à partir des trades de démonstration, pour que la moitié
 * la plus lourde de l'écran soit vérifiable elle aussi.
 */
/**
 * `&sub=` — la page Abonnement dans un état donné, sans session Stripe :
 * `free`, `monthly`, `cancelling`, `pastdue`, `expired`, `lifetime`. Sans le
 * paramètre, la page lit le vrai abonnement (aucun en local : gratuit).
 */
function apercuAbonnement(): AboApercu | null | undefined {
  const voulu = new URLSearchParams(location.search).get("sub");
  if (!voulu) return undefined;
  if (voulu === "free") return null;
  const dans30j = new Date(Date.now() + 30 * 86_400_000);
  const base: AboApercu = {
    plan: "elite_monthly",
    status: "active",
    source: "stripe",
    trialEndsAt: null,
    currentPeriodEnd: dans30j,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
  };
  if (voulu === "cancelling") return { ...base, cancelAtPeriodEnd: true };
  if (voulu === "pastdue") return { ...base, status: "past_due" };
  if (voulu === "expired") return { ...base, status: "expired" };
  if (voulu === "lifetime") return { ...base, plan: "lifetime", currentPeriodEnd: null };
  return base;
}

function PlanHarness({ trades }: { trades: Trade[] }) {
  const stats = computeStats(trades);
  const ctx = {
    stats,
    quant: computeQuantStats(trades, 10000),
    startingBalance: 10000,
    journalRate: 0.6,
  };
  const plan = {
    goals: [
      { id: "g1", kind: "capital" as const, startValue: 10000, targetValue: 20000 },
      { id: "g2", kind: "win_rate" as const, startValue: 39, targetValue: 55 },
    ],
    startedAt: "2026-05-01",
    horizonMonths: 6,
    tasksDone: {},
  };
  return (
    <PageContainer className="max-w-[1000px]">
      <GoalsPlan
        plan={plan}
        ctx={ctx}
        fr={false}
        lang="en"
        busy={false}
        onDelete={noop}
        onToggleTask={noop}
        onManualValue={noop}
        forecast={null}
      />
    </PageContainer>
  );
}

/** Le vrai déclencheur ouvre le vrai formulaire, sans écriture de compte. */
function DashboardHarness({ trades }: { trades: Trade[] }) {
  const [open, setOpen] = useState(false);
  /* Stable, comme `handleAdd` dans `App` : une flèche neuve à chaque rendu
     recréait les actions d'en-tête du Dashboard, qui se redéclaraient… en
     boucle. */
  const openTrade = useCallback(() => setOpen(true), []);
  return (
    <>
      <Dashboard
        trades={trades}
        onAddTrade={openTrade}
        onOpenImport={noop}
        onOpenChecklist={noop}
        onSetObjective={noop}
        onOpenJournal={noop}
      />
      {open && (
        <TradeModal trade={null} onClose={() => setOpen(false)} onSave={() => setOpen(false)} />
      )}
    </>
  );
}

/** Le moteur de capture après une analyse : long NQ lu sur un graphique 5m. */
function CaptureHarness() {
  const x = normalizeExtraction(
    {
      date: { value: "2026-11-20", confidence: "high" },
      symbol: { value: "CME_MINI:NQ1!", confidence: "high", evidence: "NQ1! · 5 · CME" },
      direction: { value: "long", confidence: "high" },
      timeframe: { value: "5", confidence: "high" },
      chartTimezone: { value: "UTC-5", confidence: "medium" },
      entryPrice: { value: 21000, confidence: "high" },
      stopPrice: { value: 20990, confidence: "low" },
      targetPrice: { value: 21030, confidence: "high" },
      exitPrice: { value: 21030, confidence: "high" },
      quantity: { value: 2, confidence: "high" },
      entryTime: { value: "09:47", confidence: "medium" },
      exitTime: { value: "10:12", confidence: "medium" },
      setup: { value: "Silver Bullet", confidence: "medium" },
      confluences: [
        { key: "liquidity_sweep", state: "visual_confirmed" },
        { key: "fvg", state: "visual_confirmed" },
        { key: "mss", state: "probable" },
      ],
      summary: "Long position tool on NQ 5m after a sweep of the 9:30 low; target reached.",
    },
    { target: "trade", note: null, today: "2026-11-24" },
  );
  const run = {
    itemId: null,
    extraction: x,
    derived: enrichCapture(x, { plannedRiskDollars: 250 }),
    cached: false,
  };
  const pristine = {
    date: "2026-11-24",
    symbol: "",
    direction: "long" as const,
    entryTime: "09:30",
    exitTime: "10:00",
    entryPrice: "",
    exitPrice: "",
    initialStop: "",
    initialTarget: "",
    quantity: "",
    riskAmount: "",
    rMultiple: "",
    strategy: "Scalping",
    confluences: [] as string[],
  };
  const form = useRef({ ...pristine, symbol: "ES" });
  return (
    <div className="mx-auto max-w-2xl p-4">
      <CaptureAssist<TradeFormField>
        target="trade"
        paths={["demo/shot.png"]}
        canAddMore
        onAddFiles={noop}
        accountId={null}
        essential={ESSENTIAL_TRADE_FIELDS}
        propose={(ex, d) =>
          tradeProposals(ex, d, { strategies: ["Silver Bullet"], confluences: [] })
        }
        apply={(proposals, opts) => {
          const r = applyProposals(form.current, pristine, proposals, opts);
          form.current = r.next;
          return { applied: r.applied, conflicts: r.conflicts };
        }}
        previewRun={run}
      />
    </div>
  );
}

function TradeHarness() {
  const params = new URLSearchParams(location.search);
  // `?plan` : le formulaire s'ouvre comme depuis la checklist, avec le plan figé.
  const [open, setOpen] = useState(() => {
    if (params.has("plan")) {
      handOff("trade", {
        symbol: "NQ",
        direction: "short",
        riskAmount: "250",
        intentPlan: "SHORT → 21 450 EQL · FVG 21 520",
        planned: { direction: "short", entry: 21520, stop: 21560, target: 21450, scenario: "A" },
      });
    }
    return true;
  });
  const [saved, setSaved] = useState<unknown>(null);
  const imported = params.has("broker");
  const existing = params.has("edit") || imported;
  const trade = existing
    ? {
        ...previewTrades()[0],
        screenshots: [],
        ...(imported
          ? {
              broker: "tradovate",
              quantity: 2,
              entryPrice: 20000,
              exitPrice: 20010,
              fees: 4,
              reviewPending: true,
            }
          : {}),
      }
    : null;
  return (
    <PageContainer>
      <Button onClick={() => setOpen(true)}>Open trade</Button>
      <pre data-trade-saved>{saved ? JSON.stringify(saved) : ""}</pre>
      {open && (
        <TradeModal
          trade={trade}
          onClose={() => setOpen(false)}
          onSave={(trade, meta) => {
            setSaved({ trade, meta });
            setOpen(false);
          }}
        />
      )}
    </PageContainer>
  );
}
function ControlHarness() {
  const [time, setTime] = useState("09:30");
  const [date, setDate] = useState("2026-10-17");
  const [value, setValue] = useState("a");
  const [days, setDays] = useState<string[]>([]);
  const [range, setRange] = useState<RangeValue<"all" | "7d">>({ kind: "preset", preset: "all" });
  return (
    <PageContainer className="max-w-md space-y-4">
      <Field label="Name">
        <Input aria-label="Name" />
      </Field>
      <Field label="Time">
        <TimeField value={time} onChange={setTime} aria-label="Time" doneLabel="Done" />
      </Field>
      <Field label="Date">
        <DateField value={date} onChange={setDate} aria-label="Date" />
      </Field>
      <SelectPicker
        label="Strategy"
        variant="field"
        value={value}
        onChange={setValue}
        options={Array.from({ length: 12 }, (_, i) => ({
          value: String.fromCharCode(97 + i),
          label: `Strategy ${i + 1}`,
        }))}
      />
      <MultiPicker
        label="Days"
        values={days}
        onChange={setDays}
        options={[
          { value: "mon", label: "Monday" },
          { value: "tue", label: "Tuesday" },
        ]}
        allLabel="All"
      />
      <RangePicker
        customLabel="Custom"
        fromLabel="From"
        toLabel="To"
        applyLabel="Apply"
        label="Period"
        value={range}
        onChange={setRange}
        presets={[
          { value: "all", label: "All" },
          { value: "7d", label: "7 days" },
        ]}
      />
      <output data-control-values className="tv-prose">
        {JSON.stringify({ time, date, value, days, range })}
      </output>
    </PageContainer>
  );
}
function IconHarness() {
  return (
    <PageContainer>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        {Object.entries(PAGE_META).map(([key, item]) => {
          const Icon = item.icon;
          return (
            <div key={key} className="glass flex flex-col items-center gap-3 rounded-xl p-4">
              <Icon className="h-7 w-7 text-slate-300" />
              <span className="tv-prose text-slate-500">{key}</span>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}

function MissedHarness() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState<unknown>(null);
  return (
    <PageContainer>
      <Button onClick={() => setOpen(true)}>Open missed setup</Button>
      <pre data-missed-saved>{saved ? JSON.stringify(saved) : ""}</pre>
      {open && (
        <MissedEditor
          value={{
            id: "preview-missed",
            date: "2026-10-17",
            symbol: "",
            estimatedR: 0,
            reasonNotTaken: "",
            whatHappened: "",
            lessonLearned: "",
            nextTimePlan: "",
            screenshots: [],
          }}
          onClose={() => setOpen(false)}
          onSave={(value) => {
            setSaved(value);
            setOpen(false);
          }}
        />
      )}
    </PageContainer>
  );
}
