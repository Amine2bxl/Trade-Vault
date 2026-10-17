import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SelectPicker } from "@/shared/ui";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  PlayCircle,
  Loader2,
  Compass,
  Target,
  Layers,
  GraduationCap,
  UserRound,
  Globe,
  ShieldAlert,
  SlidersHorizontal,
  Bell,
  BellOff,
  Rocket,
  Wallet,
  Palette,
  Plus,
  Coins,
  LockKeyhole,
  Radio,
} from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";
import { LANG_NAMES, type Lang } from "@/app/i18n/translations";
import { saveOnboarding, saveAccountBalance, saveCurrency, type OnboardingData } from "@/app/store";
import ThemeSettings from "../settings/ThemeSettings";
import { oc } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo-128.png";
import {
  CURRENCIES,
  currencySymbol,
  getCurrency,
  parseCurrency,
  setCurrency,
  type CurrencyCode,
} from "@/shared/currency";

/** What the user picked on the quick-start step — App.tsx acts on it. */
export type OnboardingAction = "import" | "demo" | null;
type LaunchState = { action: OnboardingAction } | null;

// Onboarding 2.0 — UNE question par écran, design premium TradeVault.
//   1. IDENTITÉ   — prénom + langue
//   2. STYLE      — scalping / day / swing        (simple)
//   3. MARCHÉS    — futures/forex/stocks/options/crypto  (MULTI)
//   4. NIVEAU     — nouveau / intermédiaire / aguerri / prop  (simple)
//   5. OBJECTIF   — régularité / prop / discipline / temps plein / en parallèle
//   6. FAIBLESSES — émotions / constance / sur-trading / risque / journalisation (MULTI)
//   7. RÉGLAGES   — cible mensuelle % + capital + thème
//   8. NOTIFICATIONS — permission push (ré-intégrée, non bloquante)
//   9. C'EST PARTI — Import CSV / Démo / Démarrer à zéro
// Chaque écran est court (un tap) : progress bar, back, skip si optionnel.
type StepKey =
  | "identity"
  | "style"
  | "markets"
  | "experience"
  | "goal"
  | "pain"
  | "settings"
  | "notify"
  | "start";

const STEP_CODES = [
  "ID-01",
  "STY-02",
  "MKT-03",
  "EXP-04",
  "MSN-05",
  "LEK-06",
  "CFG-07",
  "NTF-08",
  "QST-09",
] as const;

function OnboardingField() {
  const stars = useMemo(() => {
    let seed = 17;
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: 86 }, () => ({
      x: random() * 100,
      y: random() * 100,
      opacity: 0.08 + random() * 0.24,
      radius: random() > 0.9 ? 1.1 : 0.55,
    }));
  }, []);

  return (
    <svg className="onb-data-field pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="onb-grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0H0V64" fill="none" stroke="white" strokeOpacity="0.025" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#onb-grid)" />
      {stars.map((star, index) => (
        <circle
          key={index}
          cx={`${star.x}%`}
          cy={`${star.y}%`}
          r={star.radius}
          fill="white"
          opacity={star.opacity}
        />
      ))}
    </svg>
  );
}

function MarketPulse({ step }: { step: number }) {
  const path = useMemo(() => {
    let seed = step * 37 + 11;
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    let y = 66;
    const points: string[] = [];
    for (let index = 0; index <= 40; index += 1) {
      y = Math.max(18, Math.min(106, y + (random() - 0.48) * 20 - step * 0.11));
      points.push(`${index * 25},${y.toFixed(1)}`);
    }
    return `M${points.join(" L")}`;
  }, [step]);

  return (
    <svg
      key={step}
      className="onb-market-pulse pointer-events-none absolute inset-x-0 bottom-[7%] h-28 w-full"
      viewBox="0 0 1000 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={path} fill="none" stroke="white" strokeOpacity="0.055" strokeWidth="1" />
      <path
        d={path}
        fill="none"
        stroke="var(--tv-accent)"
        strokeOpacity="0.42"
        strokeWidth="1"
        pathLength={1}
        className="onb-pulse-trace"
      />
    </svg>
  );
}

const EMPTY: OnboardingData = {
  goal: null,
  assets: [],
  style: null,
  experience: null,
  usesIct: false,
  brokers: [],
  pain: null,
  monthlyTarget: null,
  onboardedAt: null,
  skipped: false,
};

/* ── Petits blocs réutilisables du design system ────────────────────────── */

/**
 * L'EN-TÊTE D'UNE ÉTAPE.
 *
 * Un écran d'onboarding vit dans `h-dvh` : tout ce que l'en-tête prend, les
 * choix ne l'ont pas. Il en prenait ~150px — une pastille de 56px cerclée d'un
 * halo cyan flou, 20px de marge, un titre de 24px, puis 28px avant les options.
 * Sur un téléphone de 667px, les six cartes d'un choix commençaient sous la
 * ligne de flottaison : le trader devait défiler pour savoir qu'il y avait
 * quelque chose à choisir. C'est de la friction pure, à l'écran où il y en a
 * le moins besoin.
 *
 * L'en-tête tient maintenant en ~95px, et le halo est parti — la règle du
 * système est que rien ne rayonne, et un flou coloré derrière une pastille
 * n'ajoutait aucune information à un écran dont le seul travail est de poser
 * une question.
 */
function IconBadge({ icon: Icon }: { icon: typeof Target }) {
  return (
    <div className="onb-badge tv-accent-fill mb-4 grid h-11 w-11 place-items-center rounded-xl">
      <Icon className="h-5 w-5" />
    </div>
  );
}

function ScreenShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center">
        <IconBadge icon={icon} />
      </div>
      <h2 className="mb-1.5 text-xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle && (
        <p className="mx-auto mb-5 max-w-md text-[13px] leading-relaxed text-slate-400">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

function OptionCard({
  selected,
  multi,
  onClick,
  label,
  desc,
}: {
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "onb-card relative w-full rounded-2xl border p-3.5 text-left transition",
        /* Le SÉLECTIONNÉ du produit : une plaque plus claire et un liseré
           d'accent — le même contrat que la navigation secondaire et que les
           lignes actives de Jarvis. Un aplat cyan sur toute la carte faisait
           lire la sélection comme un état de risque. */
        selected
          ? "onb-selected border-[var(--tv-border-accent)] bg-[var(--tv-plate-3)]"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] hover:border-[var(--tv-border-strong)] hover:bg-[var(--tv-plate-3)]",
      )}
    >
      {selected && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden
        >
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx="16"
            fill="none"
            stroke="var(--tv-accent)"
            strokeWidth="1.5"
            pathLength={1}
            className="onb-lock-sweep"
          />
        </svg>
      )}
      {multi && (
        <span
          className={cn(
            "absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full border transition",
            selected ? "tv-accent-fill border-transparent" : "border-white/15",
          )}
        >
          {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </span>
      )}
      <div
        className={cn("text-[13px] font-semibold pr-6", selected ? "text-white" : "text-slate-300")}
      >
        {label}
      </div>
      {desc && <div className="text-[11px] text-slate-500 leading-tight mt-1">{desc}</div>}
    </button>
  );
}

function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "onb-card inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition",
        selected
          ? "onb-selected border-[var(--tv-border-accent)] bg-[var(--tv-plate-3)] text-white"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-300 hover:border-[var(--tv-border-strong)]",
      )}
    >
      {selected && <Check className="w-3.5 h-3.5 text-[var(--tv-highlight)]" strokeWidth={3} />}
      {label}
    </button>
  );
}

/* ── Composant principal ────────────────────────────────────────────────── */

export default function Onboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (action?: OnboardingAction) => void;
}) {
  const { lang, setLang, t } = useT();
  const c = oc(lang);
  const { subscribe } = usePushNotifications();
  const { createTheme } = useTheme();
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState<OnboardingAction | "fresh" | null>(null);
  const [launching, setLaunching] = useState<LaunchState>(null);
  const [saveError, setSaveError] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  // Réponses (toutes optionnelles).
  const [firstName, setFirstName] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [experience, setExperience] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [pain, setPain] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [usesIct, setUsesIct] = useState(false);
  // Taille du compte — Jarvis calibre le risque réel. Apparence — thème de l'app.
  const [accountSize, setAccountSize] = useState("");
  // Devise du journal — étiquette de chaque montant de l'app.
  const [currency, setCurrencyChoice] = useState<CurrencyCode>(() => getCurrency());

  const steps: StepKey[] = [
    "identity",
    "style",
    "markets",
    "experience",
    "goal",
    "pain",
    "settings",
    "notify",
    "start",
  ];
  const step = steps[Math.min(idx, steps.length - 1)];
  const progress = (idx + 1) / steps.length;
  const stepNum = Math.min(idx + 1, steps.length);

  const next = useCallback(() => {
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);
  const back = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  const toggle = <T,>(setter: (prev: T[]) => void, arr: T[], value: T) =>
    setter(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);

  // Atomic save : on ne quitte QUE si la sauvegarde réussit (sinon retry).
  const finish = useCallback(
    async (action: OnboardingAction) => {
      if (saving) return;
      setSaving(action ?? "fresh");
      setSaveError(false);
      const parsed = parseFloat(target.replace(",", "."));
      const monthlyTarget = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : null;
      try {
        await saveOnboarding(
          userId,
          {
            ...EMPTY,
            style,
            pain: pain.length ? pain.join(", ") : null,
            monthlyTarget,
            goal,
            experience,
            assets,
            usesIct,
          },
          { skipped: false, firstName },
        );
        // Devise globale : enregistrée sur le profil, appliquée tout de suite.
        await saveCurrency(userId, currency).catch(() => {});
        setCurrency(currency);
        // Taille du compte — alimente le calibreur de risque (best-effort).
        const size = parseFloat(accountSize.replace(/\s/g, ""));
        if (Number.isFinite(size) && size > 0) {
          await saveAccountBalance(userId, size).catch(() => {});
        }
        // Comme dans la référence : l'application ne coupe pas brutalement
        // après le dernier choix. Elle confirme l'identité du trader pendant
        // un battement, puis révèle le dashboard déjà prêt.
        setLaunching({ action });
      } catch (e) {
        console.error("Failed to save onboarding", e);
        setSaveError(true);
        setSaving(null);
      }
    },
    [
      saving,
      userId,
      style,
      pain,
      target,
      goal,
      experience,
      assets,
      usesIct,
      firstName,
      accountSize,
      currency,
    ],
  );

  useEffect(() => {
    if (!launching) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => onDone(launching.action), reduced ? 120 : 2_300);
    return () => window.clearTimeout(timer);
  }, [launching, onDone]);

  // Permission push, ré-intégrée — jamais bloquante.
  const enableNotify = useCallback(async () => {
    if (notifBusy) return;
    setNotifBusy(true);
    try {
      await subscribe();
    } catch {
      /* denied / unsupported — réglable dans Settings */
    } finally {
      setNotifBusy(false);
      next();
    }
  }, [notifBusy, subscribe, next]);

  const langs = Object.entries(LANG_NAMES) as [Lang, string][];
  const launchTitle = c.personalWelcome.replace("{name}", firstName.trim() || "Trader");
  const stepLabels = [
    t("onb.nameTitle"),
    c.styleTitle,
    c.assetsTitle,
    c.expTitle,
    c.goalTitle,
    c.painTitle,
    c.targetTitle,
    t("onb.notifyTitle"),
    c.startTitle,
  ];
  const previewCapital = Math.max(0, Number.parseFloat(accountSize.replace(/\s/g, "")) || 25_000);
  const previewTarget = Math.max(1, Number.parseFloat(target.replace(",", ".")) || 4);
  const previewPnl = Math.round(previewCapital * Math.min(previewTarget / 100, 0.08) * 0.62);
  const formatPreviewMoney = (value: number) =>
    new Intl.NumberFormat(lang === "fr" ? "fr-BE" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  const styleLabels: Record<string, string> = {
    scalping: c.sScalper,
    daytrading: c.sDay,
    swing: c.sSwing,
  };
  const assetLabels: Record<string, string> = {
    futures: c.aFutures,
    forex: c.aForex,
    stocks: c.aStocks,
    options: c.aOptions,
    crypto: c.aCrypto,
  };
  const goalLabels: Record<string, string> = {
    consistency: c.gCons,
    prop_challenge: c.gProp,
    discipline: c.gDisc,
    fulltime: c.gFull,
    side: c.gSide,
  };
  const launchRecap = [
    style ? styleLabels[style] : null,
    assets.length ? assets.map((asset) => assetLabels[asset] ?? asset).join(" · ") : null,
    goal ? goalLabels[goal] : null,
  ].filter(Boolean) as string[];

  const ContinueBtn = ({
    onClick,
    children,
    disabled,
  }: {
    onClick: () => void;
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="onb-cta w-full h-12 text-[15px] font-bold tv-accent-fill active:scale-[0.99] disabled:opacity-60 mt-7 inline-flex items-center justify-center gap-1.5"
    >
      {children}
    </button>
  );

  const SkipBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      className="w-full mt-2.5 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
    >
      {label}
    </button>
  );

  if (launching) {
    return (
      <div
        className="tv-public onb-root relative flex h-dvh w-full items-center justify-center overflow-hidden px-5 py-5"
        style={{ background: "var(--tv-bg)" }}
        role="status"
        aria-live="polite"
      >
        <OnboardingField />
        <MarketPulse step={steps.length} />
        <div className="relative z-10 w-full max-w-2xl">
          <div className="flex items-center gap-4">
            <div className="onb-launch-logo onb-radar relative grid h-16 w-16 shrink-0 place-items-center">
              <span className="absolute inset-0 rounded-full border border-[var(--tv-border-strong)]" />
              <span className="absolute inset-2 rounded-full border border-[var(--tv-border)]" />
              <img src={logoSrc} alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            </div>
            <div className="min-w-0">
              <div className="onb-launch-copy flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--tv-highlight)]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                {c.systemComplete}
              </div>
              <h1 className="onb-launch-title mt-1 truncate text-2xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
                {launchTitle}
              </h1>
            </div>
          </div>

          <div className="onb-launch-recap mt-5 flex flex-wrap gap-1.5">
            {launchRecap.map((item, index) => (
              <span
                key={item}
                className="rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2 py-1 text-[11px] text-slate-400"
                style={{ "--onb-order": index } as CSSProperties}
              >
                {item}
              </span>
            ))}
          </div>

          <div className="onb-dashboard-reveal mt-5 overflow-hidden rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)]">
            <div className="flex items-center justify-between border-b border-[var(--tv-border)] px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <img
                  src={logoSrc}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] rounded"
                />
                {t("dashboard.title")}
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">
                <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />{" "}
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--tv-border)] sm:grid-cols-4">
              <div className="px-4 py-3">
                <div className="tv-label text-slate-600">{c.capitalLabel}</div>
                <div className="tv-figure mt-1 truncate text-xl text-white">
                  {formatPreviewMoney(previewCapital + previewPnl)}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="tv-label text-slate-600">P&amp;L</div>
                <div className="tv-figure mt-1 truncate text-xl text-[var(--tv-chart-green)]">
                  +{formatPreviewMoney(previewPnl)}
                </div>
              </div>
              <div className="hidden px-4 py-3 sm:block">
                <div className="tv-label text-slate-600">{t("dashboard.profitFactor")}</div>
                <div className="tv-figure mt-1 text-xl text-white">1.84</div>
              </div>
              <div className="hidden px-4 py-3 sm:block">
                <div className="tv-label text-slate-600">{t("dashboard.tradingDays")}</div>
                <div className="tv-figure mt-1 text-xl text-white">18</div>
              </div>
            </div>
            <div className="border-t border-[var(--tv-border)] px-4 pb-3 pt-2.5">
              <div className="mb-2 flex justify-between text-[10px] text-slate-500">
                <span>{t("dashboard.equityCurve")}</span>
                <span>{c.revealTitle}</span>
              </div>
              <svg
                viewBox="0 0 600 70"
                preserveAspectRatio="none"
                className="h-16 w-full"
                aria-hidden
              >
                <path
                  d="M0 58 L40 55 L75 59 L110 48 L145 50 L185 38 L220 42 L255 29 L295 34 L335 22 L370 27 L410 15 L450 19 L490 10 L530 14 L570 5 L600 8"
                  fill="none"
                  stroke="var(--tv-chart-green)"
                  strokeWidth="1.5"
                  pathLength={1}
                  className="onb-pulse-trace"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="tv-public onb-root relative flex h-dvh w-full overflow-hidden"
      style={{ background: "var(--tv-bg)" }}
    >
      <OnboardingField />
      <MarketPulse step={idx} />

      <aside className="relative z-20 hidden w-64 shrink-0 flex-col border-r border-[var(--tv-border)] bg-[rgb(var(--tv-bg-rgb)/0.72)] px-5 py-6 backdrop-blur-sm lg:flex">
        <div className="flex items-center gap-2.5">
          <img
            src={logoSrc}
            alt=""
            width={27}
            height={27}
            className="h-[27px] w-[27px] rounded-md"
          />
          <span className="text-[15px] font-semibold tracking-tight text-white">TradeVault</span>
        </div>
        <div className="mt-10 font-mono text-[9px] uppercase tracking-[0.22em] text-slate-600">
          {c.systemModules}
        </div>
        <ol className="mt-3 space-y-0.5">
          {stepLabels.map((label, index) => {
            const state = index < idx ? "done" : index === idx ? "active" : "idle";
            return (
              <li key={STEP_CODES[index]}>
                <button
                  type="button"
                  disabled={index > idx}
                  onClick={() => setIdx(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[12px] transition-colors disabled:cursor-default",
                    state === "active"
                      ? "bg-[var(--tv-plate-3)] text-white"
                      : state === "done"
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-700",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border",
                      state === "done"
                        ? "border-[var(--tv-accent)] bg-[var(--tv-accent)] text-[var(--tv-bg)]"
                        : state === "active"
                          ? "border-[var(--tv-accent)]"
                          : "border-[var(--tv-border-strong)]",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    ) : state === "active" ? (
                      <span className="onb-status-dot h-1.5 w-1.5 rounded-full bg-[var(--tv-accent)]" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="font-mono text-[8px] text-slate-700">{STEP_CODES[index]}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto space-y-2 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-3 font-mono text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">SYSTEM</span>
            <span className="flex items-center gap-1.5 text-[var(--tv-highlight)]">
              <Radio className="onb-status-dot h-3 w-3" /> {c.systemCalibrating}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>SYNC</span>
            <span className="tv-figure tv-figure-secondary text-[10px]">
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>LAT</span>
            <span className="tv-figure tv-figure-secondary text-[10px]">{12 + idx} ms</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>VAULT</span>
            <LockKeyhole className="h-3 w-3" />
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top bar : retour · progression segmentée · étape */}
        <header className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 px-4 pt-4 md:px-6">
          {idx > 0 ? (
            <button
              onClick={back}
              aria-label={c.skip}
              className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-5" />
          )}

          <div className="flex flex-1 gap-1">
            {steps.map((item, index) => (
              <span
                key={item}
                className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--tv-accent)] transition-[width] duration-500"
                  style={{ width: index < idx ? "100%" : index === idx ? "55%" : "0%" }}
                />
              </span>
            ))}
          </div>

          <span className="tv-figure tv-figure-secondary shrink-0 text-[10px] text-slate-600">
            {String(stepNum).padStart(2, "0")}/{String(steps.length).padStart(2, "0")}
          </span>
        </header>

        {/* Body */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 pt-4">
          <div key={step} className="onb-step-enter w-full max-w-[540px] pb-6">
            <div className="onb-system-kicker mb-4 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
              <span>STEP {String(stepNum).padStart(2, "0")}</span>
              <span className="text-slate-800">/</span>
              <span className="text-[var(--tv-highlight)]">{STEP_CODES[idx]}</span>
            </div>
            {/* ── 1 · IDENTITÉ ── */}
            {step === "identity" && (
              <div className="text-center">
                <div className="onb-launch-logo mb-5 flex justify-center">
                  <div className="relative">
                    <img
                      src={logoSrc}
                      alt="TradeVault"
                      width={64}
                      height={64}
                      className="relative w-16 h-16 rounded-2xl"
                    />
                  </div>
                </div>

                <div className="onb-launch-title mb-3 flex justify-center">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgb(var(--tv-accent-rgb)/0.15)] border border-[rgb(var(--tv-accent-rgb)/0.20)]">
                    <UserRound className="w-4 h-4 text-[var(--tv-highlight)]" />
                  </div>
                </div>
                <div className="onb-launch-copy">
                  <h1 className="tv-title mb-1.5 tracking-tight">{t("onb.nameTitle")}</h1>
                  <p className="tv-prose mx-auto mb-4 max-w-sm text-slate-400">
                    {t("onb.nameSub")}
                  </p>
                </div>

                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder={t("onb.namePlaceholder")}
                  maxLength={40}
                  className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 text-center text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-[rgb(var(--tv-accent-rgb)/0.40)] focus:ring-1 focus:ring-[rgb(var(--tv-accent-rgb)/0.20)] transition"
                />

                <div className="mt-6 mb-1">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-[var(--tv-highlight)]" />
                    <span className="text-xs font-semibold text-slate-400">{c.langTitle}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 onb-in">
                    {langs.map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => setLang(code)}
                        className={cn(
                          "onb-card rounded-xl px-2.5 py-2.5 border text-center text-xs font-semibold",
                          code === lang
                            ? "bg-[rgb(var(--tv-accent-rgb)/0.15)] border-[rgb(var(--tv-accent-rgb)/0.50)] text-white"
                            : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20",
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <ContinueBtn onClick={next}>
                  {t("onb.nameCta")} <ArrowRight className="w-4 h-4" />
                </ContinueBtn>
              </div>
            )}

            {/* ── 2 · STYLE ── */}
            {step === "style" && (
              <ScreenShell icon={Compass} title={c.styleTitle} subtitle={c.styleSub}>
                {/* UNE COLONNE SUR TÉLÉPHONE, trois à partir de 640px.
                  Trois `OptionCard` côte à côte sur un écran de 360px laissent
                  environ 77px de texte par carte, rembourrage déduit — assez
                  pour le libellé, pas pour la description qui l'accompagne :
                  elle partait sur quatre ou cinq lignes, et les trois cartes
                  prenaient des hauteurs différentes. Empilées, elles se lisent
                  comme les lignes d'un sélecteur natif, ce qui est exactement
                  ce qu'elles sont. Les autres grilles de cet écran tiennent en
                  deux colonnes ; celle-ci est la seule à en demander trois. */}
                <div className="grid grid-cols-1 gap-2.5 onb-in sm:grid-cols-3">
                  {(
                    [
                      ["scalping", c.sScalper, c.sScalperD],
                      ["daytrading", c.sDay, c.sDayD],
                      ["swing", c.sSwing, c.sSwingD],
                    ] as const
                  ).map(([id, label, desc]) => (
                    <OptionCard
                      key={id}
                      selected={style === id}
                      onClick={() => setStyle(style === id ? null : id)}
                      label={label}
                      desc={desc}
                    />
                  ))}
                </div>
                <ContinueBtn onClick={next}>{c.cont}</ContinueBtn>
                <SkipBtn onClick={next} label={c.skip} />
              </ScreenShell>
            )}

            {/* ── 3 · MARCHÉS (multi) ── */}
            {step === "markets" && (
              <ScreenShell icon={Layers} title={c.assetsTitle} subtitle={c.assetsSub}>
                <div className="flex flex-wrap justify-center gap-2.5 onb-in">
                  {(
                    [
                      ["futures", c.aFutures],
                      ["forex", c.aForex],
                      ["stocks", c.aStocks],
                      ["options", c.aOptions],
                      ["crypto", c.aCrypto],
                    ] as const
                  ).map(([id, label]) => (
                    <Chip
                      key={id}
                      selected={assets.includes(id)}
                      onClick={() => toggle(setAssets, assets, id)}
                      label={label}
                    />
                  ))}
                </div>
                <ContinueBtn onClick={next}>{c.cont}</ContinueBtn>
                <SkipBtn onClick={next} label={c.skip} />
              </ScreenShell>
            )}

            {/* ── 4 · NIVEAU ── */}
            {step === "experience" && (
              <ScreenShell icon={GraduationCap} title={c.expTitle} subtitle={c.expSub}>
                <div className="grid grid-cols-2 gap-2.5 onb-in">
                  {(
                    [
                      ["new", c.eNew, c.eNewD],
                      ["intermediate", c.eInt, c.eIntD],
                      ["seasoned", c.eSea, c.eSeaD],
                      ["funded", c.eFund, c.eFundD],
                    ] as const
                  ).map(([id, label, desc]) => (
                    <OptionCard
                      key={id}
                      selected={experience === id}
                      onClick={() => setExperience(experience === id ? null : id)}
                      label={label}
                      desc={desc}
                    />
                  ))}
                </div>
                <ContinueBtn onClick={next}>{c.cont}</ContinueBtn>
                <SkipBtn onClick={next} label={c.skip} />
              </ScreenShell>
            )}

            {/* ── 5 · OBJECTIF ── */}
            {step === "goal" && (
              <ScreenShell icon={Target} title={c.goalTitle} subtitle={c.goalSub}>
                <div className="grid grid-cols-2 gap-2.5 onb-in">
                  {(
                    [
                      ["consistency", c.gCons, c.gConsD],
                      ["prop_challenge", c.gProp, c.gPropD],
                      ["discipline", c.gDisc, c.gDiscD],
                      ["fulltime", c.gFull, c.gFullD],
                      ["side", c.gSide, c.gSideD],
                    ] as const
                  ).map(([id, label, desc]) => (
                    <OptionCard
                      key={id}
                      selected={goal === id}
                      onClick={() => setGoal(goal === id ? null : id)}
                      label={label}
                      desc={desc}
                    />
                  ))}
                </div>
                <ContinueBtn onClick={next}>{c.cont}</ContinueBtn>
                <SkipBtn onClick={next} label={c.skip} />
              </ScreenShell>
            )}

            {/* ── 6 · FAIBLESSES (multi) ── */}
            {step === "pain" && (
              <ScreenShell icon={ShieldAlert} title={c.painTitle} subtitle={c.painSub}>
                <div className="grid grid-cols-2 gap-2.5 onb-in">
                  {(
                    [
                      ["emotions", c.pEmo, c.pEmoD],
                      ["consistency", c.pCons, c.pConsD],
                      ["overtrading", c.pOver, c.pOverD],
                      ["risk", c.pRisk, c.pRiskD],
                      ["journaling", c.pJour, c.pJourD],
                    ] as const
                  ).map(([id, label, desc]) => (
                    <OptionCard
                      key={id}
                      multi
                      selected={pain.includes(id)}
                      onClick={() => toggle(setPain, pain, id)}
                      label={label}
                      desc={desc}
                    />
                  ))}
                </div>
                <ContinueBtn onClick={next}>{c.cont}</ContinueBtn>
                <SkipBtn onClick={next} label={c.skip} />
              </ScreenShell>
            )}

            {/* ── 7 · OBJECTIF + CAPITAL + APPARENCE ── */}
            {step === "settings" && (
              <ScreenShell icon={SlidersHorizontal} title={c.targetTitle} subtitle={c.targetSub}>
                {/* LES DEUX CHIFFRES.
                  C'étaient deux cartes `glass-strong` centrées de ~140px de
                  haut : une icône, un libellé, puis un champ de 56px — pour
                  saisir un nombre. Une carte qui flotte (`glass-strong` est la
                  matière des modales) autour d'un champ de formulaire, c'est
                  de la présence donnée à ce qui n'en demande pas. Deux champs
                  étiquetés, sur une rangée, et l'étape entière remonte de
                  ~80px — ce qui compte sur un écran qui ne défile pas. */}
                {/* LA DEVISE — avant le capital, qui s'écrit dedans. */}
                <div className="onb-in mx-auto mb-3 block max-w-md text-left">
                  <span className="tv-label mb-1 flex items-center gap-1.5 text-slate-400">
                    <Coins className="h-3.5 w-3.5" />
                    {t("settings.currency")}
                  </span>
                  <SelectPicker
                    variant="field"
                    label={t("settings.currency")}
                    value={currency}
                    onChange={(v) => setCurrencyChoice(parseCurrency(v))}
                    className="rounded-xl text-[14px]"
                    searchLabel={t("picker.search")}
                    options={CURRENCIES.map((cur) => ({
                      value: cur.code,
                      label: `${cur.code} · ${currencySymbol(cur.code)}`,
                      hint: cur.name,
                    }))}
                  />
                </div>
                <div className="onb-in mx-auto mb-5 grid max-w-md grid-cols-2 gap-3">
                  <label className="text-left">
                    <span className="tv-label mb-1 flex items-center gap-1.5 text-slate-400">
                      <Target className="h-3.5 w-3.5" />
                      {c.targetLabel}
                    </span>
                    <span className="relative block">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step={0.5}
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder="3"
                        className="tv-figure h-11 w-full rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 pr-8 text-center text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-[var(--tv-border-accent)]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        %
                      </span>
                    </span>
                  </label>
                  <label className="text-left">
                    <span className="tv-label mb-1 flex items-center gap-1.5 text-slate-400">
                      <Wallet className="h-3.5 w-3.5" />
                      {c.capitalLabel}
                    </span>
                    <span className="relative block">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        {currencySymbol(currency)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={accountSize}
                        onChange={(e) => setAccountSize(e.target.value)}
                        placeholder="25000"
                        className="tv-figure h-11 w-full rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] pr-3 text-center text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-[var(--tv-border-accent)]"
                        style={{
                          paddingLeft: `${1.1 + currencySymbol(currency).length * 0.55}rem`,
                        }}
                      />
                    </span>
                  </label>
                </div>
                <p className="tv-row-label mb-6 text-center">{c.settingsHint}</p>

                {/* Thème */}
                <div className="mb-2 flex items-center justify-center gap-2">
                  <Palette className="h-4 w-4 text-[var(--tv-highlight)]" />
                  <h3 className="tv-title">{t("onb.appearance")}</h3>
                </div>
                <p className="tv-prose mb-3 text-center text-slate-400">{t("onb.appearanceSub")}</p>
                <div className="mb-3 max-w-full overflow-visible">
                  <ThemeSettings />
                </div>
                <button
                  onClick={() =>
                    createTheme({
                      name: c.themeCustomName,
                      primary: "#06b6d4",
                      secondary: "#10b981",
                      highlight: "#22d3ee",
                    })
                  }
                  /* Une action SECONDAIRE de l'étape — elle ne peut pas porter la
                   même présence que « Continuer », qui est la seule chose à
                   faire ici. Plaque neutre, hauteur d'un contrôle, et le « + »
                   n'est plus écrit deux fois (l'icône le disait déjà). */
                  className="mb-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-[13px] font-semibold text-slate-300 transition-colors hover:border-[var(--tv-border-strong)] hover:text-white"
                >
                  <Plus className="h-4 w-4" /> {c.themeCustomCta}
                </button>

                <button
                  onClick={next}
                  className="w-full h-12 rounded-xl text-sm font-bold tv-accent-fill transition"
                >
                  {c.cont}
                </button>
                <button
                  onClick={next}
                  className="w-full mt-2.5 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {c.skip}
                </button>
              </ScreenShell>
            )}

            {/* ── 8 · NOTIFICATIONS ── */}
            {step === "notify" && (
              <div className="text-center">
                <div className="flex justify-center">
                  <div className="mb-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl tv-accent-fill">
                      <Bell className="w-6 h-6" />
                    </div>
                  </div>
                </div>
                <h2 className="tv-title tracking-tight mb-1">{t("onb.notifyTitle")}</h2>
                <p className="tv-prose text-slate-400 max-w-md mx-auto mb-4">
                  {t("onb.notifySub")}
                </p>

                <div className="onb-in">
                  <button
                    onClick={enableNotify}
                    disabled={notifBusy}
                    className="onb-card w-full flex items-center justify-center gap-2 rounded-2xl p-3 border bg-[rgb(var(--tv-accent-rgb)/0.1)] border-[rgb(var(--tv-accent-rgb)/0.40)] hover:bg-[rgb(var(--tv-accent-rgb)/0.15)] transition disabled:opacity-60 text-xs font-bold text-white"
                  >
                    {notifBusy ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Bell className="w-5 h-5 text-[var(--tv-highlight)]" />
                    )}
                    {t("onb.notifyCta")}
                  </button>
                  <button
                    onClick={next}
                    disabled={notifBusy}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <BellOff className="w-3.5 h-3.5" /> {t("onb.notifyLater")}
                  </button>
                </div>
                <p className="tv-row-label mt-3">{t("onb.notifySettings")}</p>
              </div>
            )}

            {/* ── 9 · C'EST PARTI ── */}
            {step === "start" && (
              <div>
                <div className="text-center">
                  <div className="flex justify-center">
                    <div className="mb-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl tv-accent-fill">
                        <Rocket className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                  <h2 className="tv-title tracking-tight mb-1.5">{c.startTitle}</h2>
                  <p className="tv-prose text-slate-400 max-w-md mx-auto mb-4">{c.startSub}</p>
                </div>

                {saveError && (
                  <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3.5 py-3 flex items-center gap-2.5">
                    <p className="flex-1 text-[13px] text-red-300">{t("onb.saveError")}</p>
                    <button
                      onClick={() => setSaveError(false)}
                      className="text-xs font-bold text-red-200 hover:text-white transition-colors"
                    >
                      {t("onb.saveRetry")}
                    </button>
                  </div>
                )}

                <div className="grid gap-3 onb-in">
                  {/* Primary: CSV import */}
                  <button
                    onClick={() => finish("import")}
                    disabled={!!saving}
                    className="onb-card relative flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-[rgb(var(--tv-accent-rgb)/0.1)] border-[rgb(var(--tv-accent-rgb)/0.40)] hover:bg-[rgb(var(--tv-accent-rgb)/0.15)] transition disabled:opacity-60"
                  >
                    <div className="w-11 h-11 rounded-xl tv-accent-fill flex items-center justify-center shrink-0">
                      {saving === "import" ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        {c.startImport}{" "}
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--tv-highlight)]" />
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed mt-0.5">
                        {c.startImportD}
                      </div>
                    </div>
                  </button>

                  {/* Alternative: demo trades */}
                  <button
                    onClick={() => finish("demo")}
                    disabled={!!saving}
                    className="onb-card flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition disabled:opacity-60"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                      {saving === "demo" ? (
                        <Loader2 className="w-5 h-5 text-[var(--tv-highlight)] animate-spin" />
                      ) : (
                        <PlayCircle className="w-5 h-5 text-[var(--tv-highlight)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{c.startDemo}</div>
                      <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        {c.startDemoD}
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => finish(null)}
                  disabled={!!saving}
                  className="w-full mt-5 py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {saving === "fresh" ? c.startWorking : c.startFresh}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
