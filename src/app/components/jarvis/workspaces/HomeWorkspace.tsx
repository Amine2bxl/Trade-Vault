import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { computeStats } from "../../../utils/tradeCalcs";
import { computeBehaviorSignals } from "../../../utils/behaviorSignals";
import { deriveDailyRule } from "../../../utils/edgeScore";
import { loadOnboarding, type OnboardingData } from "../../../store";
import { sessionJarvisMemory } from "../insights/memory";
import { buildHomeBlocks } from "../insights/buildHome";
import type { CopyContext } from "../insights/copy/templates";
import type { JarvisHomeData, JarvisMemory } from "../insights/types";
import { BlockList } from "../BlockRenderer";
import type { JarvisBlock } from "../blocks";
import type { JarvisWorkspaceProps } from "../workspaces";

/**
 * HomeWorkspace — l'ACCUEIL intelligent de Jarvis (Phase 1, Étape 5).
 *
 * ORCHESTRATEUR UNIQUEMENT : aucune logique métier ici. Le pipeline complet
 * (data → engine → confiance → copy → toBlocks) vit dans le module insights ;
 * ce composant charge les données + la mémoire, appelle `buildHomeBlocks` et
 * rend le résultat via `BlockList`.
 *
 * Jarvis n'est jamais vide : soit un insight validé (Hero/Insight/Mission),
 * soit le mode apprentissage (pas de conclusion inventée).
 */

export default function HomeWorkspace({ context }: JarvisWorkspaceProps) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [blocks, setBlocks] = useState<JarvisBlock[] | null>(null);

  // Snapshot de données (pur, synchrone, déjà en cache côté trades).
  const stats = useMemo(() => computeStats(context.trades), [context.trades]);
  const signals = useMemo(() => computeBehaviorSignals(context.trades), [context.trades]);
  const rule = useMemo(() => deriveDailyRule(stats), [stats]);
  const data: JarvisHomeData = useMemo(
    () => ({
      trades: context.trades,
      stats,
      signals,
      edge: null,
      rule,
      profile: context.profile ?? null,
      onboarding,
    }),
    [context.trades, context.profile, stats, signals, rule, onboarding],
  );

  // Voice mode (onboarding.experience) — chargé en arrière-plan, best-effort.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    loadOnboarding(user.id)
      .then((o) => {
        if (active) setOnboarding(o);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Pipeline : mémoire → engine → blocs (une seule passe par changement de data).
  useEffect(() => {
    let active = true;
    void (async () => {
      const store = sessionJarvisMemory();
      const memory = await store.read();
      if (!active) return;
      const copyLang: "fr" | "en" = lang === "fr" ? "fr" : "en";
      const ctx: CopyContext = { lang: copyLang, experience: onboarding?.experience };
      const { blocks: built, pattern } = buildHomeBlocks(data, memory, ctx);
      if (!active) return;
      setBlocks(built);

      // Anti-répétition : maj mémoire (premier open du jour fige le pattern).
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = memory.lastShownDate !== today;
      const next: JarvisMemory = {
        ...memory,
        lastShownDate: today,
        seenCount: isNewDay ? 1 : memory.seenCount + 1,
      };
      if (isNewDay && pattern) next.lastPattern = pattern;
      await store.write(next);
    })();
    return () => {
      active = false;
    };
  }, [data, lang, onboarding?.experience]);

  const firstName = context.profile?.firstName || t("jarvisHome.trader");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 md:py-5">
      {/* En-tête : Jarvis s'adresse au trader, jamais d'écran vide. */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400/80 mb-2">
        <Sparkles className="w-3.5 h-3.5" />
        {t("assistant.title")}
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-1 tracking-tight">
        {t("jarvisHome.greeting")} {firstName}.
      </h2>
      <p className="text-sm text-slate-500 mb-5">{t("jarvisHome.subtitle")}</p>

      {blocks === null ? (
        <div className="space-y-3">
          <div className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
          <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
        </div>
      ) : (
        <BlockList blocks={blocks} />
      )}
    </div>
  );
}
