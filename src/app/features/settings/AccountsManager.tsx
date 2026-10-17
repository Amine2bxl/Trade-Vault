import { Suspense, lazy, useState, type ReactNode } from "react";
import {
  Crown,
  Lock,
  Pencil,
  Plus,
  Repeat2,
  Scale,
  Trash2,
  MoreHorizontal,
  Check,
} from "@/shared/ui/icons";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { useT } from "@/app/i18n/LanguageContext";
import type { Account } from "@/app/store";
import type { Trade } from "@/app/types";
import { fmtFactor, isCalibrated } from "@/app/trading/accountCalibration";
import { CreateAccountModal, DeleteAccountModal } from "@/app/shell/AccountSwitcher";
import { TYPE_LABEL_KEY, getAccountIcon } from "@/app/shell/accountVisuals";
import { Button, PageControls, cn } from "@/shared/ui";
import { formatMoney, useCurrency } from "@/shared/currency";
import RecalibrateAccountModal from "./RecalibrateAccountModal";

// Chargée à la demande, comme depuis la feuille des comptes.
const TransferTradesModal = lazy(() => import("@/app/shell/TransferTradesModal"));

/** Liste unique : identité et capital visibles, compte actif explicite,
 * actions ponctuelles dans le menu du compte. Les modales et droits existants
 * conservent tous leurs comportements. */
export default function AccountsManager({ trades }: { trades: Trade[] }) {
  const { accounts, activeAccount, mainAccount, switchAccount, removeAccount, setMain, ready } =
    useAccounts();
  const { accountLimit, can, isPro } = useSubscription();
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

  const makeMain = async (a: Account) => {
    try {
      await setMain(a.id);
      toast(t("account.mainSet").replace("{name}", a.name), "success");
    } catch {
      toast(t("account.mainSetFailed"), "error");
    }
  };

  const count =
    Number.isFinite(accountLimit) && accounts.length <= accountLimit
      ? t("account.limitCount")
          .replace("{n}", String(accounts.length))
          .replace("{max}", String(accountLimit))
      : t("account.count").replace("{n}", String(accounts.length));

  return (
    <div className="tv-accounts space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="tv-prose text-slate-500">{count}</span>
        <Button
          variant={canAdd ? "entry" : "subtle"}
          size="sm"
          disabled={!ready || (!canAdd && isPro)}
          onClick={() =>
            canAdd ? setCreateOpen(true) : window.dispatchEvent(new CustomEvent("tv:upgrade"))
          }
        >
          {canAdd ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {canAdd
            ? t("account.newSub")
            : isPro
              ? t("account.limitReached")
              : t("account.moreAccountsPro")}
        </Button>
      </div>
      <div className="tv-account-list">
        {!ready
          ? [0, 1].map((n) => (
              <div
                key={n}
                className="h-20 animate-pulse border-b border-[var(--tv-border)] bg-[var(--tv-plate-2)]"
              />
            ))
          : [...(mainAccount ? [mainAccount] : []), ...subs].map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                active={a.id === activeAccount?.id}
                isMain={a.id === mainAccount?.id}
                t={t}
                onOpen={() => switchAccount(a.id)}
              >
                <ToolButton
                  icon={<Pencil className="h-4 w-4" />}
                  label={t("account.edit")}
                  onClick={() => setEditing(a)}
                />
                {a.id !== mainAccount?.id && (
                  <ToolButton
                    icon={<Crown className="h-4 w-4" />}
                    label={t("account.makeMain")}
                    onClick={() => void makeMain(a)}
                  />
                )}
                <ToolButton
                  icon={<Scale className="h-4 w-4" />}
                  label={t("recal.short")}
                  locked={!canRecal}
                  onClick={() => setRecalFor(a.id)}
                />
                {mainAccount && a.id !== mainAccount.id && (
                  <ToolButton
                    icon={<Repeat2 className="h-4 w-4" />}
                    label={t("account.toMain")}
                    locked={!canTransfer}
                    onClick={() => setTransferFor({ from: a.id, to: mainAccount.id })}
                  />
                )}
                {a.id !== mainAccount?.id && (
                  <ToolButton
                    danger
                    icon={<Trash2 className="h-4 w-4" />}
                    label={t("account.delete")}
                    onClick={() => setDeleting(a)}
                  />
                )}
              </AccountRow>
            ))}
      </div>
      {subs.length === 0 && ready && (
        <p className="tv-prose text-slate-500">{t("account.subEmpty")}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={accounts.length < 2}
          onClick={() => setTransferFor({})}
        >
          {canTransfer ? <Repeat2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {t("transfer.open")}
        </Button>
        {accounts.length < 2 && (
          <span className="tv-prose text-slate-500">{t("transfer.needTwo")}</span>
        )}
      </div>

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

/** Une ligne par compte ; les outils ponctuels restent dans son menu. */
function AccountRow({
  account: a,
  active,
  isMain,
  t,
  onOpen,
  children,
}: {
  account: Account;
  active: boolean;
  isMain: boolean;
  t: T;
  onOpen: () => void;
  children: ReactNode;
}) {
  const Icon = getAccountIcon(a);
  return (
    <article
      className={cn("tv-account-row", active && "tv-account-row-active")}
      aria-label={a.name}
    >
      <button type="button" onClick={onOpen} aria-pressed={active} className="tv-account-select">
        <span className="tv-account-icon">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{a.name}</span>
            {isMain && (
              <Crown
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-label={t("account.mainBadge")}
              />
            )}
            {active && (
              <Check
                className="h-3.5 w-3.5 shrink-0 text-[var(--tv-highlight)]"
                aria-label={t("account.activeShort")}
              />
            )}
          </span>
          <span className="mt-1 block truncate text-xs text-slate-500">
            {isMain ? `${t("account.mainBadge")} · ` : ""}
            {t(TYPE_LABEL_KEY[a.type])}
            {isCalibrated(a.calibrationScale) && ` · ×${fmtFactor(a.calibrationScale)}`}
          </span>
        </span>
        <span
          className="tv-figure shrink-0 text-sm text-white"
          title={t("account.startingBalance")}
        >
          {formatMoney(a.startingBalance, { whole: true })}
        </span>
      </button>
      <PageControls
        label={`${t("account.manage")} · ${a.name}`}
        icon={<MoreHorizontal className="h-4 w-4" />}
        iconOnly
        closeOnAction
      >
        {children}
      </PageControls>
    </article>
  );
}

function ToolButton({
  icon,
  label,
  locked = false,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  locked?: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "danger" : "ghost"}
      size="sm"
      onClick={onClick}
      className="min-h-11 w-full justify-start"
    >
      {locked ? <Lock className="h-4 w-4" /> : icon}
      {label}
    </Button>
  );
}
