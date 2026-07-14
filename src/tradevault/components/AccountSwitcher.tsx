import { useState } from "react";
import { User, Building2, FlaskConical, Zap, Check, ChevronDown, Plus, X } from "lucide-react";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Account, AccountType } from "../store";

const TYPE_ICON: Record<AccountType, typeof User> = {
  personal: User, prop: Building2, demo: FlaskConical, live: Zap,
};
function typeLabel(type: AccountType, fr: boolean): string {
  const m: Record<AccountType, [string, string]> = {
    personal: ["Personnel", "Personal"],
    prop: ["Prop Firm", "Prop Firm"],
    demo: ["Démo", "Demo"],
    live: ["Live", "Live"],
  };
  return fr ? m[type][0] : m[type][1];
}

export default function AccountSwitcher({ compact }: { compact?: boolean }) {
  const { accounts, activeAccount, switchAccount } = useAccounts();
  const { lang } = useT();
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  if (!activeAccount) return null;
  const ActiveIcon = TYPE_ICON[activeAccount.type];

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
          <span className="block text-[10px] text-slate-500 truncate">{typeLabel(activeAccount.type, fr)}</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 z-[61] glass-strong rounded-2xl p-1.5 shadow-2xl shadow-black/50 animate-fade-in max-h-[60vh] overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
              {fr ? "Comptes" : "Accounts"}
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
                    <span className="block text-[10px] text-slate-500">{typeLabel(a.type, fr)}</span>
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
              <span className="text-sm font-semibold">{fr ? "Nouveau compte" : "New account"}</span>
            </button>
          </div>
        </>
      )}

      {createOpen && <CreateAccountModal fr={fr} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateAccountModal({ fr, onClose }: { fr: boolean; onClose: () => void }) {
  const { addAccount } = useAccounts();
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
          <h2 className="text-lg font-bold text-white">{fr ? "Nouveau compte" : "New account"}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {fr ? "Nom" : "Name"}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder={fr ? "ex. FTMO 100K" : "e.g. FTMO 100K"}
          className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 mb-4"
        />

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {fr ? "Type" : "Type"}
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
                <Icon className="w-4 h-4" /> {typeLabel(tp, fr)}
              </button>
            );
          })}
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
          {fr ? "Solde de départ" : "Starting balance"}
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
          {busy ? (fr ? "Création…" : "Creating…") : (fr ? "Créer le compte" : "Create account")}
        </button>
      </div>
    </div>
  );
}

export type { Account };
