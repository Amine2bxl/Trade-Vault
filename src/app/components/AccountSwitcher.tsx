import { useState } from "react";
import {
  User,
  Building2,
  FlaskConical,
  Zap,
  Check,
  ChevronDown,
  Plus,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Account, AccountType } from "../store";
import { Modal, FIELD_BASE, Chip, CHIP_ROW } from "@/shared/ui";

const TYPE_ICON: Record<AccountType, typeof User> = {
  personal: User,
  prop: Building2,
  demo: FlaskConical,
  live: Zap,
};
const TYPE_LABEL_KEY = {
  personal: "account.typePersonal",
  prop: "account.typeProp",
  demo: "account.typeDemo",
  live: "account.typeLive",
} as const;

export default function AccountSwitcher({
  compact,
  variant = "bar",
}: {
  compact?: boolean;
  variant?: "bar" | "fab" | "card";
}) {
  const { accounts, activeAccount, switchAccount, editAccount, removeAccount } = useAccounts();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleting, setDeleting] = useState<Account | null>(null);

  const startRename = (a: Account) => {
    setEditingId(a.id);
    setDraftName(a.name);
  };
  const commitRename = async (id: string) => {
    const name = draftName.trim();
    setEditingId(null);
    if (!name || name === accounts.find((a) => a.id === id)?.name) return;
    try {
      await editAccount(id, { name });
    } catch (e) {
      console.error("Failed to rename account", e);
    }
  };

  /**
   * AccountSheet — sélecteur de comptes dans un Modal PARTAGÉ (portal vers
   * document.body). C'est ce qui rend le changement de compte fiable partout :
   * un dropdown `absolute`/`fixed` rendu dans le panneau du Modal Jarvis
   * (transform + overflow-hidden) était clippé/invisible — le bug « le sous-
   * compte ne s'ouvre pas ». Le portal n'est jamais contenu ni clippé.
   */
  const AccountSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <Modal
      open={open}
      onClose={onClose}
      wrapperClassName="z-[70]"
      className="md:max-w-sm max-h-[80vh] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">{t("account.title")}</h2>
            <p className="text-[11px] text-slate-500">{t("account.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-3 max-h-[60vh] overflow-y-auto">
        {accounts.map((a) => {
          const Icon = TYPE_ICON[a.type];
          const active = a.id === activeAccount?.id;
          return (
            <div
              key={a.id}
              className={cn(
                "group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors",
                active ? "bg-cyan-500/15" : "hover:bg-white/[0.06]",
              )}
            >
              <button
                onClick={() => {
                  switchAccount(a.id);
                  onClose();
                }}
                className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${a.color}22`, color: a.color }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium truncate",
                      active ? "text-white" : "text-slate-300",
                    )}
                  >
                    {a.name}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {t(TYPE_LABEL_KEY[a.type])}
                  </span>
                </span>
              </button>
              {accounts.length > 1 && (
                <button
                  onClick={() => {
                    setDeleting(a);
                    onClose();
                  }}
                  aria-label={t("account.delete")}
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {active && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
            </div>
          );
        })}
        <div className="h-px bg-white/[0.06] my-1.5 mx-1" />
        <button
          onClick={() => {
            setCreateOpen(true);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-cyan-300 hover:bg-cyan-500/10 transition-colors"
        >
          <span className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </span>
          <span className="text-sm font-semibold">{t("account.new")}</span>
        </button>
      </div>
    </Modal>
  );

  // Mobile FAB: a floating circular button (bottom-left, mirroring the AI Coach)
  // that opens a premium bottom sheet of tappable account cards — one tap to
  // switch sub-accounts. Original layout, no dropdown crowding the top bar.
  if (variant === "fab") {
    if (!activeAccount) return null;
    const ActiveIcon = TYPE_ICON[activeAccount.type];
    return (
      <>
        {/* Pilule mobile PREMIUM : glass-strong + liseré cyan + glow doux.
            L'avatar porte la teinte du compte, le halo derrière vient de la DA. */}
        <button
          onClick={() => setOpen(true)}
          aria-label={t("account.switch")}
          className="md:hidden fixed z-40 left-3 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] h-12 pl-2 pr-3 rounded-full flex items-center gap-2 glass-strong border border-cyan-500/20 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_24px_rgba(34,211,238,0.15)] active:scale-95 transition-all"
        >
          <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <span className="relative shrink-0">
            <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
            <span
              className="relative grid w-8 h-8 place-items-center rounded-xl border"
              style={{
                background: `${activeAccount.color}22`,
                color: activeAccount.color,
                borderColor: `${activeAccount.color}44`,
              }}
            >
              <ActiveIcon className="w-4 h-4" />
            </span>
          </span>
          <span className="min-w-0 max-w-[92px] text-left">
            <span className="block text-[9px] uppercase tracking-[0.14em] font-bold text-slate-500 leading-none mb-0.5">
              {t("account.fabLabel")}
            </span>
            <span className="block text-xs font-bold text-white truncate leading-tight">
              {activeAccount.name}
            </span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </button>

        {open && (
          <div
            className="md:hidden fixed inset-0 z-[70] flex items-end bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full glass-strong rounded-t-3xl border-t border-white/[0.08] pb-[calc(env(safe-area-inset-bottom,0px)+16px)] animate-slide-up"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-sm font-bold text-white">{t("account.title")}</h2>
                  <p className="text-[11px] text-slate-500">{t("account.subtitle")}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t("common.close")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-4 max-h-[55vh] overflow-y-auto">
                {accounts.map((a) => {
                  const Icon = TYPE_ICON[a.type];
                  const active = a.id === activeAccount.id;
                  const editing = editingId === a.id;

                  if (editing) {
                    return (
                      <div
                        key={a.id}
                        className="relative flex flex-col gap-2 rounded-2xl p-3.5 border bg-white/[0.06]"
                        style={{ borderColor: `${a.color}80` }}
                      >
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${a.color}22`, color: a.color }}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </span>
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(a.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          maxLength={40}
                          className="w-full bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => commitRename(a.id)}
                            className="flex-1 h-7 rounded-lg bg-cyan-500/20 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1 hover:bg-cyan-500/30"
                          >
                            <Check className="w-3.5 h-3.5" /> OK
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            aria-label={t("common.cancel")}
                            className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-400 flex items-center justify-center hover:bg-white/[0.1]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "relative flex flex-col gap-2 rounded-2xl p-3.5 border transition-all",
                        active ? "bg-white/[0.06]" : "bg-white/[0.03] border-white/[0.06]",
                      )}
                      style={
                        active
                          ? { borderColor: `${a.color}80`, boxShadow: `0 0 0 1px ${a.color}40` }
                          : undefined
                      }
                    >
                      <button
                        onClick={() => {
                          switchAccount(a.id);
                          setOpen(false);
                        }}
                        className="flex flex-col gap-2 text-left active:scale-[0.97] transition-transform"
                      >
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${a.color}22`, color: a.color }}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </span>
                        <span className="min-w-0 pr-6">
                          <span className="block text-sm font-bold text-white truncate">
                            {a.name}
                          </span>
                          <span className="block text-[10px] text-slate-500 truncate">
                            {t(TYPE_LABEL_KEY[a.type])}
                          </span>
                        </span>
                      </button>

                      {/* Rename + delete affordances */}
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
                        {accounts.length > 1 && (
                          <button
                            onClick={() => setDeleting(a)}
                            aria-label={t("account.delete")}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => startRename(a)}
                          aria-label={t("account.rename")}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {active && (
                        <span
                          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: a.color }}
                        >
                          <Check className="w-3 h-3 text-[#0a0f1e]" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() => {
                    setCreateOpen(true);
                    setOpen(false);
                  }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl p-3.5 border border-dashed border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-300 hover:bg-cyan-500/10 transition-all active:scale-[0.97] min-h-[92px]"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-semibold text-center">{t("account.newShort")}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
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
      </>
    );
  }

  // Trading Account — carte premium (footer/sidebar Jarvis), style CTA : liseré
  // gradient cyan + glow, comme les boutons d'action du produit.
  if (variant === "card") {
    if (!activeAccount) return null;
    const ActiveIcon = TYPE_ICON[activeAccount.type];
    const balance = `$${Math.round(activeAccount.startingBalance).toLocaleString("en-US")}`;
    const editing = editingId === activeAccount.id;
    return (
      <div className="relative w-full">
        {editing ? (
          <div className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-white/[0.04] px-2.5 py-1.5">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(activeAccount.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              autoFocus
              maxLength={40}
              placeholder={activeAccount.name}
              className="flex-1 min-w-0 bg-transparent text-[13px] font-bold text-white focus:outline-none placeholder-slate-600"
            />
            <button
              onClick={() => commitRename(activeAccount.id)}
              aria-label={t("common.save")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditingId(null)}
              aria-label={t("common.cancel")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white/[0.08]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            title={t("account.switch")}
            className={cn(
              "relative w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-all overflow-hidden",
              "border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.10] via-white/[0.03] to-transparent",
              "hover:border-cyan-500/45 hover:from-cyan-500/[0.16] shadow-lg shadow-cyan-500/5 group/acc",
            )}
          >
            <span className="pointer-events-none absolute inset-x-2.5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                background: `${activeAccount.color}22`,
                color: activeAccount.color,
                borderColor: `${activeAccount.color}44`,
              }}
            >
              <ActiveIcon className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[8px] uppercase tracking-[0.14em] text-slate-500 font-bold">
                {t("account.active")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="block text-[13px] font-bold text-white truncate leading-tight">
                  {activeAccount.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(activeAccount);
                  }}
                  aria-label={t("account.rename")}
                  className="w-5 h-5 rounded-md flex items-center justify-center text-slate-600 opacity-0 group-hover/acc:opacity-100 hover:text-white hover:bg-white/[0.08] transition-all shrink-0"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              </span>
            </span>
            <span className="text-right shrink-0">
              <span className="block font-display text-[13px] font-extrabold text-white tabular-nums leading-tight">
                {balance}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm shadow-cyan-500/25">
                {t("account.switchShort")}
                <ChevronDown className={cn("w-2 h-2 transition-transform", open && "rotate-180")} />
              </span>
            </span>
          </button>
        )}
        <AccountSheet open={open} onClose={() => setOpen(false)} />
        {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
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
      </div>
    );
  }

  // Sidebar (bar) variant. Before accounts resolve the rail must reserve the
  // exact slot (same height as the pill) — otherwise the account pill pops in
  // after mount and shifts the whole nav/perf/user column on F5.
  if (!activeAccount) {
    return (
      <div
        aria-hidden="true"
        className="w-full flex items-center gap-2.5 rounded-2xl border border-white/[0.08] px-3 py-2.5"
      >
        <div className="w-8 h-8 rounded-lg bg-white/[0.08] animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 w-2/3 rounded bg-white/[0.08] animate-pulse" />
          <div className="h-2 w-1/3 rounded bg-white/[0.08] animate-pulse" />
        </div>
      </div>
    );
  }
  const ActiveIcon = TYPE_ICON[activeAccount.type];
  const balance = `$${Math.round(activeAccount.startingBalance).toLocaleString("en-US")}`;

  const editingBar = editingId === activeAccount.id;

  return (
    <div className="relative">
      {editingBar ? (
        <div className="flex items-center gap-1.5 rounded-2xl border border-cyan-500/40 bg-white/[0.04] px-3 py-2.5">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename(activeAccount.id);
              if (e.key === "Escape") setEditingId(null);
            }}
            autoFocus
            maxLength={40}
            placeholder={activeAccount.name}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white focus:outline-none placeholder-slate-600"
          />
          <button
            onClick={() => commitRename(activeAccount.id)}
            aria-label={t("common.save")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            aria-label={t("common.cancel")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          title={t("account.switch")}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-2xl border transition-all",
            compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
            "bg-white/[0.04] border-white/[0.08] hover:border-cyan-500/30 hover:bg-white/[0.06]",
          )}
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${activeAccount.color}22`, color: activeAccount.color }}
          >
            <ActiveIcon className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="flex items-center gap-1.5">
              <span className="block text-sm font-semibold text-white truncate">
                {activeAccount.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(activeAccount);
                }}
                aria-label={t("account.rename")}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 opacity-0 hover:opacity-100 hover:text-white hover:bg-white/[0.08] transition-all shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </span>
            <span className="block text-[10px] text-slate-500 truncate tabular-nums">
              {balance} · {t(TYPE_LABEL_KEY[activeAccount.type])}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-cyan-400/80 shrink-0">
            {t("account.switchShort")}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      )}

      <AccountSheet open={open} onClose={() => setOpen(false)} />

      {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
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
    </div>
  );
}

/** Two-step destructive confirmation: a first "I understand" gate, then the
 *  actual red delete — trades and history go with the account (FK cascade). */
function DeleteAccountModal({
  account,
  onConfirm,
  onClose,
}: {
  account: Account;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const Icon = TYPE_ICON[account.type];

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-sm p-6 border border-red-500/20"
      wrapperClassName="z-[110]"
    >
      <div>
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-white text-center mb-1">
          {step === 1 ? t("account.deleteTitle") : t("account.deleteTitle2")}
        </h2>

        <div className="flex items-center justify-center gap-2 my-3">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${account.color}22`, color: account.color }}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-bold text-white">{account.name}</span>
        </div>

        <p className="text-sm text-slate-400 text-center mb-5 leading-relaxed">
          {step === 1 ? t("account.deleteWarn1") : t("account.deleteWarn2")}
        </p>

        <div className="grid gap-2">
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl text-sm font-bold bg-white/[0.06] border border-white/[0.1] text-slate-200 hover:bg-white/[0.1] transition-all"
            >
              {t("account.deleteStep1Cta")}
            </button>
          ) : (
            <button
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                await onConfirm();
              }}
              disabled={busy}
              className="w-full h-11 rounded-xl text-sm font-bold bg-red-500/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/25 transition-all disabled:opacity-60"
            >
              {busy ? t("common.loading") : t("account.deleteStep2Cta")}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateAccountModal({ onClose }: { onClose: () => void }) {
  const { addAccount } = useAccounts();
  const { t } = useT();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("prop");
  const [balance, setBalance] = useState("50000");
  const [busy, setBusy] = useState(false);

  const types: AccountType[] = ["personal", "prop", "demo", "live"];

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await addAccount({ name: trimmed, type, startingBalance: Number(balance) || 0 });
      onClose();
    } catch (e) {
      console.error("Failed to create account", e);
      setBusy(false);
    }
  };

  // Same shell as Add Trade and Missed Setup: shared `Modal` (centered on
  // desktop, bottom sheet on mobile, blurred backdrop, Esc-to-close,
  // scroll-lock), a 2px accent rule, a 24px header, a body on the design
  // system's field skin, and a sticky action footer.
  const label = "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-lg"
      labelledBy="create-account-title"
      wrapperClassName="z-[100]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h2
          id="create-account-title"
          className="text-lg font-bold text-white flex items-center gap-2.5"
        >
          <Layers className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
          {t("account.new")}
        </h2>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <label className={label}>{t("account.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            autoFocus
            placeholder={t("account.namePlaceholder")}
            className={cn(FIELD_BASE, "h-11")}
          />
        </div>

        <div>
          <label className={label}>{t("account.type")}</label>
          {/* The one chip of the design system — identical to the Mistakes and
              Confluences bubbles in the Add Trade modal. */}
          <div className={CHIP_ROW}>
            {types.map((tp) => {
              const TypeIcon = TYPE_ICON[tp];
              return (
                <Chip key={tp} selected={type === tp} onClick={() => setType(tp)}>
                  <TypeIcon className="w-3.5 h-3.5" /> {t(TYPE_LABEL_KEY[tp])}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <label className={label}>{t("account.startingBalance")}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              className={cn(FIELD_BASE, "h-11 pl-7")}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={create}
          disabled={!name.trim() || busy}
          className={cn(
            "px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
            name.trim() && !busy
              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
              : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
          )}
        >
          {busy ? t("account.creating") : t("account.create")}
        </button>
      </div>
    </Modal>
  );
}

export type { Account };
