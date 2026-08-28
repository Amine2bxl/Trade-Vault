import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Bot, Eraser } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useTrades } from "../hooks/useTrades";
import { usePreviewMode } from "../components/PremiumGate";
import { previewTrades } from "../utils/previewTrades";
import { useT } from "../i18n/LanguageContext";
import { loadJarvisProfile, type JarvisProfile } from "../store";
import { jarvisConversationStore } from "../components/jarvis/conversations";
import type { JarvisContext } from "../components/jarvis/context";
import CreditsBar from "../components/jarvis/components/CreditsBar";

const ConversationWorkspace = lazy(
  () => import("../components/jarvis/workspaces/ConversationWorkspace"),
);

/**
 * Jarvis — LE coach, en direct.
 *
 * La page EST la conversation : un champ qui écrit ou écoute (micro), et le
 * dialogue. Plus de vitrine de chiffres entre le trader et son coach — il les
 * a déjà dans le Dashboard. La seule chrome : l'identité, une nouvelle
 * conversation, et le compteur de crédits IA.
 */

export default function Jarvis() {
  const { user } = useAuth();
  const { lang } = useT();
  const fr = lang === "fr";
  const { activeId, ready: accountsReady } = useAccounts();
  const { trades: realTrades } = useTrades(user?.id, activeId, accountsReady);
  // Derrière le mur d'aperçu, Jarvis raisonne sur l'historique de démonstration :
  // un coach qui n'a rien à commenter ne donne envie de rien.
  const preview = usePreviewMode();
  const trades = preview ? previewTrades() : realTrades;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<JarvisProfile | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const store = jarvisConversationStore(user.id);
    store
      .list()
      .then((list) => {
        if (!active) return;
        if (list.length > 0) {
          setConversationId(list[0].id);
          return;
        }
        return store.create().then((c) => {
          if (active) setConversationId(c.id);
        });
      })
      .catch(() => {
        store
          .create()
          .then((c) => {
            if (active) setConversationId(c.id);
          })
          .catch(() => {});
      });
    loadJarvisProfile(user.id)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  const newConversation = async () => {
    if (!user?.id) return;
    try {
      const c = await jarvisConversationStore(user.id).create();
      setConversationId(c.id);
    } catch {
      /* best-effort */
    }
  };

  const context: JarvisContext = useMemo(
    () => ({
      userId: user?.id,
      trades,
      profile,
      page: "insights",
      conversationId,
      pendingPrompt: undefined,
    }),
    [user?.id, trades, profile, conversationId],
  );

  const spinner = (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <div className="h-4 w-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        {fr ? "Jarvis se réveille…" : "Jarvis is waking up…"}
      </div>
    </div>
  );

  return (
    <div className="p-3 md:p-4 h-[calc(100dvh-9rem)] min-h-[560px]">
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.015]">
        {/* ── En-tête minimal ── */}
        <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <span className="relative shrink-0">
            <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
              <Bot className="h-4.5 w-4.5 text-white" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">Jarvis</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {fr ? "En ligne" : "Online"}
              </span>
            </div>
            <p className="truncate text-[11px] text-slate-500">
              {fr
                ? "Tu écrits ou tu lui parles — il a déjà lu ton journal."
                : "Type or speak — he has already read your journal."}
            </p>
          </div>
          <button
            onClick={() => void newConversation()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Eraser className="h-3.5 w-3.5" />
            {fr ? "Nouvelle" : "New"}
          </button>
        </header>

        {/* ── La conversation, grande — écriture ou micro directs ── */}
        <div className="min-h-0 flex-1">
          <Suspense fallback={spinner}>
            {conversationId ? (
              <ConversationWorkspace
                context={context}
                initialPrompt={undefined}
                openWorkspace={() => {}}
              />
            ) : (
              spinner
            )}
          </Suspense>
        </div>

        {/* ── Crédits IA (quota du jour) ── */}
        <div className="shrink-0 border-t border-white/[0.05] bg-gradient-to-b from-transparent to-white/[0.02]">
          <CreditsBar />
        </div>
      </div>
    </div>
  );
}
