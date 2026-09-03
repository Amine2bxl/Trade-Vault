import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Sparkles,
  Check,
  Volume2,
  Bot,
  TrendingUp,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useJarvisVoice } from "../../../utils/jarvisVoice";
import { computeStats } from "../../../utils/tradeCalcs";
import { computeBehaviorSignals } from "../../../utils/behaviorSignals";
import { deriveDailyRule } from "../../../utils/edgeScore";
import { useEdgeScore } from "../../../hooks/useEdgeScore";
import { useTradingRules } from "../../../hooks/useTradingRules";
import { useGoalProgress } from "../../../hooks/useGoalProgress";
import { computeRuleAdherence } from "../../../utils/ruleAdherence";
import { loadOnboarding, loadMissedOpportunities, type OnboardingData } from "../../../store";
import {
  loadTradeIntents,
  loadTradeReflections,
  type TradeIntent,
  type TradeReflection,
} from "../../../store/tradeIntel";
import type { MissedOpportunity } from "../../../types";
import { loadTradingRules, saveTradingRules } from "../../../utils/tradingRules";
import { effectiveCopyLang } from "../prefs";
import { sessionJarvisMemory } from "../insights/memory";
import { buildHomeBlocks } from "../insights/buildHome";
import { buildSuggestions } from "../insights/suggestions";
import { buildDailyBrief } from "../insights/coaching/brief";
import { briefToBlocks } from "../insights/coaching/toBriefBlocks";
import { buildDailyReview } from "../insights/coaching/review";
import { reviewToBlocks } from "../insights/coaching/toReviewBlocks";
import { buildWeeklyEvolution } from "../insights/weekly/build";
import { weeklyToBlocks } from "../insights/weekly/toBlocks";
import type { CopyContext } from "../insights/copy/templates";
import type { JarvisHomeData, JarvisMemory } from "../insights/types";
import { BlockList } from "../BlockRenderer";
import ProposalsPanel from "../components/ProposalsPanel";
import type { JarvisBlock } from "../blocks";
import type { JarvisWorkspaceProps } from "../workspaces";
import { cn } from "../../../utils/cn";

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
  const [welcomeLine, setWelcomeLine] = useState<string | null>(null);
  // Voix CLONÉE partout : `speak` préfère les clips (lignes fixes) puis la
  // voix hébergée ElevenLabs, et ne retombe sur le navigateur qu'en secours.
  const { speak, speaking } = useJarvisVoice();

  // Snapshot de données (pur, synchrone, déjà en cache côté trades).
  const stats = useMemo(() => computeStats(context.trades), [context.trades]);
  const signals = useMemo(() => computeBehaviorSignals(context.trades), [context.trades]);
  const rule = useMemo(() => deriveDailyRule(stats), [stats]);
  // Tenue des règles — hooks PARTAGÉS, aucun recalcul local : `useTradingRules`
  // pour les règles, `useGoalProgress` pour le solde, `computeRuleAdherence`
  // pour la mesure. C'est ce qui permet au détecteur `rule_kept` de dire
  // « tu l'as tenue 11 fois sur 12 » sans que le trader ait à le demander.
  const rules = useTradingRules();
  const { ctx: goalCtx, measured } = useGoalProgress(
    context.trades,
    user?.id ?? context.userId,
    context.activeAccount?.id ?? null,
  );
  const adherence = useMemo(
    () =>
      computeRuleAdherence(context.trades, rules, goalCtx.startingBalance + goalCtx.stats.totalPnl),
    [context.trades, rules, goalCtx.startingBalance, goalCtx.stats.totalPnl],
  );
  const data: JarvisHomeData = useMemo(
    () => ({
      trades: context.trades,
      stats,
      signals,
      rule,
      adherence,
      profile: context.profile ?? null,
      onboarding,
    }),
    [context.trades, context.profile, stats, signals, rule, adherence, onboarding],
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
  const copyLang: "fr" | "en" = effectiveCopyLang(lang);

  // ── Bienvenue vocale CLONÉE ──
  // « Welcome, {Prénom} » + une phrase courte qui varie selon la situation.
  // `speak` utilise la voix créée (clip pré-rendu si la ligne est fixe, sinon
  // voix ElevenLabs, sinon navigateur) — rejouée à chaque ouverture de l'accueil.
  const welcomeRef = useRef<string | null>(null);
  useEffect(() => {
    const phrase = buildWelcomePhrase(data, firstName);
    if (!phrase || welcomeRef.current === phrase) return;
    welcomeRef.current = phrase;
    setWelcomeLine(phrase);
    // Petit délai : laisse la fenêtre se peindre avant de parler (autoplay).
    const id = window.setTimeout(() => void speak(phrase), 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suggestions intelligentes : page active + situation réelle (pur).
  const suggestions = useMemo(
    () => buildSuggestions(data, context.page, copyLang),
    [data, context.page, copyLang],
  );

  // ── Daily Brief (Step 6A) ─────────────────────────────────────────────
  // Relie les calculs déjà faits (stats, signaux, règle, adhérence, objectifs)
  // en sections structurées, chacune adossée à sa preuve + deep-link.
  const briefBlocks = useMemo(() => {
    const brief = buildDailyBrief({
      trades: data.trades,
      stats: data.stats,
      signals: data.signals,
      rule: data.rule,
      adherence: data.adherence ?? [],
      goals: measured,
    });
    if (brief.status === "learning") return [];
    return briefToBlocks(brief, copyLang);
  }, [data, measured, copyLang]);

  // ── Daily Review (Step 6C) ─────────────────────────────────────────────
  // Bilan de la dernière journée TRADÉE, affiché seulement quand elle est
  // terminée (pas un résumé à chaud d'une journée encore en cours).
  const reviewBlocks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const latest = data.trades.reduce(
      (a, t) => (t.date > a ? t.date : a),
      data.trades[0]?.date ?? "",
    );
    if (!latest || latest >= today) return [];
    const review = buildDailyReview({
      trades: data.trades,
      stats: data.stats,
      signals: data.signals,
      adherence: data.adherence ?? [],
    });
    if (review.status === "empty") return [];
    return reviewToBlocks(review, copyLang);
  }, [data, copyLang]);

  // ── Weekly Evolution (Step 7) ───────────────────────────────────────────
  // Edge Score via le hook PARTAGÉ avec le Dashboard — jamais recalculé ici.
  const edge = useEdgeScore(context.trades, user?.id ?? context.userId);
  const [missed, setMissed] = useState<MissedOpportunity[]>([]);
  const [weeklyIntents, setWeeklyIntents] = useState<Record<string, TradeIntent>>({});
  const [weeklyReflections, setWeeklyReflections] = useState<Record<string, TradeReflection>>({});
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    let active = true;
    const ids = context.trades.slice(-25).map((t) => t.id);
    void Promise.all([
      loadMissedOpportunities(uid).catch(() => [] as MissedOpportunity[]),
      loadTradeIntents(uid, ids),
      loadTradeReflections(uid, ids),
    ]).then(([m, i, r]) => {
      if (!active) return;
      setMissed(m);
      setWeeklyIntents(i);
      setWeeklyReflections(r);
    });
    return () => {
      active = false;
    };
  }, [user?.id, context.trades]);

  const weeklyBlocks = useMemo(() => {
    const ev = buildWeeklyEvolution({
      trades: data.trades,
      stats: data.stats,
      signals: data.signals,
      adherence: data.adherence ?? [],
      // Edge déjà calculé par `useEdgeScore` (EdgeResult) — aucune réassemblage,
      // aucune seconde définition du score.
      edge,
      goals: measured,
      intents: weeklyIntents,
      reflections: weeklyReflections,
      missed,
    });
    if (ev.status === "empty") return null;
    return weeklyToBlocks(ev, copyLang);
  }, [data, edge, measured, weeklyIntents, weeklyReflections, missed, copyLang]);

  // ── Jarvis propose une ACTION intégrée à l'app ──
  // La fuite la plus coûteuse → proposition d'ajouter une règle « custom » à la
  // checklist du trader. C'est le premier ToolBlock réel : Jarvis agit, l'user
  // valide, la règle devient partie prenante de sa discipline.
  const worstMistake = useMemo(() => {
    return Object.entries(data.stats.mistakeStats)
      .map(([name, v]) => ({ name, ...v }))
      .filter((m) => m.totalPnl < 0)
      .sort((a, b) => a.totalPnl - b.totalPnl)[0];
  }, [data.stats.mistakeStats]);
  const [ruleAdded, setRuleAdded] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const { toast } = useToast();

  const addMistakeRule = async () => {
    if (!user?.id || !worstMistake || ruleAdded || ruleSaving) return;
    setRuleSaving(true);
    try {
      const ruleText = lang === "fr" ? `Pas de ${worstMistake.name}` : `No ${worstMistake.name}`;
      const rules = await loadTradingRules(user.id);
      if (!rules.some((r) => r.text.toLowerCase() === ruleText.toLowerCase())) {
        await saveTradingRules(user.id, [
          ...rules,
          {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `rule-${Date.now()}`,
            kind: "custom",
            value: "",
            text: ruleText,
            enabled: true,
          },
        ]);
      }
      setRuleAdded(true);
      toast(t("jarvisHome.ruleAdded"), "success");
    } catch (e) {
      console.error("[jarvis] add rule failed", e);
      toast(t("ai.genericError"), "error");
    } finally {
      setRuleSaving(false);
    }
  };

  // Le canal `tv:ask-coach` ouvre la Conversation avec la question — découplé.
  const askSuggestion = (prompt: string) =>
    window.dispatchEvent(new CustomEvent("tv:ask-coach", { detail: { prompt } }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-5 md:py-7 max-w-[1100px] mx-auto w-full">
      {/* En-tête — le premier écran d'un assistant personnel, pas une page de stats. */}
      <div className="relative mb-6">
        <div className="relative flex items-center gap-4">
          {/* Avatar Jarvis — la voix clonée, la même identité partout */}
          <div className="relative shrink-0">
            <span className="absolute -inset-1.5 rounded-2xl bg-cyan-500/40 blur-md" />
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl tv-accent-fill">
              <Bot className="w-7 h-7" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="tv-label flex items-center gap-2 text-cyan-400/80 mb-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {t("assistant.title")}
            </div>
            <h2 className="flex items-center gap-2.5 text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
              {t("jarvisHome.greeting")} {firstName}.
            </h2>
            <p className="text-slate-400 mt-1">{t("jarvisHome.ask")}</p>
          </div>
        </div>
        {speaking && (
          <div className="tv-label relative mt-3 inline-flex items-center gap-1.5 text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
            <Volume2 className="w-3 h-3" /> {t("jarvisHome.speaking")}
          </div>
        )}
        {welcomeLine && (
          <p className="relative mt-3 text-[12.5px] text-slate-400 leading-relaxed max-w-xl border-l-2 border-cyan-500/30 pl-3">
            {welcomeLine}
          </p>
        )}
      </div>

      {/* Les propositions passent AVANT les insights : elles attendent une
          décision, le reste s'observe. Le panneau ne rend rien tant qu'il n'y a
          rien en attente, donc l'accueil garde exactement sa forme actuelle
          pour un trader sans proposition. */}
      {(user?.id ?? context.userId) && (
        <ProposalsPanel userId={(user?.id ?? context.userId) as string} />
      )}

      {blocks === null ? (
        <div className="space-y-3">
          <div className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="h-32 rounded-2xl bg-white/[0.03] animate-pulse" />
          <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
        </div>
      ) : (
        <BlockList blocks={blocks} />
      )}

      {/* ── Weekly Evolution (Step 7) : score global puis forces/faiblesses/
          fuites/intention→exécution/objectifs/missions. Placé juste après le
          Hero : c'est le « comment s'est passée ma semaine » le plus attendu. */}
      {weeklyBlocks && (
        <div className="mt-7">
          <header className="card-header mb-3">
            <div className="card-header-left">
              <span className="card-header-icon text-cyan-300">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h3 className="card-header-title text-sm">{t("jarvisWeekly.title")}</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tv:navigate", { detail: { page: "reports" } }),
                )
              }
              className="card-header-action hidden sm:inline"
            >
              {t("common.viewAll")} →
            </button>
          </header>
          <BlockList blocks={weeklyBlocks} />
        </div>
      )}

      {/* ── Daily Brief : objectif, discipline, historique, contexte temporel ──
          Chaque section porte sa preuve et son deep-link ; l'« attention
          particulière » reste le Hero ci-dessus (le claim prioritaire). */}
      {briefBlocks.length > 0 && (
        <div className="mt-7">
          <header className="card-header mb-3">
            <div className="card-header-left">
              <span className="card-header-icon text-cyan-300">
                <ClipboardList className="w-4 h-4" />
              </span>
              <h3 className="card-header-title text-sm">{t("jarvisBrief.title")}</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tv:navigate", { detail: { page: "checklist" } }),
                )
              }
              className="card-header-action hidden sm:inline"
            >
              {t("nav.checklist")} →
            </button>
          </header>
          <BlockList blocks={briefBlocks} />
        </div>
      )}

      {reviewBlocks.length > 0 && (
        <div className="mt-7">
          <header className="card-header mb-3">
            <div className="card-header-left">
              <span className="card-header-icon text-cyan-300">
                <ClipboardCheck className="w-4 h-4" />
              </span>
              <h3 className="card-header-title text-sm">{t("jarvisReview.title")}</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tv:navigate", { detail: { page: "journal" } }),
                )
              }
              className="card-header-action hidden sm:inline"
            >
              {t("trade.notes")} →
            </button>
          </header>
          <BlockList blocks={reviewBlocks} />
        </div>
      )}

      {/* ── ToolBlock : Jarvis propose une action, l'user l'intègre ──
          Ex. « La fuite qui te coûte le plus = overtrading → ajouter une règle
          à ta checklist. » Un clic → la règle entre dans sa discipline. */}
      {worstMistake && !ruleAdded && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/[0.08] to-teal-500/[0.04] p-4">
          <div className="flex items-start gap-3">
            <span className="relative shrink-0">
              <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
              <span className="relative grid h-10 w-10 place-items-center rounded-xl tv-accent-fill">
                <Sparkles className="w-4.5 h-4.5" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="tv-label text-cyan-400/80 mb-1">{t("jarvisHome.proposal")}</div>
              <p className="text-[13px] text-slate-300 leading-relaxed">
                {lang === "fr" ? (
                  <>
                    Jarvis a repéré que{" "}
                    <b className="text-white">{worstMistake.name.toLowerCase()}</b> te coûte le
                    plus. Ajouter une règle pour t'en protéger ?
                  </>
                ) : (
                  <>
                    Jarvis found <b className="text-white">{worstMistake.name.toLowerCase()}</b>{" "}
                    costs you the most. Add a rule to protect yourself?
                  </>
                )}
              </p>
              <button
                onClick={addMistakeRule}
                disabled={ruleSaving}
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white",
                  "tv-accent-fill",
                  "transition disabled:opacity-60",
                )}
              >
                {ruleSaving ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {t("jarvisHome.addRule")}
              </button>
            </div>
          </div>
        </div>
      )}
      {ruleAdded && (
        <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
            <Check className="w-4 h-4 text-emerald-400" />
          </span>
          <p className="text-[13px] text-emerald-300">{t("jarvisHome.ruleAdded")}</p>
        </div>
      )}

      {/* Suggestions — écrites depuis la situation + la page, jamais génériques. */}
      {suggestions.length > 0 && (
        <div className="mt-7">
          <div className="flex items-center gap-2 mb-3">
            <span className="tv-label text-slate-500">{t("jarvisHome.suggestions")}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => askSuggestion(s.prompt)}
                className={cn(
                  "group px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08]",
                  "text-xs text-slate-300 hover:bg-white/[0.07] hover:border-cyan-500/30 hover:text-white",
                  "transition text-left",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bienvenue vocale en anglais — « Welcome, {Prénom} » + UNE phrase courte qui
 * varie selon le contexte réel (nombre de trades, win rate, la plus grosse
 * fuite, zéro activité). Jamais de copie générique : chaque mot est calculé.
 */
function buildWelcomePhrase(data: JarvisHomeData, firstName: string): string {
  const n = data.trades.length;
  const s = data.stats;
  const open = `Welcome, ${firstName}.`;

  if (n === 0) {
    return `${open} You have no trades yet — I am ready when you are.`;
  }

  const wr = Math.round((s.winRate ?? 0) * 100);
  const withWinRate =
    n >= 5 && wr > 0 && `${open} You have logged ${n} trades with a ${wr} percent win rate.`;

  if (withWinRate) return withWinRate;

  if (s.totalPnl < 0) {
    return `${open} Your recent trades are net negative — let us find the leak.`;
  }
  if (s.totalPnl > 0) {
    return `${open} Your recent trades are profitable — let us protect the edge.`;
  }
  return `${open} I have ${n} trade${n > 1 ? "s" : ""} to work with today.`;
}
