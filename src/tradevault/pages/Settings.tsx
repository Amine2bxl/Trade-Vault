import { useEffect, useMemo, useState } from "react";
import {
  Globe,
  DollarSign,
  Check,
  Download,
  Upload,
  Trash2,
  Database,
  SlidersHorizontal,
  ChevronRight,
  Search,
  UserX,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Trade, LANGUAGES } from "../types";
import { loadLanguage, saveLanguage, loadStartingBalance, saveStartingBalance } from "../store";
import { exportTradesCSV } from "../utils/exportCsv";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { PushNotificationSettings } from "../components/PushNotificationSettings";
import { cn } from "../utils/cn";

interface SettingsProps {
  trades: Trade[];
  onDeleteAll: () => void;
  onOpenImport: () => void;
  onOpenReports: () => void;
}

export default function Settings({ trades, onDeleteAll, onOpenImport, onOpenReports }: SettingsProps) {
  const { user, deleteAccount } = useAuth();
  const { t, setLang } = useT();
  const [language, setLanguage] = useState("en");
  const [startingEquity, setStartingEquity] = useState("25000");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Search: each section declares its searchable text; non-matching sections hide.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (...texts: string[]) =>
      !q || texts.some((s) => s.toLowerCase().includes(q));
    return {
      prefs: match(
        t("settings.preferences"),
        t("profile.language"),
        t("profile.startingEquity"),
        "language",
        "langue",
        "equity",
      ),
      notifs: match(t("push.title"), t("push.enable"), "push", "notification"),
      data: match(
        t("settings.data"),
        t("settings.exportCsv"),
        t("settings.importCsv"),
        t("settings.reports"),
        "csv",
        "export",
        "import",
        "report",
        "rapport",
      ),
      danger: match(
        t("settings.dangerZone"),
        t("profile.deleteAllTrades"),
        t("settings.deleteAccount"),
        "delete",
        "supprimer",
        "account",
        "compte",
      ),
    };
  }, [query, t]);
  const anyVisible = sections.prefs || sections.notifs || sections.data || sections.danger;

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadLanguage(user.id)
      .then((l) => {
        if (active) setLanguage(l);
      })
      .catch(() => {});
    loadStartingBalance(user.id)
      .then((v) => {
        if (active) setStartingEquity(String(v));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  const flash = (k: string) => {
    setSavedFlash(k);
    setTimeout(() => setSavedFlash(null), 1500);
  };

  const handleLanguage = async (val: string) => {
    if (!user) return;
    setLanguage(val);
    setLang(val as never);
    try {
      await saveLanguage(user.id, val);
      flash("lang");
    } catch (e) {
      console.error(e);
    }
  };

  const handleEquityBlur = async () => {
    if (!user) return;
    const n = Number(startingEquity);
    if (!Number.isFinite(n) || n < 0) return;
    try {
      await saveStartingBalance(user.id, n);
      flash("eq");
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="animate-fade-in-up stagger-0">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {t("settings.title")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">{t("settings.subtitle")}</p>
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up stagger-1">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings.search")}
          className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
        />
      </div>

      {!anyVisible && (
        <p className="text-sm text-slate-500 text-center py-8">{t("settings.noResults")}</p>
      )}

      {/* Preferences */}
      {sections.prefs && (
      <div className="glass-strong rounded-3xl p-6 space-y-4 animate-fade-in-up stagger-1">
        <SectionHeading
          icon={<SlidersHorizontal className="w-4 h-4" />}
          title={t("settings.preferences")}
        />

        <label className="block">
          <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> {t("profile.language")}
            </span>
            {savedFlash === "lang" && <SavedBadge label={t("common.saved")} />}
          </span>
          <select
            value={language}
            onChange={(e) => handleLanguage(e.target.value)}
            className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white focus:outline-none focus:border-cyan-500/40"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-[#0a0f1e]">
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> {t("profile.startingEquity")}
            </span>
            {savedFlash === "eq" && <SavedBadge label={t("common.saved")} />}
          </span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={startingEquity}
              onChange={(e) => setStartingEquity(e.target.value)}
              onBlur={handleEquityBlur}
              min={0}
              step={100}
              className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-7 pr-3 text-sm text-white focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">{t("profile.startingEquityHint")}</p>
        </label>
      </div>
      )}

      {/* Notifications */}
      {sections.notifs && (
      <div className="animate-fade-in-up stagger-2">
        <PushNotificationSettings />
      </div>
      )}

      {/* Data */}
      {sections.data && (
      <div className="glass-strong rounded-3xl p-6 space-y-3 animate-fade-in-up stagger-3">
        <SectionHeading
          icon={<Database className="w-4 h-4" />}
          title={t("settings.data")}
          sub={t("settings.dataSub")}
        />

        <ActionRow
          icon={<Download className="w-4 h-4" />}
          label={t("settings.exportCsv")}
          sub={`${t("settings.exportCsvSub")} · ${trades.length} ${t("common.trades")}`}
          onClick={() => exportTradesCSV(trades)}
          disabled={trades.length === 0}
        />
        <ActionRow
          icon={<Upload className="w-4 h-4" />}
          label={t("settings.importCsv")}
          sub={t("settings.importCsvSub")}
          onClick={onOpenImport}
        />
        <ActionRow
          icon={<FileText className="w-4 h-4" />}
          label={t("settings.reports")}
          sub={t("settings.reportsSub")}
          onClick={onOpenReports}
        />
      </div>
      )}

      {/* Danger zone */}
      {sections.danger && (
      <div className="glass-strong rounded-3xl p-6 space-y-3 border border-red-500/10 animate-fade-in-up stagger-4">
        <h2 className="text-sm font-semibold text-red-400/90 uppercase tracking-wider">
          {t("settings.dangerZone")}
        </h2>
        <button
          onClick={onDeleteAll}
          disabled={trades.length === 0}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition",
            trades.length === 0
              ? "bg-white/[0.02] border-white/[0.05] text-slate-600 cursor-not-allowed"
              : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15",
          )}
        >
          <span className="text-left">
            <span className="block text-sm font-medium">{t("profile.deleteAllTrades")}</span>
            <span className="block text-[10px] opacity-70 mt-0.5">
              {t("settings.deleteAllSub")}
            </span>
          </span>
          <Trash2 className="w-4 h-4 shrink-0" />
        </button>

        <button
          onClick={() => setDeleteOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20 transition"
        >
          <span className="text-left">
            <span className="block text-sm font-medium">{t("settings.deleteAccount")}</span>
            <span className="block text-[10px] opacity-70 mt-0.5">
              {t("settings.deleteAccountSub")}
            </span>
          </span>
          <UserX className="w-4 h-4 shrink-0" />
        </button>
      </div>
      )}

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} onConfirm={deleteAccount} />}
    </div>
  );
}

function DeleteAccountModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const { t } = useT();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = confirmText.trim().toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    const err = await onConfirm();
    if (err) {
      setError(t("settings.deleteAccountFailed"));
      setBusy(false);
      return;
    }
    // Success: the AuthContext cleared the session, which unmounts this screen.
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-3xl p-6 max-w-md w-full border border-red-500/20 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1.5">{t("settings.deleteAccountTitle")}</h2>
        <p className="text-sm text-slate-400 mb-5">{t("settings.deleteAccountBody")}</p>

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {t("settings.deleteAccountConfirm")}
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
          placeholder="DELETE"
          className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/40 mb-4"
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-medium text-slate-300 hover:bg-white/[0.08] transition"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleDelete}
            disabled={!armed || busy}
            className={cn(
              "flex-1 h-11 rounded-xl text-sm font-bold transition",
              armed && !busy
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-red-500/30 text-red-200/60 cursor-not-allowed",
            )}
          >
            {busy ? t("settings.deleting") : t("settings.deleteAccountCta")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h2>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SavedBadge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 text-emerald-400 normal-case tracking-normal">
      <Check className="w-3 h-3" /> {label}
    </span>
  );
}

function ActionRow({
  icon,
  label,
  sub,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left",
        disabled
          ? "bg-white/[0.02] border-white/[0.04] text-slate-600 cursor-not-allowed"
          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
          disabled
            ? "bg-white/[0.02] border-white/[0.05] text-slate-600"
            : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-semibold", disabled ? "text-slate-500" : "text-white")}>
          {label}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
    </button>
  );
}
