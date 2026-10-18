import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Wallet,
  Check,
  Download,
  Upload,
  Scale,
  Trash2,
  Database,
  SlidersHorizontal,
  Search,
  UserX,
  AlertTriangle,
  FileText,
  ShieldCheck,
} from "@/shared/ui/icons";
import type { LucideIcon } from "@/shared/ui/icons";
import { Trade, LANGUAGES } from "@/app/types";
import {
  loadLanguage,
  saveLanguage,
  loadStartingBalance,
  saveStartingBalance,
  saveCurrency,
  loadOnboarding,
  saveMonthlyTarget,
} from "@/app/store";
import { exportTradesCSV } from "../journal/exportCsv";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { PushNotificationSettings } from "./PushNotificationSettings";
import { cn } from "@/shared/ui/cn";
import {
  Button,
  FIELD_BASE,
  Modal,
  PageContainer,
  SelectPicker,
  SettingsAction,
  SettingsGroup,
  SettingsRow,
} from "@/shared/ui";
import AccountsManager from "./AccountsManager";
import { useSubscription } from "@/app/hooks/useSubscription";
import { useAccounts } from "@/app/contexts/AccountContext";
import RecalibrateAccountModal from "./RecalibrateAccountModal";
import CompAccessSection, { useIsAdmin } from "../billing/CompAccessSection";
import PromoCodeSection from "../billing/PromoCodeSection";
import {
  CURRENCIES,
  currencySymbol,
  parseCurrency,
  setCurrency,
  useCurrency,
} from "@/shared/currency";

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
type PaneId = "general" | "account" | "notifications" | "data" | "danger" | "admin";

/** Rubrique du rail : son icône, sa clé de libellé, sa clé de recherche. */
const PANES: { id: PaneId; section: keyof SearchSections; labelKey: TKey; icon: LucideIcon }[] = [
  { id: "general", section: "prefs", labelKey: "settings.preferences", icon: SlidersHorizontal },
  { id: "account", section: "account", labelKey: "settings.paneAccount", icon: Wallet },
  { id: "notifications", section: "notifs", labelKey: "push.title", icon: Bell },
  { id: "data", section: "data", labelKey: "settings.data", icon: Database },
  { id: "danger", section: "danger", labelKey: "settings.dangerZone", icon: AlertTriangle },
  // Réservé au propriétaire (`ADMIN_EMAILS`) — n'apparaît jamais pour le public.
  { id: "admin", section: "admin", labelKey: "settings.admin", icon: ShieldCheck },
];

interface SearchSections {
  prefs: boolean;
  account: boolean;
  notifs: boolean;
  data: boolean;
  danger: boolean;
  admin: boolean;
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
  const isAdmin = useIsAdmin();
  const { activeId } = useAccounts();
  const [recalOpen, setRecalOpen] = useState(false);
  const canRecal = useSubscription().can("recalibration");
  const { t, setLang } = useT();
  const [language, setLanguage] = useState("en");
  const [startingEquity, setStartingEquity] = useState("25000");
  const [monthlyTarget, setMonthlyTarget] = useState("");
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
        t("settings.currency"),
        "language",
        "langue",
        "currency",
        "devise",
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
      admin: match(t("settings.admin"), "admin", "codes promo", "accès offert", "comp"),
    };
  }, [query, t]);
  /** Les volets visibles après recherche, dans l'ordre du rail. Le volet
   *  propriétaire n'apparaît jamais hors d'une adresse `ADMIN_EMAILS`. */
  const visiblePanes = useMemo(
    () =>
      PANES.filter((p) => (p.id !== "admin" || isAdmin) && sections[p.section]).map((p) => p.id),
    [sections, isAdmin],
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
    loadOnboarding(user.id)
      .then((o) => {
        if (active && o.monthlyTarget) setMonthlyTarget(String(o.monthlyTarget));
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

  /* LA DEVISE. Appliquée tout de suite (chaque montant de l'app se réécrit),
     puis enregistrée sur le profil ; un échec d'écriture remet l'ancienne. */
  const currency = useCurrency();
  const handleCurrency = async (val: string) => {
    if (!user) return;
    const next = parseCurrency(val);
    const previous = currency;
    setCurrency(next);
    try {
      await saveCurrency(user.id, next);
      flash("cur");
    } catch (e) {
      console.error(e);
      setCurrency(previous);
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

  /* L'OBJECTIF MENSUEL, le même que celui du plan de trading et du copilote :
     un seul point d'écriture (`saveMonthlyTarget`), qui prévient le tableau
     de bord. Vide = pas d'objectif. */
  const handleTargetBlur = async () => {
    if (!user) return;
    const raw = monthlyTarget.trim();
    const n = raw === "" ? null : Number(raw);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    try {
      await saveMonthlyTarget(user.id, n);
      flash("target");
    } catch (e) {
      console.error(e);
    }
  };

  // Les onglets « General / Profile / Theme / Plan » vivaient ici, en état
  // local, et rendaient trois PAGES entières sans changer l'URL. Ce sont
  // maintenant des pages à part : Profil, Apparence et Abonnement se gèrent
  // ailleurs (nav + page Abonnement), Réglages garde le reste.

  if (!user) return null;

  const saved = (k: string) =>
    savedFlash === k ? (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
        <Check className="h-3 w-3" /> {t("common.saved")}
      </span>
    ) : null;

  return (
    <PageContainer className="max-w-5xl">
      {/* DEUX COLONNES, AUCUN CADRE AUTOUR. Le rail des rubriques à gauche,
          les réglages de la rubrique à droite, en rangées « nom · commande ».
          Plus de carte vitrée qui en contient d'autres. */}
      <div className="animate-fade-in-up grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <nav className="space-y-3" aria-label={t("nav.settings")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("settings.search")}
              aria-label={t("settings.search")}
              className={cn(FIELD_BASE, "h-9 text-[13px]")}
              style={{ paddingLeft: "2.25rem" }}
            />
          </div>
          {anyVisible && (
            <div
              className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-col"
              role="tablist"
              aria-orientation="vertical"
            >
              {PANES.filter((p) => (p.id !== "admin" || isAdmin) && sections[p.section]).map(
                ({ id, labelKey, icon: Ico }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={pane === id}
                    data-danger={id === "danger"}
                    onClick={() => setPane(id)}
                    className="tv-set-rail-item"
                  >
                    <Ico className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.9} />
                    <span className="truncate">{t(labelKey)}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </nav>

        <div className="min-w-0 space-y-5">
          {!anyVisible && (
            <p className="py-6 text-center text-sm text-slate-500">{t("settings.noResults")}</p>
          )}

          {pane === "general" && sections.prefs && (
            <SettingsGroup title={t("settings.preferences")}>
              <SettingsRow label={t("profile.language")} aside={saved("lang")}>
                <SelectPicker
                  variant="field"
                  label={t("profile.language")}
                  value={language}
                  onChange={handleLanguage}
                  options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                  searchLabel={t("picker.search")}
                />
              </SettingsRow>
              <SettingsRow
                label={t("settings.currency")}
                hint={t("settings.currencyHint")}
                aside={saved("cur")}
              >
                <SelectPicker
                  variant="field"
                  label={t("settings.currency")}
                  value={currency}
                  onChange={handleCurrency}
                  options={CURRENCIES.map((c) => ({
                    value: c.code,
                    label: `${c.code} · ${currencySymbol(c.code)}`,
                    hint: c.name,
                  }))}
                  searchLabel={t("picker.search")}
                />
              </SettingsRow>
              <SettingsRow
                label={t("profile.startingEquity")}
                hint={t("profile.startingEquityHint")}
                aside={saved("eq")}
                htmlFor="settings-equity"
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    {currencySymbol()}
                  </span>
                  <input
                    id="settings-equity"
                    type="number"
                    inputMode="decimal"
                    value={startingEquity}
                    onChange={(e) => setStartingEquity(e.target.value)}
                    onBlur={handleEquityBlur}
                    min={0}
                    step={100}
                    className={cn(FIELD_BASE, "tv-figure h-10")}
                    style={{ paddingLeft: `${1.1 + currencySymbol().length * 0.55}rem` }}
                  />
                </div>
              </SettingsRow>
              <SettingsRow
                label={t("settings.monthlyTarget")}
                hint={t("settings.monthlyTargetHint")}
                aside={saved("target")}
                htmlFor="settings-target"
              >
                <div className="relative">
                  <input
                    id="settings-target"
                    type="number"
                    inputMode="decimal"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(e.target.value)}
                    onBlur={handleTargetBlur}
                    min={0}
                    step={0.5}
                    placeholder="—"
                    className={cn(FIELD_BASE, "tv-figure h-10 pr-8")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    %
                  </span>
                </div>
              </SettingsRow>
            </SettingsGroup>
          )}

          {pane === "account" && sections.account && (
            /* Le gestionnaire porte déjà sa propre liste : pas de second cadre. */
            <section className="tv-set-group">
              <h2 className="tv-set-title">{t("settings.paneAccount")}</h2>
              <AccountsManager trades={trades} />
            </section>
          )}

          {pane === "notifications" && sections.notifs && <PushNotificationSettings />}

          {isAdmin && pane === "admin" && sections.admin && (
            <div className="space-y-4">
              <CompAccessSection />
              <PromoCodeSection />
            </div>
          )}

          {pane === "data" && sections.data && (
            <SettingsGroup title={t("settings.data")}>
              <SettingsAction
                icon={<Download className="h-4 w-4" />}
                label={t("settings.exportCsv")}
                onClick={() => exportTradesCSV(trades)}
                disabled={trades.length === 0}
              />
              <SettingsAction
                icon={<Upload className="h-4 w-4" />}
                label={t("settings.importCsv")}
                onClick={onOpenImport}
              />
              {activeId && (
                <SettingsAction
                  icon={<Scale className="h-4 w-4" />}
                  label={t("recal.action")}
                  hint={canRecal ? undefined : t("recal.proNote")}
                  onClick={() => setRecalOpen(true)}
                />
              )}
              <SettingsAction
                icon={<FileText className="h-4 w-4" />}
                label={t("settings.reports")}
                onClick={onOpenReports}
              />
            </SettingsGroup>
          )}

          {/* La zone de danger a sa rubrique : on n'y tombe pas en cherchant
              autre chose. */}
          {pane === "danger" && sections.danger && (
            <SettingsGroup title={t("settings.dangerZone")} tone="danger">
              <SettingsAction
                danger
                icon={<Trash2 className="h-4 w-4" />}
                label={t("profile.deleteAllTrades")}
                hint={t("settings.deleteAllSub")}
                onClick={onDeleteAll}
                disabled={trades.length === 0}
              />
              <SettingsAction
                danger
                icon={<UserX className="h-4 w-4" />}
                label={t("settings.deleteAccount")}
                hint={t("settings.deleteAccountSub")}
                onClick={() => setDeleteOpen(true)}
              />
            </SettingsGroup>
          )}
        </div>
      </div>

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
      wrapperClassName="z-[var(--tv-z-modal-nested)]"
    >
      <div>
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="tv-title mb-1.5">{t("settings.deleteAccountTitle")}</h2>
        <p className="text-sm text-slate-400 mb-5">{t("settings.deleteAccountBody")}</p>

        <label className="tv-label block text-slate-500 mb-1.5">
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

        {error && <p className="tv-prose text-red-400 mb-3">{error}</p>}

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
