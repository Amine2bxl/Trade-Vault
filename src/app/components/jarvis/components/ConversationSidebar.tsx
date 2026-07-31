import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { cn } from "../../../utils/cn";
import type { ConversationMeta } from "../conversations";

/**
 * ConversationSidebar — la colonne conversations de Jarvis.
 *
 * Listes groupées (Aujourd'hui / Cette semaine / Anciennes), nouvelle
 * discussion, ouverture et suppression. Pure UI : les actions viennent du
 * propriétaire de l'état (AiAssistant) via les callbacks.
 */

interface ConversationSidebarProps {
  conversations: ConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function groupOf(updatedAt: string, now: Date): "today" | "week" | "older" {
  const d = new Date(updatedAt);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays <= 7) return "week";
  return "older";
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onNew,
  onOpen,
  onDelete,
}: ConversationSidebarProps) {
  const { t } = useT();
  const now = useMemoDate();
  const groups: { key: "today" | "week" | "older"; label: string; items: ConversationMeta[] }[] = [
    { key: "today", label: t("jarvisConv.today"), items: [] },
    { key: "week", label: t("jarvisConv.thisWeek"), items: [] },
    { key: "older", label: t("jarvisConv.older"), items: [] },
  ];
  for (const c of conversations) {
    const g = groupOf(c.updatedAt, now);
    groups.find((x) => x.key === g)?.items.push(c);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <button
        onClick={onNew}
        className={cn(
          "mx-3 mt-3 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-bold",
          "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400",
          "text-white shadow-lg shadow-cyan-500/20 transition-all",
        )}
      >
        <Plus className="w-4 h-4" /> {t("jarvisConv.new")}
      </button>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {conversations.length === 0 ? (
          <p className="text-[11px] text-slate-600 leading-relaxed px-1">{t("jarvisConv.empty")}</p>
        ) : (
          groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.key}>
                  <div className="px-1 pb-1.5 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
                    {g.label}
                  </div>
                  <div className="space-y-px">
                    {g.items.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-colors",
                          c.id === activeId ? "bg-cyan-500/15" : "hover:bg-white/[0.04]",
                        )}
                        onClick={() => onOpen(c.id)}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="flex-1 min-w-0 text-[12px] text-slate-300 truncate">
                          {c.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(c.id);
                          }}
                          aria-label={t("common.delete")}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ),
          )
        )}
      </div>
    </div>
  );
}

function useMemoDate(): Date {
  return new Date();
}
