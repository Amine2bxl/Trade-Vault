import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  Cable,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileUp,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useConfirm } from "@/app/contexts/ConfirmContext";
import { usePageLead } from "@/app/contexts/PageActionsContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import type { TKey } from "@/app/i18n/translations";
import {
  deleteBrokerConnection,
  loadBrokerAccounts,
  loadBrokerConnections,
  updateBrokerAccount,
  updateBrokerConnection,
  type BrokerAccount,
  type BrokerConnection,
} from "@/app/store/brokers";
import {
  brokerCapabilities,
  completeTradovateOAuth,
  startTradovateOAuth,
  syncBrokers,
  type BrokerCapabilities,
} from "@/backend/brokers.functions";
import { announceBrokerImport, announceBrokersChanged } from "./useBrokerSync";
import { SyncCelebration, type CelebrationState } from "./SyncCelebration";
import { Badge, Button, Card, FIELD_BASE, SelectPicker, cn } from "@/shared/ui";
import { currencySymbol } from "@/shared/currency";

/**
 * BROKERS — brancher ses comptes une fois, ne plus jamais saisir un trade.
 *
 * ── UN SEUL PARCOURS : CHEZ LE BROKER ──
 * « Se connecter avec Tradovate » REDIRIGE vers la page de connexion de
 * Tradovate. Le trader s'y identifie chez eux ; identifiant, mot de passe et
 * e-mail restent dans leur base. Il revient ici avec un code que le serveur
 * échange contre un jeton d'accès en LECTURE SEULE (voir
 * `backend/tradovate.server.ts`). Aucun champ de cette page ne demande un
 * secret broker : il n'y en a plus.
 *
 * ── CE QUE LA PAGE DOIT FAIRE SENTIR ──
 * La confiance d'abord : ce que TradeVault lit, ce qu'il ne fait jamais,
 * écrit en clair à côté du bouton — pas dans une FAQ. Puis, au retour, la
 * preuve : les comptes trouvés et les trades importés (`SyncCelebration`).
 *
 * Palier Pro : sans lui, la page reste lisible (c'est elle qui vend la
 * fonctionnalité), le bouton devient « Débloquer avec Pro », et les connexions
 * existantes restent affichées et SUPPRIMABLES — jamais retenues en otage.
 */

type Env = "live" | "demo";

const ERROR_KEYS: Record<string, TKey> = {
  crypto_unavailable: "brokers.err.crypto",
  oauth_unavailable: "brokers.err.oauth",
  schema_missing: "brokers.err.schema",
  server_error: "brokers.err.server",
  denied: "brokers.err.denied",
  access_denied: "brokers.err.denied",
  exchange_failed: "brokers.err.exchange",
  rate_limited: "brokers.err.rateLimited",
  broker_unreachable: "brokers.err.unreachable",
  invalid_state: "brokers.err.state",
  reauth_required: "brokers.err.reauth",
  permission_denied: "brokers.err.permission",
  insert_failed: "brokers.err.insert",
  plan_limit: "brokers.err.planLimit",
};

/** Les échecs qu'un nouvel essai peut réparer (le trader a refusé, le lien a
 *  expiré, Tradovate n'a pas répondu) — les autres attendent la configuration
 *  du serveur, et « Réessayer » mentirait. */
const RETRYABLE = new Set([
  "denied",
  "access_denied",
  "exchange_failed",
  "broker_unreachable",
  "invalid_state",
  "server_error",
]);

/**
 * La tentative en cours — QUOI on connectait, jamais le `state` OAuth.
 *
 * La page TradeVault est remplacée par celle de Tradovate : au retour, tout
 * l'état du composant est perdu. « Réessayer » doit pourtant rejouer la MÊME
 * tentative — reconnecter le login existant, avec ses comptes rattachés, et
 * non en créer un second. Le `state`, lui, n'est JAMAIS gardé ni substitué :
 * seul celui que Tradovate renvoie dans l'URL prouve que le code vient de
 * cet aller-retour (sinon un code obtenu par un tiers sur SON compte
 * Tradovate pourrait être greffé sur la session du trader).
 */
interface Attempt {
  connectionId?: string;
  environment: Env;
  defaultAccountId: string | null;
  defaultRisk: number | null;
}
const ATTEMPT_KEY = "tv:tradovate-attempt";
const NO_CAPS: BrokerCapabilities = {
  encryption: false,
  oauth: false,
  schema: true,
  ready: false,
  setup: null,
};

function rememberAttempt(attempt: Attempt | null): void {
  try {
    if (attempt) sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // Stockage bloqué : « Réessayer » repartira des options par défaut.
  }
}

function recallAttempt(): Attempt | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    const a = raw ? (JSON.parse(raw) as Partial<Attempt>) : null;
    if (!a || (a.environment !== "live" && a.environment !== "demo")) return null;
    return {
      connectionId: typeof a.connectionId === "string" ? a.connectionId : undefined,
      environment: a.environment,
      defaultAccountId: typeof a.defaultAccountId === "string" ? a.defaultAccountId : null,
      defaultRisk: typeof a.defaultRisk === "number" ? a.defaultRisk : null,
    };
  } catch {
    return null;
  }
}

/** Erreurs de première synchro qui ne se répareront PAS seules : la
 *  connexion est en erreur, le trader doit agir. */
const BLOCKING_SYNC = new Set(["permission_denied", "reauth_required"]);

/** Le serveur refuse hors Pro avec ce préfixe stable (`requireProPlan`). */
const isPlanRequired = (e: unknown) =>
  String((e as Error)?.message ?? e).includes("PLAN_LIMIT_PRO");
const openUpgrade = () => window.dispatchEvent(new CustomEvent("tv:upgrade"));

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function Brokers() {
  const { user } = useAuth();
  const { accounts, activeAccount } = useAccounts();
  const { t, lang } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { can, loading: subLoading } = useSubscription();
  const locale = intlLocale(lang);
  // Tant que l'abonnement charge, on ne verrouille rien : afficher un cadenas
  // puis le retirer donnerait à un abonné l'impression d'avoir perdu l'accès.
  const isPro = subLoading || can("brokerSync");

  const getCaps = useServerFn(brokerCapabilities);
  const startOAuth = useServerFn(startTradovateOAuth);
  const completeOAuth = useServerFn(completeTradovateOAuth);
  const sync = useServerFn(syncBrokers);

  const [caps, setCaps] = useState<BrokerCapabilities | null>(null);
  const [connections, setConnections] = useState<BrokerConnection[] | null>(null);
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);

  // ── Options de connexion (repliées : le défaut convient à presque tous) ──
  const [showOptions, setShowOptions] = useState(false);
  const [env, setEnv] = useState<Env>("live");
  const [targetAccount, setTargetAccount] = useState<string>(activeAccount?.id ?? "");
  const [defaultRisk, setDefaultRisk] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  // La tentative que « Réessayer » rejoue (voir `Attempt`).
  const lastAttempt = useRef<Attempt | null>(null);

  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Cable className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="tv-label shrink-0 text-slate-400">{t("brokers.title")}</span>
        <span aria-hidden className="hidden h-3.5 w-px shrink-0 bg-white/[0.12] md:block" />
        <span className="tv-row-label hidden truncate md:block">{t("brokers.subtitle")}</span>
      </div>
    ),
    [t],
  );
  usePageLead(lead);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [conns, accs] = await Promise.all([
        loadBrokerConnections(user.id),
        loadBrokerAccounts(user.id),
      ]);
      setConnections(conns);
      setBrokerAccounts(accs);
    } catch {
      // Tables absentes (migration pas encore passée) ou réseau : la page
      // reste utilisable, elle montre simplement « aucune connexion ».
      setConnections([]);
      setBrokerAccounts([]);
    }
  }, [user]);

  useEffect(() => {
    void reload();
    getCaps()
      .then(setCaps)
      .catch(() => setCaps(NO_CAPS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    if (!targetAccount && activeAccount) setTargetAccount(activeAccount.id);
  }, [activeAccount, targetAccount]);

  // Retour arrière depuis la page Tradovate : le navigateur restaure la page
  // telle qu'elle était (cache « back-forward »), bouton encore en train de
  // tourner. On la rend de nouveau utilisable.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setRedirecting(false);
      setBusyId(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // ── Retour de chez Tradovate : `code` + `state`, ou `error` si refusé. ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const denied = params.get("error");
    if (!code && !denied) return;
    // Le `state` vient de l'URL, et d'elle seule (voir `Attempt`).
    const state = params.get("state");
    lastAttempt.current = recallAttempt();
    rememberAttempt(null);
    // On nettoie l'URL tout de suite : un code OAuth ne se rejoue pas, et il
    // n'a rien à faire dans l'historique ni dans un lien partagé.
    for (const k of ["code", "state", "error", "error_description"]) params.delete(k);
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${rest ? `?${rest}` : ""}`,
    );
    if (!code || !state) {
      setCelebration({
        phase: "failed",
        messageKey: code ? "brokers.err.state" : "brokers.err.denied",
        action: "retry",
      });
      return;
    }
    setCelebration({ phase: "working" });
    completeOAuth({ data: { code, state } })
      .then(async (res) => {
        if (!res.ok) {
          setCelebration({
            phase: "failed",
            messageKey: ERROR_KEYS[res.error ?? ""] ?? "brokers.err.unknown",
            action: RETRYABLE.has(res.error ?? "") ? "retry" : undefined,
          });
          return;
        }
        // Un premier import peut porter des semaines d'historique : il arrive
        // au journal, sans ouvrir vingt formulaires d'affilée.
        if (res.inserted.length) announceBrokerImport(res.inserted, { autoOpen: false });
        announceBrokersChanged();
        await reload();
        // Connecté, mais la lecture est refusée ou le jeton déjà rejeté : la
        // connexion est en erreur et ne sera pas retentée seule. Le dire,
        // plutôt qu'un « TradeVault réessaie tout seul » faux.
        if (res.syncError && BLOCKING_SYNC.has(res.syncError)) {
          if (res.connectionId) {
            lastAttempt.current = {
              connectionId: res.connectionId,
              environment: res.environment ?? "live",
              defaultAccountId: null,
              defaultRisk: null,
            };
          }
          setCelebration({
            phase: "failed",
            messageKey: ERROR_KEYS[res.syncError] ?? "brokers.err.unknown",
            action: res.syncError === "reauth_required" ? "retry" : undefined,
          });
          return;
        }
        setCelebration({
          phase: "done",
          accounts: res.accounts,
          trades: res.inserted.length,
          unmapped: res.unmappedAccounts,
          syncPending: res.syncError !== null && res.syncError !== "plan_limit",
        });
      })
      .catch((e) =>
        setCelebration(
          isPlanRequired(e)
            ? { phase: "failed", messageKey: "brokers.proTitle", action: "upgrade" }
            : { phase: "failed", messageKey: "brokers.err.unknown", action: "retry" },
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riskValue = defaultRisk.trim() === "" ? null : Math.max(0, Number(defaultRisk) || 0);

  /** Part chez Tradovate pour une tentative donnée. */
  const startAttempt = async (attempt: Attempt) => {
    if (!isPro) return openUpgrade();
    setRedirecting(true);
    if (attempt.connectionId) setBusyId(attempt.connectionId);
    try {
      const res = await startOAuth({
        data: attempt.connectionId
          ? {
              connectionId: attempt.connectionId,
              environment: attempt.environment,
              timezone: browserTimeZone(),
            }
          : {
              environment: attempt.environment,
              defaultRisk: attempt.defaultRisk,
              defaultAccountId: attempt.defaultAccountId,
              timezone: browserTimeZone(),
            },
      });
      if (!res.url) {
        toast(t(ERROR_KEYS[res.error ?? ""] ?? "brokers.err.unknown"), "error");
        setRedirecting(false);
        setBusyId(null);
        return;
      }
      rememberAttempt(attempt);
      // Même onglet : la page de connexion de Tradovate remplace TradeVault,
      // puis Tradovate renvoie ici. Pas de fenêtre surgissante à bloquer.
      window.location.assign(res.url);
    } catch (e) {
      if (isPlanRequired(e)) openUpgrade();
      else toast(t("brokers.err.unknown"), "error");
      setRedirecting(false);
      setBusyId(null);
    }
  };

  /** Nouvelle connexion (options du formulaire), ou reconnexion d'un login. */
  const goToTradovate = (reconnect?: BrokerConnection) =>
    startAttempt(
      reconnect
        ? {
            connectionId: reconnect.id,
            environment: reconnect.environment,
            defaultAccountId: null,
            defaultRisk: null,
          }
        : { environment: env, defaultAccountId: targetAccount || null, defaultRisk: riskValue },
    );

  const syncNow = async (id: string) => {
    if (!isPro) return openUpgrade();
    setBusyId(id);
    try {
      const res = await sync({ data: { connectionId: id, force: true } });
      if (res.inserted.length) announceBrokerImport(res.inserted, { autoOpen: true });
      const err = res.errors[0]?.error;
      if (err) toast(t(ERROR_KEYS[err] ?? "brokers.err.unknown"), "error");
      else
        toast(
          res.inserted.length
            ? t("brokers.syncedNew").replace("{n}", String(res.inserted.length))
            : t("brokers.syncedNothing"),
          "success",
        );
      await reload();
    } catch (e) {
      if (isPlanRequired(e)) openUpgrade();
      else toast(t("brokers.err.unknown"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const togglePause = async (c: BrokerConnection) => {
    if (!user) return;
    setBusyId(c.id);
    try {
      await updateBrokerConnection(user.id, c.id, {
        status: c.status === "disabled" ? "active" : "disabled",
      });
      announceBrokersChanged();
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (c: BrokerConnection) => {
    if (!user) return;
    const ok = await confirm(t("brokers.disconnectConfirm"), {
      danger: true,
      detail: t("brokers.disconnectDetail"),
      confirmLabel: t("brokers.disconnect"),
    });
    if (!ok) return;
    await deleteBrokerConnection(user.id, c.id);
    announceBrokersChanged();
    await reload();
  };

  const mapAccount = async (ba: BrokerAccount, accountId: string) => {
    if (!user) return;
    const value = accountId || null;
    setBrokerAccounts((prev) => prev.map((a) => (a.id === ba.id ? { ...a, accountId: value } : a)));
    try {
      await updateBrokerAccount(user.id, ba.id, { accountId: value });
    } catch {
      toast(t("brokers.err.unknown"), "error");
      void reload();
    }
  };

  const toggleAccount = async (ba: BrokerAccount) => {
    if (!user) return;
    setBrokerAccounts((prev) =>
      prev.map((a) => (a.id === ba.id ? { ...a, enabled: !a.enabled } : a)),
    );
    try {
      await updateBrokerAccount(user.id, ba.id, { enabled: !ba.enabled });
    } catch {
      void reload();
    }
  };

  const accountOptions = [
    { value: "", label: t("brokers.chooseAccount") },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const fmtWhen = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : t("brokers.never");

  // Le serveur ne sait pas (encore) connecter : on le dit honnêtement, à
  // TOUS — abonné ou non. Vendre Pro pour un bouton qui échouerait après la
  // redirection serait une promesse fausse.
  const blockedKey: TKey | null =
    caps === null
      ? null
      : !caps.schema
        ? "brokers.err.schema"
        : !caps.encryption
          ? "brokers.unavailable"
          : !caps.oauth
            ? "brokers.err.oauth"
            : null;
  const blocked = blockedKey !== null;
  const hasConnections = (connections?.length ?? 0) > 0;
  const openImport = () => window.dispatchEvent(new CustomEvent("tv:open-import"));

  const connectButton = (
    <Button
      onClick={() => void goToTradovate()}
      disabled={redirecting || caps === null || blocked}
      className="w-full sm:w-auto"
    >
      {redirecting || caps === null ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : blocked ? (
        <Lock className="h-4 w-4" />
      ) : isPro ? (
        <ExternalLink className="h-4 w-4" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
      {blocked ? t("brokers.soon") : isPro ? t("brokers.connectOAuth") : t("brokers.proCta")}
    </Button>
  );

  const blockedNote = blockedKey && (
    <div className="space-y-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5">
      <p className="flex items-start gap-2 text-xs leading-snug text-slate-400">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        {t(blockedKey)}
      </p>
      <Button variant="subtle" size="sm" onClick={openImport}>
        <FileUp className="h-3.5 w-3.5" />
        {t("brokers.importCsv")}
      </Button>
    </div>
  );

  const options = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        aria-expanded={showOptions}
        className="tv-label inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-300"
      >
        {t("brokers.options")}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", showOptions && "rotate-180")}
        />
      </button>
      {showOptions && (
        <div className="animate-fade-in-up grid gap-3 sm:grid-cols-3">
          <div>
            <span className="tv-label mb-1.5 block text-slate-400">{t("brokers.environment")}</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-0)] p-1">
              {(["live", "demo"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  aria-pressed={env === e}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold transition-colors",
                    env === e ? "tv-accent-fill" : "text-slate-400 hover:text-white",
                  )}
                >
                  {e === "live" ? t("brokers.envLive") : t("brokers.envDemo")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="tv-label mb-1.5 block text-slate-400">{t("brokers.journalInto")}</span>
            <SelectPicker
              label={t("brokers.journalInto")}
              value={targetAccount}
              options={accountOptions.slice(1)}
              onChange={setTargetAccount}
              variant="field"
              width="100%"
            />
          </div>
          <div>
            <span className="tv-label mb-1.5 block text-slate-400">{t("brokers.defaultRisk")}</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                {currencySymbol()}
              </span>
              <input
                value={defaultRisk}
                onChange={(e) => setDefaultRisk(e.target.value)}
                inputMode="decimal"
                placeholder={t("brokers.defaultRiskPlaceholder")}
                className={cn(FIELD_BASE, "tv-figure h-10 text-[13px]")}
                style={{ paddingLeft: `${1.1 + currencySymbol().length * 0.55}rem` }}
              />
            </div>
          </div>
          <p className="text-xs leading-snug text-slate-500 sm:col-span-3">
            {t("brokers.envHint")}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1040px] space-y-4 p-4 md:p-5">
      {/* ── PAS ENCORE CONNECTÉ : la promesse, le geste, la confiance ── */}
      {!hasConnections && connections !== null && (
        <Card pad="none" className="animate-fade-in-up overflow-hidden">
          <div className="grid lg:grid-cols-[1.35fr_1fr]">
            <div className="space-y-5 p-5 md:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="tv-title text-lg">{t("brokers.heroTitle")}</h2>
                  {!isPro && <Badge variant="accent">{t("credits.plan.pro")}</Badge>}
                </div>
                <p className="tv-prose mt-1.5 max-w-xl text-slate-400">{t("brokers.heroBody")}</p>
              </div>

              <Steps t={t} />

              <div className="space-y-2.5">
                {connectButton}
                <p className="flex items-start gap-1.5 text-xs leading-snug text-slate-500">
                  <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--tv-accent)]" />
                  {isPro || blocked ? t("brokers.redirectNote") : t("brokers.proBody")}
                </p>
                {blockedNote}
              </div>

              {isPro && !blocked && caps !== null && options}
            </div>
            <TrustPanel
              t={t}
              className="border-t border-[var(--tv-border)] lg:border-l lg:border-t-0"
            />
          </div>
        </Card>
      )}

      {/* ── LA CONFIGURATION, pour l'administrateur seulement ── */}
      {caps?.setup && <SetupChecklist setup={caps.setup} ready={caps.ready} t={t} />}

      {/* ── LES CONNEXIONS ── */}
      {connections === null ? (
        <div className="h-48 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]" />
      ) : (
        <>
          {hasConnections && !isPro && (
            <Card pad="default" className="animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-[var(--tv-accent)]" />
                    <span className="text-sm font-bold text-white">{t("brokers.proTitle")}</span>
                  </div>
                  <p className="tv-row-label mt-0.5">{t("brokers.proPaused")}</p>
                </div>
                <Button size="sm" onClick={openUpgrade}>
                  {t("brokers.proCta")}
                </Button>
              </div>
            </Card>
          )}
          {connections.map((c) => (
            <ConnectionCard
              key={c.id}
              c={c}
              accounts={brokerAccounts.filter((a) => a.connectionId === c.id)}
              accountOptions={accountOptions}
              busy={busyId === c.id}
              isPro={isPro}
              lastSync={t("brokers.lastSync").replace("{when}", fmtWhen(c.lastSuccessAt))}
              onSync={() => void syncNow(c.id)}
              onReconnect={() => void goToTradovate(c)}
              onPause={() => void togglePause(c)}
              onDisconnect={() => void disconnect(c)}
              onMap={(ba, v) => void mapAccount(ba, v)}
              onToggle={(ba) => void toggleAccount(ba)}
              t={t}
            />
          ))}
        </>
      )}

      {/* ── LE CATALOGUE ── */}
      <Card pad="default" className="animate-fade-in-up">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tv-label text-slate-500">{t("brokers.catalogTitle")}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <BrokerTile
            name="Tradovate"
            desc={t("brokers.tradovateDesc")}
            badge={
              hasConnections ? (
                <Badge variant="profit">
                  <Check className="h-3 w-3" />
                  {t("brokers.connectedBadge")}
                </Badge>
              ) : (
                <Badge variant="accent">{t("brokers.available")}</Badge>
              )
            }
            action={
              hasConnections ? (
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => void goToTradovate()}
                  disabled={redirecting || blocked}
                >
                  {isPro ? <Plus className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {t("brokers.addLogin")}
                </Button>
              ) : null
            }
          />
          {(
            [
              ["Rithmic", "brokers.rithmicDesc"],
              ["NinjaTrader", "brokers.ninjaDesc"],
              ["ProjectX", "brokers.projectxDesc"],
            ] as const
          ).map(([name, desc]) => (
            <BrokerTile
              key={name}
              name={name}
              desc={t(desc)}
              muted
              badge={<Badge variant="neutral">{t("brokers.planned")}</Badge>}
            />
          ))}
        </div>
      </Card>

      {/* Déjà connecté : la confiance reste écrite, plus bas, au même endroit. */}
      {hasConnections && (
        <Card pad="none" className="animate-fade-in-up overflow-hidden">
          <TrustPanel t={t} wide />
        </Card>
      )}

      {/* Ce que fait la synchro, en clair — sans promesse. */}
      <Card pad="default" className="animate-fade-in-up">
        <span className="tv-label text-slate-500">{t("brokers.howTitle")}</span>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
          <li>• {t("brokers.how1")}</li>
          <li>• {t("brokers.how2")}</li>
          <li>• {t("brokers.how3")}</li>
          <li>• {t("brokers.how4")}</li>
        </ul>
      </Card>

      <SyncCelebration
        state={celebration}
        onRetry={() => {
          setCelebration(null);
          // La MÊME tentative : un login en reconnexion reste le même login.
          const attempt = lastAttempt.current;
          void (attempt ? startAttempt(attempt) : goToTradovate());
        }}
        onUpgrade={() => {
          setCelebration(null);
          openUpgrade();
        }}
        onClose={() => setCelebration(null)}
        onOpenJournal={() => {
          setCelebration(null);
          window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: "journal" } }));
        }}
      />
    </div>
  );
}

type T = (k: TKey) => string;

/**
 * Ce qui manque pour que « Se connecter avec Tradovate » mène quelque part —
 * montré au SEUL administrateur (`ADMIN_EMAILS`, vérifié côté serveur). Des
 * NOMS de variables, jamais leur valeur ; et l'adresse de retour exacte à
 * déclarer chez Tradovate, puisqu'elle doit correspondre au caractère près.
 */
function SetupChecklist({
  setup,
  ready,
  t,
}: {
  setup: NonNullable<BrokerCapabilities["setup"]>;
  ready: boolean;
  t: T;
}) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(setup.redirectUri);
      toast(t("brokers.setupCopied"), "success");
    } catch {
      // Presse-papiers refusé : l'adresse reste sélectionnable à la main.
    }
  };
  return (
    <Card pad="default" className="animate-fade-in-up">
      <div className="flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-slate-500" />
        <span className="tv-label text-slate-500">{t("brokers.setupTitle")}</span>
        {ready && (
          <Badge variant="profit">
            <Check className="h-3 w-3" />
            {t("brokers.setupReady")}
          </Badge>
        )}
      </div>
      <div className="mt-3 space-y-3 text-xs leading-snug text-slate-400">
        {setup.missing.length > 0 && (
          <div>
            <p>{t("brokers.setupMissing")}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {setup.missing.map((name) => (
                <li
                  key={name}
                  className="tv-figure rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-0.5 text-amber-300"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p>{t("brokers.setupRedirect")}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="tv-figure min-w-0 flex-1 select-all truncate rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2.5 py-1.5 text-slate-200">
              {setup.redirectUri}
            </code>
            <Button
              variant="subtle"
              size="sm"
              className="w-8 px-0"
              onClick={() => void copy()}
              aria-label={t("brokers.setupCopy")}
              title={t("brokers.setupCopy")}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p>{t("brokers.setupPerms")}</p>
        <p>{t("brokers.setupPro")}</p>
        {setup.derivedKey && <p className="text-slate-500">{t("brokers.setupDerived")}</p>}
      </div>
    </Card>
  );
}

/** Les trois temps du parcours, pour qu'aucun ne surprenne. */
function Steps({ t }: { t: T }) {
  const steps: [TKey, TKey][] = [
    ["brokers.step1Title", "brokers.step1Body"],
    ["brokers.step2Title", "brokers.step2Body"],
    ["brokers.step3Title", "brokers.step3Body"],
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {steps.map(([title, body], i) => (
        <li
          key={title}
          className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5"
        >
          <span className="tv-figure text-[11px] font-bold text-[var(--tv-accent)]">0{i + 1}</span>
          <div className="mt-0.5 text-[13px] font-semibold text-slate-100">{t(title)}</div>
          <div className="text-xs leading-snug text-slate-500">{t(body)}</div>
        </li>
      ))}
    </ol>
  );
}

/**
 * La confiance, écrite à côté du bouton. Deux colonnes qui ne laissent pas
 * de place à l'interprétation : ce que TradeVault lit, ce qu'il ne fait
 * jamais. Les deux listes décrivent la liste blanche du serveur
 * (`READ_ONLY_ENDPOINTS`) : modifier l'une sans l'autre serait mentir.
 */
function TrustPanel({ t, className, wide }: { t: T; className?: string; wide?: boolean }) {
  const can: TKey[] = ["brokers.can1", "brokers.can2", "brokers.can3", "brokers.can4"];
  const cant: TKey[] = ["brokers.cant1", "brokers.cant2", "brokers.cant3", "brokers.cant4"];
  return (
    <div className={cn("space-y-4 bg-[var(--tv-plate-0)] p-5 md:p-6", className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.08)] text-[var(--tv-accent)]">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{t("brokers.trustTitle")}</div>
          <div className="tv-row-label">{t("brokers.trustLevel")}</div>
        </div>
        {/* Le niveau, rendu visible : un cran sur trois. */}
        <div className="ml-auto flex items-end gap-0.5" aria-hidden>
          <span className="h-2 w-1.5 rounded-sm bg-[var(--tv-accent)]" />
          <span className="h-3 w-1.5 rounded-sm bg-white/[0.1]" />
          <span className="h-4 w-1.5 rounded-sm bg-white/[0.1]" />
        </div>
      </div>
      <div className={cn("grid gap-4", wide && "sm:grid-cols-2")}>
        <div>
          <span className="tv-label text-slate-500">{t("brokers.canTitle")}</span>
          <ul className="mt-1.5 space-y-1.5">
            {can.map((k) => (
              <li
                key={k}
                className="flex items-start gap-2 text-[13px] leading-snug text-slate-300"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tv-chart-green)]" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="tv-label text-slate-500">{t("brokers.cantTitle")}</span>
          <ul className="mt-1.5 space-y-1.5">
            {cant.map((k) => (
              <li
                key={k}
                className="flex items-start gap-2 text-[13px] leading-snug text-slate-300"
              >
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs leading-snug text-slate-500">{t("brokers.revoke")}</p>
    </div>
  );
}

/** Une tuile du catalogue : le nom en texte, jamais un logo redessiné. */
function BrokerTile({
  name,
  desc,
  badge,
  action,
  muted,
}: {
  name: string;
  desc: string;
  badge: ReactNode;
  action?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5",
        muted && "opacity-70",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[13px] font-extrabold text-slate-200">
        {name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-bold text-white">{name}</span>
          {badge}
        </div>
        <div className="text-xs leading-snug text-slate-500">{desc}</div>
      </div>
      {action}
    </div>
  );
}

function ConnectionCard({
  c,
  accounts,
  accountOptions,
  busy,
  isPro,
  lastSync,
  onSync,
  onReconnect,
  onPause,
  onDisconnect,
  onMap,
  onToggle,
  t,
}: {
  c: BrokerConnection;
  accounts: BrokerAccount[];
  accountOptions: { value: string; label: string }[];
  busy: boolean;
  isPro: boolean;
  lastSync: string;
  onSync: () => void;
  onReconnect: () => void;
  onPause: () => void;
  onDisconnect: () => void;
  onMap: (ba: BrokerAccount, accountId: string) => void;
  onToggle: (ba: BrokerAccount) => void;
  t: T;
}) {
  const errKey = c.lastError ? ERROR_KEYS[c.lastError] : null;
  // Jeton expiré : la seule action utile est de repasser chez Tradovate.
  const needsReconnect = c.status === "error" || c.lastError === "reauth_required";
  return (
    <Card pad="default" className="animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-[15px] font-extrabold text-white">
            T
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Le nom du login n'est pas connu : TradeVault ne lit pas le
                  profil Tradovate. Les comptes listés plus bas l'identifient. */}
              <span className="truncate text-sm font-bold text-white">
                Tradovate{c.label && c.label !== "Tradovate" ? ` · ${c.label}` : ""}
              </span>
              <span className="tv-label rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-400">
                {c.environment === "live" ? t("brokers.envLive") : t("brokers.envDemo")}
              </span>
              <StatusChip status={c.status} hasError={!!c.lastError} t={t} />
              <span className="tv-label inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-300">
                <ShieldCheck className="h-3 w-3 text-[var(--tv-accent)]" />
                {t("brokers.readOnlyBadge")}
              </span>
            </div>
            <p className="tv-row-label mt-0.5">{lastSync}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {needsReconnect ? (
            <Button size="sm" onClick={onReconnect} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPro ? (
                <ExternalLink className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {t("brokers.reconnect")}
            </Button>
          ) : (
            <Button
              variant="subtle"
              size="sm"
              onClick={onSync}
              disabled={busy || c.status === "disabled"}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPro ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{t("brokers.syncNow")}</span>
            </Button>
          )}
          {!needsReconnect && (
            <Button
              variant="subtle"
              size="sm"
              className="w-8 px-0"
              onClick={onPause}
              aria-label={c.status === "disabled" ? t("brokers.resume") : t("brokers.pause")}
              title={c.status === "disabled" ? t("brokers.resume") : t("brokers.pause")}
            >
              {c.status === "disabled" ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="subtle"
            size="sm"
            className="w-8 px-0"
            onClick={onDisconnect}
            aria-label={t("brokers.disconnect")}
            title={t("brokers.disconnect")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {errKey && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs leading-snug text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t(errKey)}
        </p>
      )}

      {/* Comptes du login → comptes TradeVault. */}
      <div className="mt-4 space-y-1.5">
        <span className="tv-label text-slate-500">{t("brokers.accountsTitle")}</span>
        {accounts.length === 0 ? (
          <p className="text-xs text-slate-500">{t("brokers.accountsEmpty")}</p>
        ) : (
          accounts.map((ba) => (
            <div
              key={ba.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-200">
                {ba.name}
              </span>
              <span className="text-xs text-slate-500" aria-hidden>
                →
              </span>
              <div className="w-48 max-w-full">
                <SelectPicker
                  label={t("brokers.journalInto")}
                  value={ba.accountId ?? ""}
                  options={accountOptions}
                  onChange={(v) => onMap(ba, v)}
                  variant="field"
                  width="100%"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={ba.enabled}
                  onChange={() => onToggle(ba)}
                  className="accent-[var(--tv-accent)]"
                />
                {t("brokers.syncThis")}
              </label>
            </div>
          ))
        )}
        {accounts.some((a) => a.enabled && !a.accountId) && (
          <p className="text-xs text-amber-300">{t("brokers.unmappedHint")}</p>
        )}
      </div>
    </Card>
  );
}

function StatusChip({
  status,
  hasError,
  t,
}: {
  status: BrokerConnection["status"];
  hasError: boolean;
  t: T;
}) {
  const tone =
    status === "disabled"
      ? "bg-white/[0.06] text-slate-400"
      : status === "error" || hasError
        ? "bg-amber-500/10 text-amber-300"
        : "bg-[rgb(var(--tv-chart-green-rgb)/0.1)] text-emerald-400";
  const key: TKey =
    status === "disabled"
      ? "brokers.statusPaused"
      : status === "error"
        ? "brokers.statusError"
        : "brokers.statusActive";
  return (
    <span className={cn("tv-label inline-flex items-center gap-1 rounded-md px-1.5 py-0.5", tone)}>
      {status === "active" && !hasError && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {t(key)}
    </span>
  );
}
