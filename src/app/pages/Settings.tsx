import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Wallet,
  Globe,
  DollarSign,
  Check,
  Download,
  Upload,
  Scale,
  Trash2,
  Database,
  SlidersHorizontal,
  ChevronRight,
  Search,
  UserX,
  AlertTriangle,
  FileText,
  Palette,
  CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Trade, LANGUAGES } from "../types";
import { loadLanguage, saveLanguage, loadStartingBalance, saveStartingBalance } from "../store";
import { exportTradesCSV } from "../utils/exportCsv";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { PushNotificationSettings } from "../components/PushNotificationSettings";
import { cn } from "../utils/cn";
import { Button, Card, FIELD_BASE, Modal, PageContainer, PageHeader } from "@/shared/ui";
import AccountSwitcher from "../components/AccountSwitcher";
import { useAccounts } from "../contexts/AccountContext";
import { isCalibrated } from "../utils/accountCalibration";
import RecalibrateAccountModal from "../components/RecalibrateAccountModal";
import ThemeSettings from "../components/ThemeSettings";
import SubscriptionSection from "../components/SubscriptionSection";

/**
 * Réglages en DEUX VOLETS : le rail des rubriques à gauche, une seule à droite.
 *
 * L'ancienne page empilait quatre cartes dans une colonne. Ça marche à quatre ;
 * ça se dégrade à chaque ajout, et la zone de danger finissait par se trouver à
 * un coup de molette d'un menu déroulant de langue. Le rail impose une
 * séparation nette : on ne tombe pas sur « Supprimer mon compte » en cherchant
 * autre chose.
 *
 * ── LA RECHERCHE PILOTE LE RAIL ────────────────────────────────────────────
 * Taper filtre les rubriques ET bascule sur la première qui correspond. Une
 * recherche qui laisse le panneau de droite vide pendant que le résultat existe
 * à gauche est une recherche qui ment.
 *
 * ── MOBILE ─────────────────────────────────────────────────────────────────
 * Sous `lg`, le rail devient une rangée de puces défilante au-dessus du
 * contenu : la même structure, sans imposer une colonne de 240 px à un écran
 * qui en fait 390.
 */
type PaneId = "general" | "account" | "appearance" | "subscription" | "notifications" | "data" | "danger";

/** Rubrique du rail : son icône, sa clé de libellé, sa clé de recherche. */
const PANES: { id: PaneId; section: keyof SearchSections; labelKey: TKey; icon: LucideIcon }[] = [
  { id: "general", section: "prefs", labelKey: "settings.preferences", icon: SlidersHorizontal },
  { id: "account", section: "account", labelKey: "settings.paneAccount", icon: Wallet },
  { id: "appearance", section: "appearance", labelKey: "nav.appearance", icon: Palette },
  { id: "subscription", section: "subscription", labelKey: "nav.subscription", icon: CreditCard },
  { id: "notifications", section: "notifs", labelKey: "push.title", icon: Bell },
  { id: "data", section: "data", labelKey: "settings.data", icon: Database },
  { id: "danger", section: "danger", labelKey: "settings.dangerZone", icon: AlertTriangle },
];

interface SearchSections {
  prefs: boolean;
  account: boolean;
  appearance: boolean;
  subscription: boolean;
  notifs: boolean;
  data: boolean;
  danger: boolean;
}

interface SettingsProps {
  trades: Trade[];
  onDeleteAll: () => void;
  onOpenImport: () => void;
  onOpenReports: () => void;
}

export default function Settings({
  trades,
  onDeleteAll,
  onOpenImport,
  onOpenReports,
}: SettingsProps) {
  const { user, deleteAccount } = useAuth();
  const { activeId, activeAccount } = useAccounts();
  const [recalOpen, setRecalOpen] = useState(false);
  const { t, setLang } = useT();
  const [language, setLanguage] = useState("en");
  const [startingEquity, setStartingEquity] = useState("25000");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [pane, setPane] = useState<PaneId>("general");

  // Search: each section declares its searchable text; non-matching sections hide.
  const sections = useMemo<SearchSections>(() => {
    const q = query.trim().toLowerCase();
    const match = (...texts: string[]) => !q || texts.some((s) => s.toLowerCase().includes(q));
    return {
      account: match(t("settings.paneAccount"), "compte", "account", "sous-compte", "solde"),
      prefs: match(
        t("settings.preferences"),
        t("profile.language"),
        t("profile.startingEquity"),
        "language",
        "langue",
        "equity",
      ),
      appearance: match(t("nav.appearance"), "theme", "thème", "couleur", "color", "palette"),
      subscription: match(t("nav.subscription"), "plan", "paiement", "billing", "stripe", "abonnement"),
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
  /** Les volets visibles après recherche, dans l'ordre du rail. */
  const visiblePanes = useMemo(
    () => PANES.filter((p) => sections[p.section]).map((p) => p.id),
    [sections],
  );
  const anyVisible = visiblePanes.length > 0;

  // La recherche ne cache pas seulement des lignes : si le volet ouvert ne
  // correspond plus, elle bascule sur le premier qui correspond. Sans ça, taper
  // « export » depuis l'onglet Général laissait un panneau vide à droite alors
  // que le résultat existait à gauche.
  useEffect(() => {
    if (visiblePanes.length > 0 && !visiblePanes.includes(pane)) setPane(visiblePanes[0]);
  }, [visiblePanes, pane]);

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

  // Les onglets « General / Profile / Theme / Plan » vivaient ici, en état
  // local, et rendaient trois PAGES entières sans changer l'URL. Ce sont
  // maintenant les onglets de la section Réglages (`SectionTabs`), donc de
  // vrais liens vers `/profile`, `/appearance` et `/subscription`.

  if (!user) return null;

  return (
    <PageContainer className="max-w-5xl space-y-3">
      <PageHeader
        className="mb-0 md:mb-0 stagger-0"
        icon={
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <SlidersHorizontal className="w-4 h-4 text-white" />
          </span>
        }
        title={t("settings.title")}
      />

      {/* UNE SEULE FENÊTRE. Le rail et le contenu vivent dans le même panneau,
          séparés par une simple cloison — pas deux cartes flottantes séparées
          par un vide. C'est ce qui fait la différence entre une page de
          réglages et une pile de widgets. */}
      <Card
        variant="glass-strong"
        className="animate-fade-in-up stagger-1 overflow-hidden lg:grid lg:grid-cols-[244px_1fr]"
      >
        {/* ── RAIL DES RUBRIQUES ── */}
        <div className="border-b border-white/[0.06] p-3 lg:border-b-0 lg:border-r">
          {/* Search — the fastest route through a settings page is typing. */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("settings.search")}
              className={cn(FIELD_BASE, "h-10 pl-10 text-[13px]")}
            />
          </div>

          {anyVisible && (
            <div
              className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
              role="tablist"
              aria-orientation="vertical"
            >
              {PANES.filter((p) => sections[p.section]).map(({ id, labelKey, icon: Ico }) => {
                const active = pane === id;
                const danger = id === "danger";
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPane(id)}
                    className={cn(
                      "group flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium",
                      "transition-colors duration-200 lg:w-full",
                      active
                        ? danger
                          ? "bg-red-500/10 text-red-300"
                          : "bg-cyan-500/10 text-white"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                    )}
                  >
                    <Ico
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? (danger ? "text-red-400" : "text-cyan-400") : "text-slate-500",
                      )}
                      strokeWidth={1.9}
                    />
                    <span className="truncate">{t(labelKey)}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto hidden h-4 w-4 shrink-0 lg:block",
                        active ? "text-slate-500" : "text-slate-700",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── VOLET ACTIF ── */}
        <div className="space-y-4 p-5 md:p-6">
          {!anyVisible && (
            <p className="text-sm text-slate-500 text-center py-6">{t("settings.noResults")}</p>
          )}

          {/* Compte actif — il vivait dans le pied du menu « Plus », qui
              n'existe plus. Il a maintenant sa rubrique, sur toutes les
              tailles d'écran : la barre latérale peut être repliée. */}
          {pane === "account" && sections.account && (
            <div className="space-y-4">
              <SectionHeading
                icon={<Wallet className="w-4 h-4" />}
                title={t("settings.paneAccount")}
              />
              <AccountSwitcher variant="card" />
            </div>
          )}

          {/* Appearance — theme settings, same page */}
          {pane === "appearance" && sections.appearance && (
            <div className="space-y-4">
              <SectionHeading icon={<Palette className="w-4 h-4" />} title={t("nav.appearance")} />
              <ThemeSettings />
            </div>
          )}

          {/* Subscription — billing, same page */}
          {pane === "subscription" && sections.subscription && (
            <div className="space-y-4">
              <SectionHeading icon={<CreditCard className="w-4 h-4" />} title={t("nav.subscription")} />
              <SubscriptionSection />
            </div>
          )}

          {/* Preferences */}
          {pane === "general" && sections.prefs && (
            <div className="space-y-5">
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
                  className={cn(FIELD_BASE, "h-11 cursor-pointer appearance-none")}
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
                    className={cn(FIELD_BASE, "h-11 pl-7")}
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1.5">
                  {t("profile.startingEquityHint")}
                </p>
              </label>
            </div>
          )}

          {/* Notifications */}
          {pane === "notifications" && sections.notifs && <PushNotificationSettings />}

          {/* Data */}
          {pane === "data" && sections.data && (
            <div className="space-y-2.5">
              <SectionHeading icon={<Database className="w-4 h-4" />} title={t("settings.data")} />

              <ActionRow
                icon={<Download className="w-4 h-4" />}
                label={t("settings.exportCsv")}
                onClick={() => exportTradesCSV(trades)}
                disabled={trades.length === 0}
              />
              <ActionRow
                icon={<Upload className="w-4 h-4" />}
                label={t("settings.importCsv")}
                onClick={onOpenImport}
              />
              {/* Recalibrage d'échelle : dans la section Données, à côté de
              l'import et de l'export — c'est bien une opération sur
              l'historique, pas un réglage d'apparence. */}
              {activeId && (
                <ActionRow
                  icon={<Scale className="w-4 h-4" />}
                  label={t("recal.action")}
                  onClick={() => setRecalOpen(true)}
                />
              )}
              <ActionRow
                icon={<FileText className="w-4 h-4" />}
                label={t("settings.reports")}
                onClick={onOpenReports}
              />
            </div>
          )}

          {/* Danger zone — sa propre rubrique dans le rail, pas une carte de
              plus au bas d'une colonne. On n'atteint « Supprimer mon compte »
              qu'en le demandant. */}
          {pane === "danger" && sections.danger && (
            <div className="space-y-2.5 rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-red-400/90">
                {t("settings.dangerZone")}
              </h2>
              <Button
                variant="danger"
                onClick={onDeleteAll}
                disabled={trades.length === 0}
                className="w-full justify-between h-auto py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-left">
                  <span className="block text-sm font-medium">{t("profile.deleteAllTrades")}</span>
                  <span className="block text-[10px] opacity-70 mt-0.5">
                    {t("settings.deleteAllSub")}
                  </span>
                </span>
                <Trash2 className="w-4 h-4 shrink-0" />
              </Button>

              <Button
                variant="danger"
                onClick={() => setDeleteOpen(true)}
                className="w-full justify-between h-auto py-3"
              >
                <span className="text-left">
                  <span className="block text-sm font-medium">{t("settings.deleteAccount")}</span>
                  <span className="block text-[10px] opacity-70 mt-0.5">
                    {t("settings.deleteAccountSub")}
                  </span>
                </span>
                <UserX className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {deleteOpen && (
        <DeleteAccountModal onClose={() => setDeleteOpen(false)} onConfirm={deleteAccount} />
      )}
      {recalOpen && activeId && (
        <RecalibrateAccountModal
          accountId={activeId}
          trades={trades}
          onClose={() => setRecalOpen(false)}
        />
      )}
    </PageContainer>
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
    <Modal
      open
      onClose={onClose}
      className="md:max-w-md p-5 border border-red-500/20"
      wrapperClassName="z-[100]"
    >
      <div>
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
          className={cn(FIELD_BASE, "h-11 mb-4 focus:border-red-500/40 focus:ring-red-500/20")}
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="subtle" onClick={onClose} disabled={busy} className="flex-1">
            {t("common.cancel")}
          </Button>
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
    </Modal>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
        <span className="text-white">{icon}</span>
      </span>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
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
