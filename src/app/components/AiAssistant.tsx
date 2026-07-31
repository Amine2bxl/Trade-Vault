import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Settings, X } from "lucide-react";
import { Trade, Page } from "../types";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import {
  loadJarvisProfile,
  saveJarvisProfile,
  buildJarvisPrefill,
  type JarvisProfile,
} from "../store";
import JarvisProfileModal from "./JarvisProfileModal";
import JarvisShell from "./jarvis/JarvisShell";
import type { JarvisContext } from "./jarvis/context";
import type { JarvisWorkspaceId } from "./jarvis/workspaces";
import {
  migrateLegacyChat,
  sessionConversationStore,
  useConversations,
} from "./jarvis/conversations";
import JarvisSidebar from "./jarvis/components/JarvisSidebar";
import CreditsBar from "./jarvis/components/CreditsBar";
import AccountSwitcher from "./AccountSwitcher";

interface AiAssistantProps {
  trades: Trade[];
  /** Page TradeVault courante — enrichit le contexte agrégé de Jarvis. */
  page?: Page;
}

/**
 * AiAssistant — l'ouvreur de Jarvis (dock + gate profil).
 *
 * Jarvis est une PLATEFORME : ce composant ne contient AUCUNE logique de chat.
 * Il fournit au JarvisShell le contexte agrégé (trades, profil, prompt externe)
 * ; le workspace actif (conversation) vit dans le registre des workspaces.
 */

export default function AiAssistant({ trades, page }: AiAssistantProps) {
  const { t } = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined);
  // Le workspace actif : l'Accueil par défaut, la Conversation sur prompt externe.
  const [activeWorkspace, setActiveWorkspace] = useState<JarvisWorkspaceId>("home");

  // Conversations (couche de données dédiée, multi-sessions).
  const conversations = useConversations(user?.id);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  // Migration one-shot de l'ancien chat unique vers le store.
  useEffect(() => {
    if (!user?.id) return;
    void migrateLegacyChat(sessionConversationStore(user.id), user.id);
  }, [user?.id]);

  const openConversation = useCallback((id: string) => {
    setConversationId(id);
    setActiveWorkspace("conversation");
  }, []);

  const newConversation = useCallback(async () => {
    if (!user?.id) return;
    const conv = await sessionConversationStore(user.id).create();
    openConversation(conv.id);
  }, [user?.id, openConversation]);

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      await sessionConversationStore(user.id).remove(id);
      if (conversationId === id) {
        const list = await sessionConversationStore(user.id).list();
        setConversationId(list[0]?.id ?? null);
        if (list.length === 0) setActiveWorkspace("home");
      }
    },
    [user?.id, conversationId],
  );

  // La sidebar / le coach demandent une analyse → ouvre la Conversation.
  const askJarvis = useCallback(
    (prompt: string) => {
      setPendingPrompt(prompt);
      setActiveWorkspace("conversation");
      if (user?.id && !conversationIdRef.current) {
        void sessionConversationStore(user.id)
          .create()
          .then((c) => setConversationId(c.id))
          .catch(() => {});
      }
    },
    [user?.id],
  );

  // Le dock ouvre toujours sur l'Accueil intelligent (jamais de chat vide).
  const toggleOpen = () => {
    if (!open) setActiveWorkspace("home");
    setOpen((v) => !v);
  };

  // First-open gate: the "Profile Jarvis remembers" card shows until the trader
  // completes it. Re-checked on every open so a dismissed card comes back until
  // it is saved (jarvis_completed_at non-NULL).
  const [profileOpen, setProfileOpen] = useState(false);
  const [jarvisProfile, setJarvisProfile] = useState<JarvisProfile | null>(null);
  const [prefill, setPrefill] = useState<{
    style?: string;
    weakness?: string;
    goal?: string;
  } | null>(null);
  useEffect(() => {
    if (!open || !user?.id) return;
    let active = true;
    loadJarvisProfile(user.id)
      .then((p) => {
        if (!active) return;
        setJarvisProfile(p);
        if (!p.completedAt) setProfileOpen(true);
      })
      .catch(() => {
        // Best-effort: a failed read never blocks the coach.
      });
    // Suggestions depuis les Objectifs / Onboarding pour pré-remplir le profil.
    buildJarvisPrefill(user.id)
      .then((s) => {
        if (active) setPrefill(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, user?.id]);

  // Other pages (e.g. the pre-market Checklist) can open Jarvis with a
  // ready-made prompt via a window event — keeps pages decoupled.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (!prompt) return;
      askJarvis(prompt);
    };
    window.addEventListener("tv:ask-coach", onAsk);
    return () => window.removeEventListener("tv:ask-coach", onAsk);
  }, [askJarvis]);

  // The workspace consumes `pendingPrompt` at mount (initialPrompt). Clear it
  // right after so a re-open without a new event never re-asks the old prompt.
  useEffect(() => {
    if (!open || profileOpen || !pendingPrompt) return;
    const id = requestAnimationFrame(() => setPendingPrompt(undefined));
    return () => cancelAnimationFrame(id);
  }, [open, profileOpen, pendingPrompt]);

  // Contexte agrégé transmis au Shell → workspace (jamais des props métier).
  const context: JarvisContext = useMemo(
    () => ({
      userId: user?.id,
      trades,
      profile: jarvisProfile,
      page,
      conversationId,
      pendingPrompt,
    }),
    [user?.id, trades, jarvisProfile, page, conversationId, pendingPrompt],
  );

  return (
    <>
      {/* Jarvis dock.
          A round gradient bubble is the universal signature of a bolt-on chat
          widget — the thing every SaaS glues to the corner. Jarvis is not a
          widget, it is the product's intelligence, so it gets a piece of app
          chrome instead: the same glass surface, cyan hairline and squircle
          mark used by the Jarvis page and the sidebar, named, with a live
          status dot. On mobile it collapses to the mark alone to stay out of
          the thumb zone, but keeps the identical surface. */}
      <button
        onClick={toggleOpen}
        aria-label={open ? t("assistant.close") : t("assistant.open")}
        aria-expanded={open}
        className={cn(
          "group fixed z-40 bottom-24 right-4 md:bottom-6 md:right-6",
          "flex items-center gap-2.5 rounded-2xl border p-1.5 md:pr-4",
          "glass-strong shadow-xl shadow-black/40 transition-all duration-300",
          "hover:-translate-y-0.5 active:scale-[0.98]",
          open
            ? "border-cyan-400/40 bg-cyan-500/[0.08]"
            : "border-white/[0.1] hover:border-cyan-400/35",
        )}
      >
        <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <span className="relative shrink-0">
          <span
            className={cn(
              "absolute -inset-1 rounded-2xl bg-cyan-500/30 blur-md transition-opacity",
              open ? "opacity-100" : "opacity-0 group-hover:opacity-70",
            )}
          />
          <span className="relative grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
            {open ? (
              <X className="w-4.5 h-4.5 text-white" />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
          </span>
        </span>
        <span className="hidden md:block text-left leading-none">
          <span className="block text-[13px] font-bold text-white">{t("assistant.title")}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </span>
            {t("assistant.dockStatus")}
          </span>
        </span>
      </button>

      {/* Workspace actif : la fenêtre espace de travail (le chat est un module). */}
      {open && !profileOpen && (
        <JarvisShell
          open
          onClose={() => setOpen(false)}
          activeWorkspace={activeWorkspace}
          onNavigateWorkspace={setActiveWorkspace}
          context={context}
          initialPrompt={pendingPrompt}
          actions={
            <button
              onClick={() => setActiveWorkspace("settings")}
              aria-label={t("jarvisSettings.title")}
              title={t("jarvisSettings.title")}
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          }
          sidebar={
            <JarvisSidebar
              conversations={conversations}
              activeId={conversationId}
              onNew={() => void newConversation()}
              onOpenConversation={openConversation}
              onDeleteConversation={(id) => void deleteConversation(id)}
              onOpenHome={() => setActiveWorkspace("home")}
              onAsk={askJarvis}
            />
          }
          footer={
            <>
              <CreditsBar />
              <div className="flex items-center px-2 min-w-[220px]">
                <AccountSwitcher variant="card" />
              </div>
            </>
          }
        />
      )}

      {/* First-open card: the trader tells Jarvis who they are once. */}
      {open && profileOpen && (
        <JarvisProfileModal
          open
          onClose={() => setProfileOpen(false)}
          initial={jarvisProfile}
          suggested={prefill}
          onSave={async (p) => {
            if (!user?.id) return;
            await saveJarvisProfile(user.id, p);
          }}
          onSaved={() => {
            setProfileOpen(false);
            // Make the freshly-saved profile available to Jarvis immediately.
            if (user?.id) {
              loadJarvisProfile(user.id)
                .then((p) => setJarvisProfile(p))
                .catch(() => {});
            }
          }}
        />
      )}
    </>
  );
}
