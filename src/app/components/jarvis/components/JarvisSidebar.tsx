import { useState } from "react";
import {
  Home,
  Plus,
  History,
  Pin,
  PinOff,
  Pencil,
  Check,
  X,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { cn } from "../../../utils/cn";
import AccountSwitcher from "../../AccountSwitcher";
import type { ConversationMeta } from "../conversations";

/**
 * JarvisSidebar — la navigation du cockpit, volontairement MINIMALE.
 *
 * Trois entrées seulement : Accueil, Nouvelle conversation, Historique.
 * L'historique regroupe les conversations (épinglées en tête) avec des actions
 * au survol : épingler, renommer, supprimer. Plus d'onglets superflus — Jarvis
 * se pilote comme Atlas, pas comme un menu de settings.
 */

interface JarvisSidebarProps {
  conversations: ConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onOpenConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onOpenHome: () => void;
}

export default function JarvisSidebar({
  conversations,
  activeId,
  onNew,
  onOpenConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onOpenHome,
}: JarvisSidebarProps) {
  const { t } = useT();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startRename = (c: ConversationMeta) => {
    setRenamingId(c.id);
    setDraft(c.title);
  };
  const commitRename = () => {
    if (renamingId) onRenameConversation(renamingId, draft.trim());
    setRenamingId(null);
  };

  const nav = [
    { id: "home", icon: Home, label: t("jarvisSide.home"), onClick: onOpenHome },
    { id: "new", icon: Plus, label: t("jarvisSide.new"), onClick: onNew },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 w-full min-w-0">
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 min-h-0">
        {/* Navigation principale */}
        <div className="space-y-px">
          {nav.map((e) => (
            <button
              key={e.id}
              onClick={e.onClick}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
            >
              <e.icon className="w-4 h-4 text-slate-600" />
              <span className="truncate">{e.label}</span>
            </button>
          ))}
        </div>

        {/* Historique — les conversations, épinglées en tête */}
        <div className="space-y-px mt-1">
          <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
            <History className="w-3 h-3" />
            {t("jarvisSide.history")}
          </div>

          {conversations.length === 0 && (
            <p className="px-3 pt-2 text-[11px] text-slate-600 leading-relaxed">
              {t("jarvisConv.empty")}
            </p>
          )}

          {conversations.slice(0, 12).map((c) => {
            const renaming = renamingId === c.id;
            if (renaming) {
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-white/[0.04] border border-cyan-500/30"
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    autoFocus
                    maxLength={64}
                    className="flex-1 min-w-0 bg-transparent text-[12.5px] text-white focus:outline-none placeholder-slate-600"
                  />
                  <button
                    onClick={commitRename}
                    aria-label={t("common.save")}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    aria-label={t("common.cancel")}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-white/[0.06]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg px-1.5 py-1.5 cursor-pointer transition-colors",
                  c.id === activeId ? "bg-cyan-500/15" : "hover:bg-white/[0.04]",
                )}
                onClick={() => onOpenConversation(c.id)}
              >
                <Pin
                  className={cn(
                    "w-3 h-3 shrink-0 transition-colors",
                    c.pinned ? "text-cyan-400" : "text-slate-700",
                  )}
                />
                <span className="flex-1 min-w-0 text-[12.5px] text-slate-300 truncate">
                  {c.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(c.id);
                  }}
                  aria-label={c.pinned ? t("jarvisConv.unpin") : t("jarvisConv.pin")}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100 hover:text-cyan-300 transition-opacity shrink-0"
                >
                  {c.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(c);
                  }}
                  aria-label={t("common.rename")}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(c.id);
                  }}
                  aria-label={t("common.delete")}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {conversations.length > 3 && (
          <div className="flex items-center gap-1.5 px-3 pt-3 text-[10px] text-slate-700">
            <CheckCheck className="w-3 h-3" />
            <span>{t("jarvisSide.historyNote")}</span>
          </div>
        )}
      </div>

      {/* Compte actif — bas gauche de la sidebar (carte CTA premium) */}
      <div className="shrink-0 border-t border-white/[0.05] px-2 py-2.5">
        <AccountSwitcher variant="card" />
      </div>
    </div>
  );
}
