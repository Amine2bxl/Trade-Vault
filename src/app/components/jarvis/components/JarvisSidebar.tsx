import { useState } from "react";
import { Plus, History, Pin, PinOff, Pencil, Check, X, Trash2, CheckCheck } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { cn } from "../../../utils/cn";
import AccountSwitcher from "../../AccountSwitcher";
import type { ConversationMeta } from "../conversations";

/**
 * JarvisSidebar — LA COLONNE DES CONVERSATIONS, et rien d'autre.
 *
 * Elle portait aussi « Accueil ». Depuis que la fenêtre a une navigation
 * nommée dans sa bande de tête (Accueil · Conversation · Réglages), cette
 * entrée était le même geste offert à deux endroits — et deux chemins vers un
 * même écran font douter qu'ils y mènent tous les deux. La colonne garde ce
 * qui lui appartient en propre : ouvrir une NOUVELLE conversation, et
 * retrouver les anciennes (épinglées en tête, avec renommer / épingler /
 * supprimer au survol).
 */

interface JarvisSidebarProps {
  conversations: ConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onOpenConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
}

export default function JarvisSidebar({
  conversations,
  activeId,
  onNew,
  onOpenConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
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

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2.5">
        {/* L'action de la colonne — la seule, donc elle se lit comme un bouton
            et non comme une ligne de menu parmi d'autres. */}
        <button
          type="button"
          onClick={onNew}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2.5 text-[12.5px] font-semibold text-slate-200 transition-colors hover:border-[var(--tv-border-strong)] hover:bg-[var(--tv-plate-3)] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t("jarvisSide.new")}</span>
        </button>

        {/* Historique — les conversations, épinglées en tête */}
        <div className="mt-1 space-y-px">
          <div className="tv-label flex items-center gap-1.5 px-2.5 pb-1 pt-3 text-slate-600">
            <History className="w-3 h-3" />
            {t("jarvisSide.history")}
          </div>

          {conversations.length === 0 && (
            <p className="tv-row-label px-2.5 pt-2 leading-relaxed">{t("jarvisConv.empty")}</p>
          )}

          {conversations.slice(0, 12).map((c) => {
            const renaming = renamingId === c.id;
            if (renaming) {
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--tv-border-accent)] bg-[var(--tv-plate-2)] px-1.5 py-1"
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
                  "group flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors",
                  /* L'actif est une PLAQUE plus claire, pas un aplat coloré :
                     la profondeur vient de la valeur, et l'accent reste à
                     l'action. C'est exactement le contrat de `.tv-subnav`. */
                  c.id === activeId
                    ? "bg-[var(--tv-plate-3)] text-white"
                    : "hover:bg-[var(--tv-plate-2)]",
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
      <div className="shrink-0 border-t border-[var(--tv-border)] px-2 py-2.5">
        <AccountSwitcher variant="card" />
      </div>
    </div>
  );
}
