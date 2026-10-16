import { Suspense, lazy, useState, type ReactNode } from "react";
import { Crown, Lock, Pencil, Plus, Repeat2, Scale, Trash2 } from "lucide-react";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { useT } from "@/app/i18n/LanguageContext";
import type { Account } from "@/app/store";
import type { Trade } from "@/app/types";
import { fmtFactor, isCalibrated } from "@/app/trading/accountCalibration";
import { CreateAccountModal, DeleteAccountModal } from "@/app/shell/AccountSwitcher";
import { TYPE_LABEL_KEY, getAccountIcon } from "@/app/shell/accountVisuals";
import { Badge, Button, Card, cn } from "@/shared/ui";
import { formatMoney, useCurrency } from "@/shared/currency";
import RecalibrateAccountModal from "./RecalibrateAccountModal";

// Chargée à la demande, comme depuis la feuille des comptes.
const TransferTradesModal = lazy(() => import("@/app/shell/TransferTradesModal"));

/**
 * LES COMPTES, EN UN SEUL ENDROIT.
 *
 * La rubrique « Compte » des réglages n'affichait que le sélecteur du rail :
 * on y changeait de compte, mais le recalibrage vivait dans « Données », le
 * transfert dans la feuille des comptes, et rien ne montrait d'un coup d'œil
 * qui est le compte principal et à quelle échelle chaque compte est représenté.
 *
 * Ici, tout se lit dans l'ordre où le trader pense :
 *   1. le compte PRINCIPAL — la référence, en tête ;
 *   2. les sous-comptes, chacun avec son capital et son échelle ;
 *   3. les deux outils qui les relient — transférer, recalibrer — marqués Pro
 *      quand l'offre ne les ouvre pas (ils restent ouvrables : l'écran montre
 *      ce que l'offre apporte, le bouton final mène à l'abonnement).
 *
 * Aucune logique nouvelle : chaque action appelle ce qui existe déjà
 * (`AccountContext`, les modales de création, transfert et recalibrage).
 */
export default function AccountsManager({ trades }: { trades: Trade[] }) {
  const { accounts, activeAccount, mainAccount, switchAccount, removeAccount, setMain } =
    useAccounts();
  const { accountLimit, can } = useSubscription();
  const { t } = useT();
  const { toast } = useToast();
  useCurrency(); // redessine les montants quand la devise change

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [recalFor, setRecalFor] = useState<string | null>(null);
  const [transferFor, setTransferFor] = useState<{ from?: string; to?: string } | null>(null);

  const canTransfer = can("accountTransfer");
  const canRecal = can("recalibration");
  const canAdd = accountLimit > accounts.length;
  const subs = accounts.filter((a) => a.id !== mainAccount?.id);
  const proLabel = t("credits.plan.pro");

  const makeMain = async (a: Account) => {
    try {
      await setMain(a.id);
      toast(t("account.mainSet").replace("{name}", a.name), "success");
    } catch {
      toast(t("account.mainSetFailed"), "error");
    }
  };

  const count = Number.isFinite(accountLimit)
    ? t("account.limitCount")
        .replace("{n}", String(accounts.length))
        .replace("{max}", String(accountLimit))
    : t("account.count").replace("{n}", String(accounts.length));

  return (
    <div className="space-y-5">
      {/* ── 1. LE COMPTE PRINCIPAL ── */}
      {mainAccount && (
        <section className="space-y-2">
          <span className="tv-label block text-slate-500">{t("account.mainSection")}</span>
          <AccountCard
            account={mainAccount}
            isMain
            active={mainAccount.id === activeAccount?.id}
            t={t}
            onOpen={() => switchAccount(mainAccount.id)}
            onEdit={() => setEditing(mainAccount)}
            actions={
              <ToolButton
                icon={<Scale className="h-3.5 w-3.5" />}
                label={t("recal.short")}
                locked={!canRecal}
                onClick={() => setRecalFor(mainAccount.id)}
              />
            }
          />
        </section>
      )}

      {/* ── 2. LES SOUS-COMPTES ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="tv-label text-slate-500">{t("account.subSection")}</span>
          <span className="tv-figure text-xs text-slate-500">{count}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {subs.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              active={a.id === activeAccount?.id}
              t={t}
              onOpen={() => switchAccount(a.id)}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
              onMakeMain={() => void makeMain(a)}
              actions={
                <>
                  {mainAccount && (
                    <ToolButton
                      icon={<Repeat2 className="h-3.5 w-3.5" />}
                      label={t("account.toMain")}
                      locked={!canTransfer}
                      onClick={() => setTransferFor({ from: a.id, to: mainAccount.id })}
                    />
                  )}
                  <ToolButton
                    icon={<Scale className="h-3.5 w-3.5" />}
                    label={t("recal.short")}
                    locked={!canRecal}
                    onClick={() => setRecalFor(a.id)}
                  />
                </>
              }
            />
          ))}

          {/* Ajouter — ou, au plafond du palier, dire comment en avoir plus. */}
          <button
            type="button"
            onClick={() =>
              canAdd ? setCreateOpen(true) : window.dispatchEvent(new CustomEvent("tv:upgrade"))
            }
            className={cn(
              "flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-colors",
              canAdd
                ? "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.05)] text-[var(--tv-accent)] hover:bg-[rgb(var(--tv-accent-rgb)/0.1)]"
                : "border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-slate-400 hover:border-[var(--tv-border-strong)] hover:text-white",
            )}
          >
            {canAdd ? <Plus className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            <span className="text-[13px] font-semibold">
              {canAdd ? t("account.newSub") : t("account.moreAccountsPro")}
            </span>
            {subs.length === 0 && canAdd && (
              <span className="max-w-[16rem] text-xs leading-snug text-slate-500">
                {t("account.subEmpty")}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* ── 3. LES OUTILS QUI RELIENT LES COMPTES ── */}
      <section className="space-y-2">
        <span className="tv-label block text-slate-500">{t("account.toolsTitle")}</span>
        <div className="grid gap-3 md:grid-cols-2">
          <ToolCard
            icon={<Repeat2 className="h-4 w-4" />}
            title={t("transfer.title")}
            body={t("account.transferBody")}
            locked={!canTransfer}
            proLabel={proLabel}
            disabled={accounts.length < 2}
            disabledHint={t("transfer.needTwo")}
            cta={t("transfer.open")}
            onClick={() => setTransferFor({})}
          />
          <ToolCard
            icon={<Scale className="h-4 w-4" />}
            title={t("recal.title")}
            body={t("recal.actionSub")}
            locked={!canRecal}
            proLabel={proLabel}
            cta={t("recal.short")}
            onClick={() => activeAccount && setRecalFor(activeAccount.id)}
          />
        </div>
      </section>

      {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
      {editing && <CreateAccountModal edit={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <DeleteAccountModal
          account={deleting}
          onConfirm={async () => {
            try {
              await removeAccount(deleting.id);
            } catch (e) {
              console.error("Failed to delete account", e);
            }
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {recalFor && (
        <RecalibrateAccountModal
          accountId={recalFor}
          trades={trades}
          onClose={() => setRecalFor(null)}
        />
      )}
      {transferFor && (
        <Suspense fallback={null}>
          <TransferTradesModal
            initialSourceId={transferFor.from}
            initialTargetId={transferFor.to}
            onClose={() => setTransferFor(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

type T = ReturnType<typeof useT>["t"];

/** Une carte de compte : identité, capital, échelle, puis ses commandes. */
function AccountCard({
  account: a,
  isMain,
  active,
  t,
  onOpen,
  onEdit,
  onDelete,
  onMakeMain,
  actions,
}: {
  account: Account;
  isMain?: boolean;
  active: boolean;
  t: T;
  onOpen: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onMakeMain?: () => void;
  actions: ReactNode;
}) {
  const Icon = getAccountIcon(a);
  const calibrated = isCalibrated(a.calibrationScale);
  return (
    <Card
      pad="none"
      className={cn(
        "animate-fade-in-up flex flex-col",
        active && "border-[var(--tv-border-accent)]",
      )}
    >
      <div className={cn("flex items-start gap-3", isMain ? "p-4 md:p-5" : "p-3.5")}>
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-xl border border-[rgb(var(--tv-accent-rgb)/0.3)] bg-[rgb(var(--tv-accent-rgb)/0.12)] text-[var(--tv-accent)]",
            isMain ? "h-11 w-11" : "h-9 w-9",
          )}
        >
          <Icon className={isMain ? "h-5 w-5" : "h-4 w-4"} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-white">{a.name}</span>
            {isMain && (
              <span className="tv-label inline-flex items-center gap-1 rounded-md bg-[rgb(var(--tv-accent-rgb)/0.12)] px-1.5 py-0.5 text-[var(--tv-accent)]">
                <Crown className="h-2.5 w-2.5" />
                {t("account.mainBadge")}
              </span>
            )}
            {active && <Badge variant="neutral">{t("account.activeShort")}</Badge>}
          </div>
          <div className="tv-row-label mt-0.5">
            {t(TYPE_LABEL_KEY[a.type])}
            {calibrated && (
              <>
                {" · "}
                {t("recal.badge").replace("{scale}", `×${fmtFactor(a.calibrationScale)}`)}
              </>
            )}
          </div>
          <div className={cn("tv-figure mt-1.5 text-white", isMain ? "text-2xl" : "text-lg")}>
            {formatMoney(a.startingBalance, { whole: true })}
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[var(--tv-border)] px-3 py-2">
        {!active && (
          <Button variant="subtle" size="sm" onClick={onOpen}>
            {t("account.open")}
          </Button>
        )}
        {actions}
        <span className="ml-auto flex items-center gap-0.5">
          {onMakeMain && (
            <Button
              variant="subtle"
              size="sm"
              className="w-8 px-0"
              onClick={onMakeMain}
              aria-label={t("account.makeMain")}
              title={t("account.makeMain")}
            >
              <Crown className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="subtle"
            size="sm"
            className="w-8 px-0"
            onClick={onEdit}
            aria-label={t("account.edit")}
            title={t("account.edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {onDelete && (
            <Button
              variant="subtle"
              size="sm"
              className="w-8 px-0"
              onClick={onDelete}
              aria-label={t("account.delete")}
              title={t("account.delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      </div>
    </Card>
  );
}

/** Une commande d'outil sur une carte de compte, cadenassée hors Pro. */
function ToolButton({
  icon,
  label,
  locked,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="subtle" size="sm" onClick={onClick}>
      {locked ? <Lock className="h-3.5 w-3.5" /> : icon}
      {label}
    </Button>
  );
}

/** Un outil qui relie les comptes : ce qu'il fait, et le geste pour l'ouvrir. */
function ToolCard({
  icon,
  title,
  body,
  locked,
  proLabel,
  disabled,
  disabledHint,
  cta,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  locked: boolean;
  proLabel: string;
  disabled?: boolean;
  disabledHint?: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card pad="default" className="animate-fade-in-up flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-[var(--tv-accent)]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">{title}</span>
            {locked && <Badge variant="accent">{proLabel}</Badge>}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-400">{body}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <Button size="sm" variant="subtle" onClick={onClick} disabled={disabled}>
          {locked ? <Lock className="h-3.5 w-3.5" /> : null}
          {cta}
        </Button>
        {disabled && disabledHint && <span className="text-xs text-slate-500">{disabledHint}</span>}
      </div>
    </Card>
  );
}
