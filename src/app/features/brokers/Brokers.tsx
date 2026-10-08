import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Cable,
  CheckCircle2,
  KeyRound,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useConfirm } from "@/app/contexts/ConfirmContext";
import { usePageLead } from "@/app/contexts/PageActionsContext";
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
  connectTradovateCredentials,
  startTradovateOAuth,
  syncBrokers,
  type ConnectResult,
} from "@/backend/brokers.functions";
import { announceBrokerImport, announceBrokersChanged } from "./useBrokerSync";
import { Button, Card, FIELD_BASE, SelectPicker, cn } from "@/shared/ui";
import { currencySymbol } from "@/shared/currency";

/**
 * BROKERS — brancher ses comptes une fois, ne plus jamais saisir un trade.
 *
 * Le rôle de la page tient en une phrase : connecter Tradovate (et les
 * comptes prop firm qui y vivent) puis dire, pour chaque compte broker, dans
 * quel compte TradeVault ses trades se journalisent.
 *
 * Deux parcours, selon ce que le serveur sait faire :
 *   • « Se connecter avec Tradovate » (OAuth) quand TradeVault est déclaré
 *     partenaire — le mot de passe ne passe jamais par nous ;
 *   • la clé API Tradovate du trader, utilisable dès aujourd'hui.
 *
 * Les identifiants sont chiffrés côté serveur (AES-256-GCM) avant d'être
 * écrits ; cette page ne les relit jamais.
 */

type Env = "live" | "demo";

const ERROR_KEYS: Record<string, TKey> = {
  crypto_unavailable: "brokers.err.crypto",
  oauth_unavailable: "brokers.err.oauth",
  invalid_credentials: "brokers.err.credentials",
  rate_limited: "brokers.err.rateLimited",
  captcha_required: "brokers.err.captcha",
  broker_unreachable: "brokers.err.unreachable",
  invalid_state: "brokers.err.state",
  reauth_required: "brokers.err.reauth",
  plan_limit: "brokers.err.planLimit",
};

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
  const locale = intlLocale(lang);

  const getCaps = useServerFn(brokerCapabilities);
  const connectCreds = useServerFn(connectTradovateCredentials);
  const startOAuth = useServerFn(startTradovateOAuth);
  const completeOAuth = useServerFn(completeTradovateOAuth);
  const sync = useServerFn(syncBrokers);

  const [caps, setCaps] = useState<{ encryption: boolean; oauth: boolean } | null>(null);
  const [connections, setConnections] = useState<BrokerConnection[] | null>(null);
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── Le formulaire de connexion ──
  const [env, setEnv] = useState<Env>("live");
  const [targetAccount, setTargetAccount] = useState<string>(activeAccount?.id ?? "");
  const [defaultRisk, setDefaultRisk] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cid, setCid] = useState("");
  const [sec, setSec] = useState("");
  const [connecting, setConnecting] = useState(false);

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
      .catch(() => setCaps({ encryption: false, oauth: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    if (!targetAccount && activeAccount) setTargetAccount(activeAccount.id);
  }, [activeAccount, targetAccount]);

  const handleConnected = useCallback(
    async (res: ConnectResult) => {
      if (!res.ok) {
        toast(res.message || t(ERROR_KEYS[res.error ?? ""] ?? "brokers.err.unknown"), "error");
        return false;
      }
      toast(
        res.inserted.length
          ? t("brokers.connectedWithTrades").replace("{n}", String(res.inserted.length))
          : t("brokers.connected"),
        "success",
      );
      if (res.inserted.length) announceBrokerImport(res.inserted, { autoOpen: false });
      announceBrokersChanged();
      await reload();
      return true;
    },
    [reload, t, toast],
  );

  // ── Retour OAuth : Tradovate renvoie ici avec `code` et `state`. ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;
    // On nettoie l'URL tout de suite : un code OAuth ne se rejoue pas, et il
    // n'a rien à faire dans l'historique ni dans un lien partagé.
    params.delete("code");
    params.delete("state");
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${rest ? `?${rest}` : ""}`,
    );
    setConnecting(true);
    completeOAuth({ data: { code, state } })
      .then(handleConnected)
      .catch(() => toast(t("brokers.err.unknown"), "error"))
      .finally(() => setConnecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riskValue = defaultRisk.trim() === "" ? null : Math.max(0, Number(defaultRisk) || 0);
  const common = {
    environment: env,
    defaultRisk: riskValue,
    defaultAccountId: targetAccount || null,
    timezone: browserTimeZone(),
  };

  const connectWithOAuth = async () => {
    setConnecting(true);
    try {
      const res = await startOAuth({ data: common });
      if (!res.url) {
        toast(t(ERROR_KEYS[res.error ?? ""] ?? "brokers.err.unknown"), "error");
        setConnecting(false);
        return;
      }
      window.location.assign(res.url);
    } catch {
      toast(t("brokers.err.unknown"), "error");
      setConnecting(false);
    }
  };

  const connectWithKey = async () => {
    if (!username.trim() || !password || !cid.trim() || !sec.trim()) return;
    setConnecting(true);
    try {
      const res = await connectCreds({
        data: { ...common, username, password, cid, sec, label: username.trim() },
      });
      if (await handleConnected(res)) {
        // Rien ne reste en mémoire de la page une fois la connexion faite.
        setPassword("");
        setSec("");
        setShowKeyForm(false);
      }
    } catch {
      toast(t("brokers.err.unknown"), "error");
    } finally {
      setConnecting(false);
    }
  };

  const syncNow = async (id: string) => {
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
    } catch {
      toast(t("brokers.err.unknown"), "error");
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

  const unavailable = caps !== null && !caps.encryption;
  const label = "tv-label block text-slate-400 mb-1.5";
  const input = cn(FIELD_BASE, "h-10 text-[13px]");

  return (
    <div className="mx-auto max-w-[1000px] space-y-3 p-4 md:p-5">
      {/* ── LES CONNEXIONS EXISTANTES ── */}
      {connections === null ? (
        <div className="h-28 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]" />
      ) : (
        connections.map((c) => {
          const accs = brokerAccounts.filter((a) => a.connectionId === c.id);
          const errKey = c.lastError ? ERROR_KEYS[c.lastError] : null;
          return (
            <Card key={c.id} pad="default" className="animate-fade-in-up">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-[13px] font-extrabold text-white">
                    TV
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-white">
                        Tradovate · {c.label}
                      </span>
                      <span className="tv-label rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-400">
                        {c.environment === "live" ? t("brokers.envLive") : t("brokers.envDemo")}
                      </span>
                      <StatusChip status={c.status} hasError={!!c.lastError} t={t} />
                    </div>
                    <p className="tv-row-label mt-0.5">
                      {t("brokers.lastSync").replace("{when}", fmtWhen(c.lastSuccessAt))}
                      {" · "}
                      {c.authMode === "oauth" ? t("brokers.viaOAuth") : t("brokers.viaKey")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => void syncNow(c.id)}
                    disabled={busyId === c.id || c.status === "disabled"}
                  >
                    {busyId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{t("brokers.syncNow")}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void togglePause(c)}
                    aria-label={c.status === "disabled" ? t("brokers.resume") : t("brokers.pause")}
                    title={c.status === "disabled" ? t("brokers.resume") : t("brokers.pause")}
                  >
                    {c.status === "disabled" ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void disconnect(c)}
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
                {accs.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("brokers.accountsEmpty")}</p>
                ) : (
                  accs.map((ba) => (
                    <div
                      key={ba.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-200">
                        {ba.name}
                      </span>
                      <span className="text-xs text-slate-500">→</span>
                      <div className="w-48 max-w-full">
                        <SelectPicker
                          label={t("brokers.journalInto")}
                          value={ba.accountId ?? ""}
                          options={accountOptions}
                          onChange={(v) => void mapAccount(ba, v)}
                          variant="field"
                          width="100%"
                        />
                      </div>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={ba.enabled}
                          onChange={() => void toggleAccount(ba)}
                          className="accent-[var(--tv-accent)]"
                        />
                        {t("brokers.syncThis")}
                      </label>
                    </div>
                  ))
                )}
                {accs.some((a) => a.enabled && !a.accountId) && (
                  <p className="text-xs text-amber-300">{t("brokers.unmappedHint")}</p>
                )}
              </div>
            </Card>
          );
        })
      )}

      {/* ── CONNECTER TRADOVATE ── */}
      <Card pad="default" className="animate-fade-in-up">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.08)] text-[var(--tv-accent)]">
            <Cable className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="tv-title">{t("brokers.connectTitle")}</h2>
            <p className="tv-prose mt-0.5 text-slate-400">{t("brokers.connectBody")}</p>
          </div>
        </div>

        {unavailable ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5 text-xs leading-snug text-slate-400">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            {t("brokers.unavailable")}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <span className={label}>{t("brokers.environment")}</span>
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
                <span className={label}>{t("brokers.journalInto")}</span>
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
                <span className={label}>{t("brokers.defaultRisk")}</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    {currencySymbol()}
                  </span>
                  <input
                    value={defaultRisk}
                    onChange={(e) => setDefaultRisk(e.target.value)}
                    inputMode="decimal"
                    placeholder={t("brokers.defaultRiskPlaceholder")}
                    className={cn(input, "tv-figure")}
                    style={{ paddingLeft: `${1.1 + currencySymbol().length * 0.55}rem` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs leading-snug text-slate-500">{t("brokers.envHint")}</p>

            <div className="flex flex-wrap items-center gap-2">
              {caps?.oauth && (
                <Button onClick={() => void connectWithOAuth()} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cable className="h-4 w-4" />
                  )}
                  {t("brokers.connectOAuth")}
                </Button>
              )}
              <Button
                variant={caps?.oauth ? "ghost" : "primary"}
                onClick={() => setShowKeyForm((v) => !v)}
                aria-expanded={showKeyForm}
              >
                <KeyRound className="h-4 w-4" />
                {t("brokers.connectKey")}
              </Button>
            </div>

            {showKeyForm && (
              <div className="space-y-3 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-4">
                <p className="text-xs leading-snug text-slate-400">{t("brokers.keyHelp")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className={label}>{t("brokers.username")}</span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className={input}
                    />
                  </div>
                  <div>
                    <span className={label}>{t("brokers.password")}</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className={input}
                    />
                  </div>
                  <div>
                    <span className={label}>{t("brokers.cid")}</span>
                    <input
                      value={cid}
                      onChange={(e) => setCid(e.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      className={cn(input, "tv-figure")}
                    />
                  </div>
                  <div>
                    <span className={label}>{t("brokers.sec")}</span>
                    <input
                      type="password"
                      value={sec}
                      onChange={(e) => setSec(e.target.value)}
                      autoComplete="off"
                      className={input}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--tv-accent)]" />
                    {t("brokers.encrypted")}
                  </span>
                  <Button
                    onClick={() => void connectWithKey()}
                    disabled={
                      connecting || !username.trim() || !password || !cid.trim() || !sec.trim()
                    }
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {t("brokers.connect")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

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
    </div>
  );
}

function StatusChip({
  status,
  hasError,
  t,
}: {
  status: BrokerConnection["status"];
  hasError: boolean;
  t: (k: TKey) => string;
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
