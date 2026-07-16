import { useState } from "react";
import { User, Building2, FlaskConical, Zap, Check, ChevronDown, Plus, X, Pencil } from "lucide-react";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Account, AccountType } from "../store";

const TYPE_ICON: Record<AccountType, typeof User> = {
  personal: User, prop: Building2, demo: FlaskConical, live: Zap,
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
  variant?: "bar" | "fab";
}) {
  const { accounts, activeAccount, switchAccount, editAccount } = useAccounts();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

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

  if (!activeAccount) return null;
  const ActiveIcon = TYPE_ICON[activeAccount.type];

  // Mobile FAB: a floating circular button (bottom-left, mirroring the AI Coach)
  // that opens a premium bottom sheet of tappable account cards — one tap to
  // switch sub-accounts. Original layout, no dropdown crowding the top bar.
  if (variant === "fab") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label={t("account.switch")}
          className="md:hidden fixed z-40 bottom-24 left-4 w-11 h-11 rounded-full flex items-center justify-center border backdrop-blur-md shadow-md active:scale-95 transition-transform"
          style={{
            background: `${activeAccount.color}26`,
            borderColor: `${activeAccount.color}66`,
            color: activeAccount.color,
          }}
        >
          <ActiveIcon className="w-5 h-5" />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0a0f1e] border border-white/15 flex items-center justify-center"
          >
            <ChevronDown className="w-2.5 h-2.5 text-slate-300" />
          </span>
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
                  <p className="text-[11px] text-slate-500">
                    {t("account.subtitle")}
                  </p>
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
                      style={active ? { borderColor: `${a.color}80`, boxShadow: `0 0 0 1px ${a.color}40` } : undefined}
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
                          <span className="block text-sm font-bold text-white truncate">{a.name}</span>
                          <span className="block text-[10px] text-slate-500 truncate">{t(TYPE_LABEL_KEY[a.type])}</span>
                        </span>
                      </button>

                      {/* Rename affordance */}
                      <button
                        onClick={() => startRename(a)}
                        aria-label={t("account.rename")}
                        className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

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
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-2xl border transition-all",
          compact ? "px-3 py-2" : "px-3 py-2.5",
          "bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]",
        )}
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${activeAccount.color}22`, color: activeAccount.color }}
        >
          <ActiveIcon className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-semibold text-white truncate">{activeAccount.name}</span>
          <span className="block text-[10px] text-slate-500 truncate">{t(TYPE_LABEL_KEY[activeAccount.type])}</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 z-[61] glass-strong rounded-2xl p-1.5 shadow-2xl shadow-black/50 animate-fade-in max-h-[60vh] overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
              {t("account.title")}
            </div>
            {accounts.map((a) => {
              const Icon = TYPE_ICON[a.type];
              const active = a.id === activeAccount.id;
              return (
                <button
                  key={a.id}
                  onClick={() => { switchAccount(a.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-left",
                    active ? "bg-cyan-500/15" : "hover:bg-white/[0.06]",
                  )}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${a.color}22`, color: a.color }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={cn("block text-sm font-medium truncate", active ? "text-white" : "text-slate-300")}>{a.name}</span>
                    <span className="block text-[10px] text-slate-500">{t(TYPE_LABEL_KEY[a.type])}</span>
                  </span>
                  {active && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
                </button>
              );
            })}
            <div className="h-px bg-white/[0.06] my-1.5 mx-1" />
            <button
              onClick={() => { setCreateOpen(true); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold">{t("account.new")}</span>
            </button>
          </div>
        </>
      )}

      {createOpen && <CreateAccountModal onClose={() => setCreateOpen(false)} />}
    </div>
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-strong rounded-3xl p-6 max-w-sm w-full animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{t("account.new")}</h2>
          <button onClick={onClose} aria-label={t("common.close")} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {t("account.name")}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder={t("account.namePlaceholder")}
          className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 mb-4"
        />

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {t("account.type")}
        </label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {types.map((tp) => {
            const Icon = TYPE_ICON[tp];
            const active = type === tp;
            return (
              <button
                key={tp}
                onClick={() => setType(tp)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 border text-sm font-medium transition-all",
                  active ? "bg-cyan-500/15 border-cyan-400/50 text-white" : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20",
                )}
              >
                <Icon className="w-4 h-4" /> {t(TYPE_LABEL_KEY[tp])}
              </button>
            );
          })}
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {t("account.startingBalance")}
        </label>
        <div className="relative mb-5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl pl-7 pr-3 text-sm text-white focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        <button
          onClick={create}
          disabled={!name.trim() || busy}
          className={cn(
            "w-full h-11 rounded-xl text-sm font-bold transition-all",
            name.trim() && !busy
              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
              : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
          )}
        >
          {busy ? t("account.creating") : t("account.create")}
        </button>
      </div>
    </div>
  );
}

export type { Account };
