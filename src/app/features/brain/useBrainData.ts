import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useLiveTable } from "@/app/hooks/useLiveTable";
import { loadMissedOpportunities } from "@/app/store/missed";
import { loadResearchNotes } from "@/app/store/research";
import { loadExperiments } from "@/app/store/experiments";
import { loadMonthlyReports } from "@/app/store/reports";
import { loadScenarios } from "@/app/store/simulations";
import { loadPendingProposals } from "@/app/features/jarvis/proposals";
import {
  CONVERSATIONS_EVENT,
  peekConversations,
  peekMessages,
} from "@/app/features/jarvis/conversations";
import { useEconomicHistory } from "@/app/features/news/useTradeNews";
import { loadTradeIntents, loadTradeReflections } from "@/app/store/tradeIntel";
import { nsKey, readJSON } from "@/app/utils/persistence";
import type { Trade } from "@/app/types";
import type {
  BehaviorContext,
  ConversationInput,
  ExperimentInput,
  MissedInput,
  ProposalInput,
  ReportInput,
  ResearchInput,
  SimulationInput,
} from "@/modules/knowledge";
import type { NewsEvent } from "@/domain/tradeNews";

/**
 * Les sources du Neural Brain — LECTURE SEULE, depuis les stores existants.
 *
 * Aucune table nouvelle, aucune copie : chaque source est lue là où elle vit
 * déjà (Supabase sous RLS, ou l'appareil pour les conversations et le plan du
 * labo Monte Carlo). Une source qui échoue n'empêche pas les autres ; elle est
 * comptée et dite (`failed`), jamais remplacée par une donnée inventée.
 */

export type SourceId =
  | "missed"
  | "research"
  | "experiments"
  | "reports"
  | "proposals"
  | "simulations"
  | "conversations"
  | "events"
  | "behavior";

export interface BrainData {
  missed: MissedInput[];
  research: ResearchInput[];
  experiments: ExperimentInput[];
  reports: ReportInput[];
  proposals: ProposalInput[];
  simulations: SimulationInput[];
  conversations: ConversationInput[];
  events: NewsEvent[];
  /** Plan respecté (bilans) et risque prévu (intentions), par trade. */
  behavior: BehaviorContext;
  loading: boolean;
  failed: SourceId[];
}

interface LabPlan {
  name?: string;
  config?: { risk?: number; seed?: number };
  metrics?: { winRate?: number; avgWinR?: number; avgLossR?: number };
}

const EMPTY = {
  missed: [] as MissedInput[],
  research: [] as ResearchInput[],
  experiments: [] as ExperimentInput[],
  reports: [] as ReportInput[],
  proposals: [] as ProposalInput[],
  scenarios: [] as SimulationInput[],
};

/** Le texte des seuls messages du trader : ce qu'il a demandé. */
function userTextOf(userId: string, id: string): string {
  return peekMessages(userId, id)
    .filter((m) => m.role === "user")
    .flatMap((m) => m.blocks.map((b) => (b.type === "markdown" ? b.content : "")))
    .join("\n")
    .slice(0, 8000);
}

export function useBrainData(trades: readonly Trade[]): BrainData {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const uid = user?.id;
  const [remote, setRemote] = useState(EMPTY);
  const [failed, setFailed] = useState<SourceId[]>([]);
  const [loading, setLoading] = useState(true);
  const [convTick, setConvTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const failures: SourceId[] = [];
    const settle = async <V>(id: SourceId, p: Promise<V>, fallback: V): Promise<V> => {
      try {
        return await p;
      } catch {
        failures.push(id);
        return fallback;
      }
    };
    const sameAccount = (a: string | null) => !activeId || a === activeId;
    const [missed, research, experiments, reports, proposals, scenarios] = await Promise.all([
      settle("missed", loadMissedOpportunities(uid), []),
      settle("research", loadResearchNotes(uid), { notes: [], available: false }),
      settle("experiments", loadExperiments(uid), { experiments: [], available: false }),
      settle("reports", loadMonthlyReports(uid), []),
      settle("proposals", loadPendingProposals(uid), []),
      settle("simulations", loadScenarios(activeId ?? null), []),
    ]);
    setRemote({
      missed,
      research: research.notes
        .filter((n) => sameAccount(n.accountId))
        .map((n) => ({
          id: n.id,
          createdAt: n.createdAt,
          archived: n.archived,
          hypothesis: n.protocol.hypothesis,
          dimension: n.protocol.dimension,
          cellKey: n.protocol.cellKey,
          verdict: n.lastResult?.verdict ?? null,
        })),
      experiments: experiments.experiments
        .filter((x) => sameAccount(x.accountId))
        .map((x) => ({
          id: x.id,
          createdAt: x.createdAt,
          status: x.status,
          maxLosses: x.protocol.maxLosses,
          targetSessions: x.protocol.targetSessions,
          startDay: x.protocol.startDay,
        })),
      reports: reports.map((r) => ({ id: r.id, month: r.month, createdAt: r.createdAt })),
      proposals: proposals.map((p) => ({
        id: p.id,
        patternId: p.patternId,
        actionType: p.actionType,
        text: p.text,
        createdAt: p.createdAt,
        n: p.evidence?.n ?? null,
      })),
      scenarios: scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        updatedAt: s.updatedAt,
        // Un scénario enregistré règle un multiplicateur de risque, pas un
        // montant : il n'a pas d'hypothèse de risque en monnaie à comparer.
        riskPerTrade: null,
        winRate: null,
        avgWinR: null,
        avgLossR: null,
        seed: s.seed,
        origin: "scenario" as const,
      })),
    });
    setFailed(failures);
    setLoading(false);
  }, [uid, activeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useLiveTable("missed_opportunities", () => void refresh());
  useLiveTable("monthly_reports", () => void refresh());
  useLiveTable("agent_proposals", () => void refresh());

  useEffect(() => {
    const on = () => setConvTick((n) => n + 1);
    window.addEventListener(CONVERSATIONS_EVENT, on);
    return () => window.removeEventListener(CONVERSATIONS_EVENT, on);
  }, []);

  // Conversations et plan du labo : sur l'appareil, lus sans réseau.
  const conversations = useMemo<ConversationInput[]>(() => {
    void convTick;
    if (!uid) return [];
    return peekConversations(uid)
      .map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        userText: userTextOf(uid, c.id),
      }))
      .filter((c) => c.userText.trim());
  }, [uid, convTick]);

  const labPlan = useMemo<SimulationInput | null>(() => {
    if (!uid) return null;
    const key = nsKey(uid, `mc-plan-v1.${activeId ?? "main"}`);
    const plan = readJSON<LabPlan | null>(key, null);
    if (!plan?.config) return null;
    return {
      id: `lab:${activeId ?? "main"}`,
      name: plan.name || "Monte Carlo",
      // Le plan local ne date pas son enregistrement : aucune date n'est inventée.
      updatedAt: "",
      riskPerTrade: Number.isFinite(plan.config.risk) ? Number(plan.config.risk) : null,
      winRate: plan.metrics?.winRate ?? null,
      avgWinR: plan.metrics?.avgWinR ?? null,
      avgLossR: plan.metrics?.avgLossR ?? null,
      seed: Number.isFinite(plan.config.seed) ? Number(plan.config.seed) : null,
      origin: "lab_plan",
    };
  }, [uid, activeId]);

  // Bilans et intentions : par paquets (une URL `in.(…)` a une longueur bornée).
  const [behavior, setBehavior] = useState<BehaviorContext>({});
  const [behaviorFailed, setBehaviorFailed] = useState(false);
  const idsKey = useMemo(() => trades.map((t) => t.id).join(","), [trades]);
  useEffect(() => {
    if (!uid || !idsKey) return;
    let active = true;
    const ids = idsKey.split(",");
    const CHUNK = 150;
    const chunks = Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) =>
      ids.slice(i * CHUNK, (i + 1) * CHUNK),
    );
    Promise.all(
      chunks.map((c) => Promise.all([loadTradeReflections(uid, c), loadTradeIntents(uid, c)])),
    )
      .then((parts) => {
        if (!active) return;
        const planRespected: Record<string, "yes" | "partial" | "no" | null> = {};
        const plannedRisk: Record<string, number | null> = {};
        for (const [refl, intents] of parts) {
          for (const [id, r] of Object.entries(refl)) planRespected[id] = r.planRespected;
          for (const [id, i] of Object.entries(intents)) plannedRisk[id] = i.plannedRisk;
        }
        setBehavior({ planRespected, plannedRisk });
        setBehaviorFailed(false);
      })
      .catch(() => active && setBehaviorFailed(true));
    return () => {
      active = false;
    };
  }, [uid, idsKey]);

  const dates = useMemo(() => [...new Set(trades.map((t) => t.date))], [trades]);
  const history = useEconomicHistory(dates);

  return {
    missed: remote.missed,
    research: remote.research,
    experiments: remote.experiments,
    reports: remote.reports,
    proposals: remote.proposals,
    simulations: labPlan ? [labPlan, ...remote.scenarios] : remote.scenarios,
    conversations,
    events: history.events,
    behavior,
    loading,
    failed: [
      ...failed,
      ...(history.failed ? ["events" as const] : []),
      ...(behaviorFailed ? ["behavior" as const] : []),
    ],
  };
}
