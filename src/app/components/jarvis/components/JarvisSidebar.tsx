import {
  Home,
  Plus,
  MessagesSquare,
  Sparkles,
  StickyNote,
  ClipboardList,
  Tags as TagsIcon,
  CalendarDays,
  Newspaper,
  Trash2,
} from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { cn } from "../../../utils/cn";
import AccountSwitcher from "../../AccountSwitcher";
import type { ConversationMeta } from "../conversations";

/**
 * JarvisSidebar — la navigation du cockpit (structure façon Atlas/Focus Pip).
 *
 * Organisée en sections : PRINCIPAL (Aperçu, Nouvelle discussion, Conversations),
 * ANALYSE (Analyse IA, Notes, Plans, Tags), DONNÉES (Calendrier économique,
 * Actualités). Chaque entrée réutilise l'architecture existante (navigation vers
 * un workspace, ou conversation pilotée par un prompt) — aucune logique métier
 * ajoutée, les futures fonctionnalités s'y brancheront sans refonte.
 */

interface JarvisSidebarProps {
  conversations: ConversationMeta[];
  activeId: string | null;
  onNew: () => void;
  onOpenConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenHome: () => void;
  onAsk: (prompt: string) => void;
}

interface Entry {
  id: string;
  icon: typeof Home;
  label: string;
  onClick: () => void;
}

export default function JarvisSidebar({
  conversations,
  activeId,
  onNew,
  onOpenConversation,
  onDeleteConversation,
  onOpenHome,
  onAsk,
}: JarvisSidebarProps) {
  const { t } = useT();

  const principal: Entry[] = [
    { id: "overview", icon: Home, label: t("jarvisSide.overview"), onClick: onOpenHome },
    { id: "new", icon: Plus, label: t("jarvisSide.new"), onClick: onNew },
  ];
  const analyse: Entry[] = [
    {
      id: "analyse",
      icon: Sparkles,
      label: t("jarvisSide.analyseEntry"),
      onClick: () => onAsk(t("jarvisSide.promptAnalyse")),
    },
    {
      id: "notes",
      icon: StickyNote,
      label: t("jarvisSide.notes"),
      onClick: () => onAsk(t("jarvisSide.promptNotes")),
    },
    {
      id: "plans",
      icon: ClipboardList,
      label: t("jarvisSide.plans"),
      onClick: () => onAsk(t("jarvisSide.promptPlans")),
    },
    {
      id: "tags",
      icon: TagsIcon,
      label: t("jarvisSide.tags"),
      onClick: () => onAsk(t("jarvisSide.promptTags")),
    },
  ];
  const donnees: Entry[] = [
    {
      id: "calendar",
      icon: CalendarDays,
      label: t("jarvisSide.calendar"),
      onClick: () => onAsk(t("jarvisSide.promptCalendar")),
    },
    {
      id: "news",
      icon: Newspaper,
      label: t("jarvisSide.news"),
      onClick: () => onAsk(t("jarvisSide.promptNews")),
    },
  ];

  const renderSection = (title: string, entries: Entry[]) => (
    <div className="space-y-px">
      <div className="px-3 pb-1 pt-3 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
        {title}
      </div>
      {entries.map((e) => (
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
  );

  return (
    <div className="flex flex-col h-full min-h-0 w-full min-w-0">
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 min-h-0">
        {renderSection(t("jarvisSide.principal"), principal)}

        {/* Conversations */}
        {conversations.length > 0 && (
          <div className="space-y-px mt-1">
            <div className="px-3 pb-1 pt-3 text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">
              {t("jarvisSide.conversations")}
            </div>
            {conversations.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer transition-colors",
                  c.id === activeId ? "bg-cyan-500/15" : "hover:bg-white/[0.04]",
                )}
                onClick={() => onOpenConversation(c.id)}
              >
                <MessagesSquare className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="flex-1 min-w-0 text-[12.5px] text-slate-300 truncate">
                  {c.title}
                </span>
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
            ))}
          </div>
        )}

        {renderSection(t("jarvisSide.analyse"), analyse)}
        {renderSection(t("jarvisSide.data"), donnees)}

        {conversations.length === 0 && (
          <p className="px-3 pt-3 text-[11px] text-slate-600 leading-relaxed">
            {t("jarvisConv.empty")}
          </p>
        )}
      </div>

      {/* Compte actif — bas gauche de la sidebar (carte CTA premium) */}
      <div className="shrink-0 border-t border-white/[0.05] px-2 py-2.5">
        <AccountSwitcher variant="card" />
      </div>
    </div>
  );
}
