import { useEffect, useState } from "react";
import { Bot, ArrowRight, MessageSquare } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useConversations, sessionConversationStore } from "../components/jarvis/conversations";
import { cn } from "../utils/cn";

/**
 * Jarvis — point d'entrée (launcher).
 *
 * Ouvre le MÊME overlay que le dock : une seule discussion, un seul historique,
 * partout dans l'app. Simple à l'arrivée : identité, aperçu de la dernière
 * conversation, et un bouton pour discuter.
 */

export default function Jarvis() {
  const { t } = useT();
  const { user } = useAuth();
  const conversations = useConversations(user?.id);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || conversations.length === 0) {
      setPreview(null);
      return;
    }
    let active = true;
    void sessionConversationStore(user.id)
      .get(conversations[0].id)
      .then((c) => {
        if (!active) return;
        const last = [...(c?.messages ?? [])].reverse().find((m) => m.role === "assistant");
        const md = last?.blocks.find((b) => b.type === "markdown");
        if (md && md.type === "markdown" && md.content.trim()) {
          setPreview(md.content.replace(/[*#>]/g, "").trim().slice(0, 180));
        } else {
          setPreview(null);
        }
      })
      .catch(() => setPreview(null));
    return () => {
      active = false;
    };
  }, [user?.id, conversations]);

  const openJarvis = () => window.dispatchEvent(new Event("tv:open-jarvis"));

  return (
    <div className="h-full flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg text-center">
        {/* Avatar Jarvis */}
        <div className="relative mx-auto w-16 h-16 mb-5">
          <span className="absolute -inset-2 rounded-3xl bg-cyan-500/30 blur-lg" />
          <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-xl shadow-cyan-500/30">
            <Bot className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Jarvis</h1>
        <p className="text-sm text-slate-400 mt-1.5 mb-7">{t("jarvis.copilot")}</p>

        {/* CTA principal — ouvre le même overlay (même historique) */}
        <button
          onClick={openJarvis}
          className={cn(
            "group inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white",
            "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400",
            "shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]",
          )}
        >
          <MessageSquare className="w-4 h-4" />
          {t("jarvisHome.ask")}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Aperçu de la dernière conversation — preuve que Jarvis se souvient */}
        {preview && (
          <div className="mt-6 text-left rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Dernière conversation
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed line-clamp-3">{preview}</p>
          </div>
        )}
      </div>
    </div>
  );
}
