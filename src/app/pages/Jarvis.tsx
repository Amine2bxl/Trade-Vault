import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import ProposalsPanel from "../components/jarvis/components/ProposalsPanel";
import { usePageActions, usePageLead } from "../contexts/PageActionsContext";

const ConversationWorkspace = lazy(
  () => import("../components/jarvis/workspaces/ConversationWorkspace"),
);

/**
 * JARVIS — LA PAGE EST LA CONVERSATION.
 *
 * ══ CE QUI LA RENDAIT BIZARRE ══
 *
 *   • ELLE NE REMPLISSAIT PAS L'ÉCRAN. Sa hauteur était écrite à la main —
 *     `calc(100dvh - 9rem)` — c'est-à-dire une hypothèse sur la hauteur de la
 *     barre de tête. L'hypothèse est fausse dès que la barre change (et elle a
 *     changé : elle se replie dans la marge quand la section n'a qu'une vue) :
 *     cent cinquante pixels de vide sous le panneau, mesurés. La hauteur est
 *     maintenant LUE, pas devinée — le panneau part de là où il est réellement
 *     posé et descend jusqu'au bas de la fenêtre.
 *
 *   • DEUX IDENTITÉS L'UNE SUR L'AUTRE. Un en-tête « Jarvis » dans le panneau,
 *     et juste dessous l'état vide de la conversation qui affiche… l'avatar,
 *     le nom et la même promesse. Pendant ce temps la barre de tête de
 *     l'application, au-dessus, était VIDE — la section Jarvis n'a qu'une vue,
 *     donc pas d'onglets. L'identité et « nouvelle conversation » y montent :
 *     le panneau ne porte plus que la conversation.
 *
 *   • UNE PASTILLE « EN LIGNE » QUI CLIGNOTE. Un assistant est toujours en
 *     ligne : le badge n'informait de rien et animait en permanence un point
 *     vert dans le coin de l'œil. Avec lui part le halo flou posé derrière
 *     l'avatar.
 *
 *   • DU FRANÇAIS ET DE L'ANGLAIS EN DUR, choisis par un ternaire `fr ? … : …`
 *     dans une application traduite en douze langues : les dix autres
 *     recevaient l'anglais.
 */

export default function Jarvis() {
  const { user } = useAuth();
  const { t } = useT();
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

  /* ── LA HAUTEUR EST MESURÉE, PAS DEVINÉE ──────────────────────────────
     Une conversation doit descendre jusqu'au bas de la fenêtre : c'est ce qui
     fait la différence entre « une page qui contient un chat » et « un chat ».
     Elle ne peut pas être déduite en CSS ici — le panneau vit dans une fenêtre
     de défilement dont la hauteur ne lui est pas transmise —, alors on lit sa
     position réelle et on prend tout ce qu'il reste dessous. Sur téléphone, on
     réserve la barre de navigation basse, qui flotte par-dessus. */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [hauteur, setHauteur] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const mesurer = () => {
      const haut = el.getBoundingClientRect().top;
      const basse = window.innerWidth < 768 ? 84 : 16;
      setHauteur(Math.max(420, Math.round(window.innerHeight - haut - basse)));
    };
    /* TROIS MESURES, ET C'EST NÉCESSAIRE.
       La première tombe trop tôt : `usePageLead` et `usePageActions` posent
       leur contenu dans la barre de tête via un effet, DONC APRÈS cette
       mesure. La barre est alors vide, plus courte, et le panneau se croit
       plus haut qu'il ne peut l'être — il déborde ensuite par le bas, et le
       compteur de crédits se fait couper. La trame suivante et un dernier
       filet à 200 ms rattrapent la barre une fois garnie. */
    mesurer();
    const trame = requestAnimationFrame(mesurer);
    const filet = setTimeout(mesurer, 200);
    window.addEventListener("resize", mesurer);
    return () => {
      cancelAnimationFrame(trame);
      clearTimeout(filet);
      window.removeEventListener("resize", mesurer);
    };
  }, []);

  /* ── L'IDENTITÉ MONTE DANS LA BARRE DE TÊTE ─────────────────────────── */
  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="tv-accent-fill grid h-6 w-6 shrink-0 place-items-center rounded-lg">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="font-display shrink-0 text-sm font-bold tracking-tight text-white">
          {t("assistant.title")}
        </span>
        {/* La promesse ne tient pas dans la barre d'un téléphone : elle y
            perdait « journal », le mot qui la rend vraie. */}
        <span aria-hidden className="hidden h-3.5 w-px shrink-0 bg-white/[0.12] md:block" />
        <span className="tv-row-label hidden truncate md:block">{t("jarvis.pageLead")}</span>
      </div>
    ),
    [t],
  );
  usePageLead(lead);

  const actions = useMemo(
    () => (
      <button
        onClick={() => void newConversation()}
        className="btn-ghost btn-sm shrink-0"
        title={t("jarvis.newConversation")}
      >
        <Eraser className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("jarvis.newConversation")}</span>
      </button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, user?.id],
  );
  usePageActions(actions);

  /* Mémoïsé : `ConversationWorkspace` a des effets dépendant du contexte —
     un objet neuf à chaque rendu les relancerait en boucle. */
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
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
        {t("jarvis.waking")}
      </div>
    </div>
  );

  return (
    <div ref={boxRef} className="p-3 md:p-4" style={{ height: hauteur }}>
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.015]">
        {/* ── LES CONSEILS DE JARVIS ─────────────────────────────────────
            Ils existaient déjà, adossés à des motifs mesurés sur les trades du
            trader (une proposition sans preuve chiffrée ne s'affiche PAS) —
            mais ils vivaient dans l'espace « accueil » du panneau flottant,
            que rien n'ouvre depuis la page Jarvis. Le trader n'a jamais vu le
            seul endroit du produit où son coach lui propose quelque chose.
            Ils sont ici, au-dessus de la conversation, plafonnés à dix par
            mois calendaire. */}
        {user?.id && (
          <div className="max-h-[45%] shrink-0 overflow-y-auto px-4 pt-4 md:px-6">
            <ProposalsPanel userId={user.id} />
          </div>
        )}

        {/* La conversation, plein cadre — l'en-tête vit dans la barre de tête. */}
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

        {/* Crédits IA (quota du jour) */}
        <div className="shrink-0 border-t border-white/[0.05]">
          <CreditsBar />
        </div>
      </div>
    </div>
  );
}
