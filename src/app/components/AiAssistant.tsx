import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Trade, Page } from "../types";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { loadJarvisProfile, type JarvisProfile } from "../store";
import { JarvisMark } from "@/shared/ui";
import JarvisShell from "./jarvis/JarvisShell";
import type { JarvisContext } from "./jarvis/context";
import type { JarvisWorkspaceId } from "./jarvis/workspaces";
import {
  migrateLegacyChat,
  jarvisConversationStore,
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
    void migrateLegacyChat(jarvisConversationStore(user.id), user.id);
  }, [user?.id]);

  const openConversation = useCallback((id: string) => {
    setConversationId(id);
    setActiveWorkspace("conversation");
  }, []);

  const newConversation = useCallback(async () => {
    if (!user?.id) return;
    const conv = await jarvisConversationStore(user.id).create();
    openConversation(conv.id);
  }, [user?.id, openConversation]);

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      await jarvisConversationStore(user.id).remove(id);
      if (conversationId === id) {
        const list = await jarvisConversationStore(user.id).list();
        setConversationId(list[0]?.id ?? null);
        if (list.length === 0) setActiveWorkspace("home");
      }
    },
    [user?.id, conversationId],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      if (!user?.id || !title) return;
      await jarvisConversationStore(user.id).rename(id, title);
    },
    [user?.id],
  );

  const togglePinConversation = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      await jarvisConversationStore(user.id).togglePin(id);
    },
    [user?.id],
  );

  // La sidebar / le coach demandent une analyse → ouvre la Conversation.
  const askJarvis = useCallback(
    (prompt: string) => {
      setPendingPrompt(prompt);
      setActiveWorkspace("conversation");
      if (user?.id && !conversationIdRef.current) {
        void jarvisConversationStore(user.id)
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

  // Profil Jarvis chargé pour le contexte (le modal « première-prise » a été
  // supprimé : on atterrit directement sur l'accueil). L'édition vit dans
  // Settings → Profil mémorisé.
  const [jarvisProfile, setJarvisProfile] = useState<JarvisProfile | null>(null);
  useEffect(() => {
    if (!open || !user?.id) return;
    let active = true;
    loadJarvisProfile(user.id)
      .then((p) => {
        if (active) setJarvisProfile(p);
      })
      .catch(() => {
        // Best-effort: a failed read never blocks the coach.
      });
    return () => {
      active = false;
    };
  }, [open, user?.id]);

  // La page Jarvis (nav) ouvre le MÊME overlay — conversation et historique
  // partagés partout. Un seul Jarvis, deux points d'entrée.
  useEffect(() => {
    const onOpen = () => {
      setActiveWorkspace("conversation");
      setOpen(true);
    };
    window.addEventListener("tv:open-jarvis", onOpen);
    return () => window.removeEventListener("tv:open-jarvis", onOpen);
  }, []);

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
    if (!open || !pendingPrompt) return;
    const id = requestAnimationFrame(() => setPendingPrompt(undefined));
    return () => cancelAnimationFrame(id);
  }, [open, pendingPrompt]);

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
      {/* ── LE MODULE FIXE ────────────────────────────────────────────────
          Jarvis n'est pas un widget greffé dans un coin : c'est l'intelligence
          du produit, donc son point d'entrée est du CHROME d'application.

          Ce qu'il portait et qui est parti : un halo cyan flou derrière la
          marque, un point qui clignotait en boucle pour annoncer « coach en
          ligne » — une information qui ne change jamais et qui n'appelle donc
          aucune attention — et une seconde ligne de texte sous le nom. Trois
          effets pour un bouton, sur un système dont la règle est que rien ne
          rayonne et que la couleur est rare.

          ── CE QUI RESTAIT BON MARCHÉ, ET POURQUOI ──────────────────────────

          Deux choses, et aucune n'était une question de réglage :

          1. LE GLYPHE ÉTAIT UN ROBOT DE BIBLIOTHÈQUE (`Bot` de lucide). C'est
             le dessin que tout le monde colle dans un coin pour dire « il y a
             une IA ici ». Un produit dont l'IA est l'argument central ne peut
             pas la signer avec l'icône générique du greffon. Jarvis porte
             maintenant le V de *Vault* (`JarvisMark`), construit comme le mot
             de la marque : un bras fin et sourd, un bras épais et plein.

          2. LE REPOS ÉTAIT GRIS SUR GRIS. Un sigle sourd sur une plaque sourde
             ne se lit pas comme « discret » mais comme « désactivé » : discret,
             c'est petit et sans effet ; désactivé, c'est sans contraste. Le
             sigle passe en texte primaire, et sa plaque garde un filet d'accent
             en creux — un liseré, pas une lueur.

          L'À-PLAT D'ACCENT RESTE À L'ÉTAT OUVERT, et à lui seul : sur
          téléphone, le « + » de la barre basse est déjà le seul aplat saturé de
          l'écran. Deux pastilles vertes à trente pixels l'une de l'autre, et
          plus aucune des deux ne désigne quoi que ce soit. */}
      <button
        onClick={toggleOpen}
        aria-label={open ? t("assistant.close") : t("assistant.open")}
        aria-expanded={open}
        className={cn(
          "tv-jarvis-dock fixed z-[var(--tv-z-float)] bottom-[calc(96px_+_env(safe-area-inset-bottom,0px))] right-4 md:bottom-6 md:right-6",
          "justify-center gap-2.5 rounded-full p-1.5 md:rounded-2xl md:pr-4",
          "active:scale-[0.98]",
          open && "tv-jarvis-dock-active",
        )}
      >
        <span
          className={cn(
            "tv-jarvis-mark h-8 w-8 shrink-0 md:h-9 md:w-9",
            open && "tv-jarvis-mark-on",
          )}
        >
          {open ? (
            <X className="h-4 w-4" />
          ) : (
            <JarvisMark className="h-5 w-5 md:h-[22px] md:w-[22px]" />
          )}
        </span>
        {/* Le nom en texte PRIMAIRE, au repos comme ouvert. En secondaire, il
            achevait de faire lire le module comme un contrôle éteint. */}
        <span className="hidden text-[13px] font-semibold tracking-[-0.01em] text-[var(--tv-text-primary)] md:block">
          {t("assistant.title")}
        </span>
      </button>

      {/* Workspace actif : la fenêtre espace de travail (le chat est un module). */}
      {open && (
        <JarvisShell
          open
          onClose={() => setOpen(false)}
          activeWorkspace={activeWorkspace}
          onNavigateWorkspace={setActiveWorkspace}
          context={context}
          initialPrompt={pendingPrompt}
          /* Plus d'engrenage anonyme à droite de l'en-tête : « Réglages » est
             un espace de travail comme les deux autres, et il vit donc dans la
             navigation de la fenêtre, nommé. */
          sidebar={
            <JarvisSidebar
              conversations={conversations}
              activeId={conversationId}
              onNew={() => void newConversation()}
              onOpenConversation={openConversation}
              onDeleteConversation={(id) => void deleteConversation(id)}
              onRenameConversation={(id, title) => void renameConversation(id, title)}
              onTogglePin={(id) => void togglePinConversation(id)}
            />
          }
          footer={<CreditsBar />}
        />
      )}
    </>
  );
}
