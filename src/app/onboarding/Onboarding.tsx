import { useCallback, useState, type ReactNode } from "react";
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
} from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { LANG_NAMES, type Lang } from "../i18n/translations";
import { saveOnboarding, saveAccountBalance, type OnboardingData } from "../store";
import ThemeSettings from "../components/ThemeSettings";
import { oc } from "./onboardingCopy";
import logoSrc from "@/assets/tradevault-logo.webp";

/** What the user picked on the quick-start step — App.tsx acts on it. */
export type OnboardingAction = "import" | "demo" | null;

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
    <div className="tv-accent-fill mb-3 grid h-10 w-10 place-items-center rounded-xl">
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
      className={cn(
        "onb-card relative w-full rounded-2xl border p-3.5 text-left transition",
        /* Le SÉLECTIONNÉ du produit : une plaque plus claire et un liseré
           d'accent — le même contrat que la navigation secondaire et que les
           lignes actives de Jarvis. Un aplat cyan sur toute la carte faisait
           lire la sélection comme un état de risque. */
        selected
          ? "border-[var(--tv-border-accent)] bg-[var(--tv-plate-3)]"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] hover:border-[var(--tv-border-strong)] hover:bg-[var(--tv-plate-3)]",
      )}
    >
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
        className={cn(
          "text-[13.5px] font-semibold pr-6",
          selected ? "text-white" : "text-slate-300",
        )}
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
      className={cn(
        "onb-card inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition",
        selected
          ? "border-[var(--tv-border-accent)] bg-[var(--tv-plate-3)] text-white"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-300 hover:border-[var(--tv-border-strong)]",
      )}
    >
      {selected && <Check className="w-3.5 h-3.5 text-cyan-300" strokeWidth={3} />}
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

  /* Sens de la dernière navigation : la transition d'étape doit dire OÙ l'on va.
   * Avancer et reculer produisaient la même entrée, donc le mouvement
   * n'expliquait rien — il décorait. */
  const [dir, setDir] = useState<1 | -1>(1);
  const next = useCallback(() => {
    setDir(1);
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);
  const back = useCallback(() => {
    setDir(-1);
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
        // Taille du compte — alimente le calibreur de risque (best-effort).
        const size = parseFloat(accountSize.replace(/\s/g, ""));
        if (Number.isFinite(size) && size > 0) {
          await saveAccountBalance(userId, size).catch(() => {});
        }
        onDone(action);
      } catch (e) {
        console.error("Failed to save onboarding", e);
        setSaveError(true);
        setSaving(null);
      }
    },
    [
      saving,
      userId,
      onDone,
      style,
      pain,
      target,
      goal,
      experience,
      assets,
      usesIct,
      firstName,
      accountSize,
    ],
  );

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
      className="w-full h-12 rounded-xl text-sm font-bold tv-accent-fill transition active:scale-[0.99] disabled:opacity-60 mt-7 inline-flex items-center justify-center gap-1.5"
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

  return (
    <div
      className="relative h-dvh w-full overflow-hidden flex flex-col"
      style={{ background: "var(--tv-bg)" }}
    >
      {/* Top bar : back · progress · étape */}
      <div className="relative z-20 flex items-center gap-3 px-4 pt-4 md:px-6 max-w-2xl mx-auto w-full">
        {idx > 0 ? (
          <button
            onClick={back}
            aria-label={c.skip}
            className="shrink-0 w-11 h-11 -m-2.5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="relative h-full rounded-full bg-[var(--tv-accent)] transition duration-250 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          >
            <div className="onb-progress-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
        </div>

        <span className="tv-figure shrink-0 text-[10px] text-slate-600">
          {stepNum}/{steps.length}
        </span>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pt-6 overflow-y-auto">
        <div
          key={step}
          className={cn("w-full max-w-lg pb-6", dir === 1 ? "onb-step-fwd" : "onb-step-back")}
        >
          {/* ── 1 · IDENTITÉ ── */}
          {step === "identity" && (
            <div className="text-center">
              <div className="flex justify-center mb-5">
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

              <div className="flex justify-center mb-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 border border-cyan-500/20">
                  <UserRound className="w-4 h-4 text-cyan-300" />
                </div>
              </div>
              <h1 className="tv-title tracking-tight mb-1.5">{t("onb.nameTitle")}</h1>
              <p className="tv-prose text-slate-400 max-w-sm mx-auto mb-4">{t("onb.nameSub")}</p>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
                placeholder={t("onb.namePlaceholder")}
                maxLength={40}
                className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 text-center text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition"
              />

              <div className="mt-6 mb-1">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-cyan-300" />
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
                          ? "bg-cyan-500/15 border-cyan-400/50 text-white"
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
              <div className="grid grid-cols-3 gap-2.5 onb-in">
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
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={accountSize}
                      onChange={(e) => setAccountSize(e.target.value)}
                      placeholder="25000"
                      className="tv-figure h-11 w-full rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] pl-7 pr-3 text-center text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-[var(--tv-border-accent)]"
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
                <div className="relative mb-4">
                  <span className="absolute -inset-2 rounded-2xl bg-cyan-500/30 blur-md" />
                  <div className="relative grid h-12 w-12 place-items-center rounded-2xl tv-accent-fill">
                    <Bell className="w-6 h-6" />
                  </div>
                </div>
              </div>
              <h2 className="tv-title tracking-tight mb-1">{t("onb.notifyTitle")}</h2>
              <p className="tv-prose text-slate-400 max-w-md mx-auto mb-4">{t("onb.notifySub")}</p>

              <div className="onb-in">
                <button
                  onClick={enableNotify}
                  disabled={notifBusy}
                  className="onb-card w-full flex items-center justify-center gap-2 rounded-2xl p-3 border bg-cyan-500/[0.1] border-cyan-400/40 hover:bg-cyan-500/[0.15] transition disabled:opacity-60 text-xs font-bold text-white"
                >
                  {notifBusy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Bell className="w-5 h-5 text-cyan-300" />
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
                  <div className="relative mb-4">
                    <span className="absolute -inset-2 rounded-2xl bg-teal-500/30 blur-md" />
                    <div className="relative grid h-12 w-12 place-items-center rounded-2xl tv-accent-fill shadow-xl">
                      <Rocket className="w-6 h-6" />
                    </div>
                  </div>
                </div>
                <h2 className="tv-title tracking-tight mb-1.5">{c.startTitle}</h2>
                <p className="tv-prose text-slate-400 max-w-md mx-auto mb-4">{c.startSub}</p>
              </div>

              {saveError && (
                <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3.5 py-3 flex items-center gap-2.5">
                  <p className="flex-1 text-[12.5px] text-red-300">{t("onb.saveError")}</p>
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
                  className="onb-card relative flex items-start gap-3.5 rounded-2xl p-4 border text-left bg-cyan-500/[0.1] border-cyan-400/40 hover:bg-cyan-500/[0.15] transition disabled:opacity-60"
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
                      {c.startImport} <ArrowRight className="w-3.5 h-3.5 text-cyan-300" />
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
                      <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                    ) : (
                      <PlayCircle className="w-5 h-5 text-cyan-300" />
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
    </div>
  );
}
