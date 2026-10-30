import { supabase } from "@/integrations/supabase/client";
import type { ExperimentProtocol, ExperimentResult } from "@/modules/research";

/**
 * EXPÉRIENCES DE PROGRESSION — accès client (lot 4).
 *
 * Le protocole est figé par la base (`progress_experiment_frozen`) ; modifier
 * une expérience en crée une NOUVELLE version (`supersedes`). Le résultat
 * final s'écrit une fois, à la clôture ou à l'abandon. Table absente : la
 * lecture rend « indisponible », rien n'est simulé.
 */

/* Les types générés ne connaissent pas encore cette table (migration lot 4). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface StoredExperiment {
  id: string;
  accountId: string | null;
  protocol: ExperimentProtocol;
  supersedes: string | null;
  status: "active" | "completed" | "abandoned";
  createdAt: string;
}

function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    !!e && (e.code === "PGRST205" || e.code === "42P01" || /does not exist/i.test(e.message ?? ""))
  );
}

export async function loadExperiments(
  userId: string,
): Promise<{ experiments: StoredExperiment[]; available: boolean }> {
  const { data, error } = await db
    .from("progress_experiments")
    .select(
      "id, account_id, rule, max_losses, target_sessions, start_day, version, seed, supersedes, status, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (isMissingTable(error)) return { experiments: [], available: false };
  if (error) throw error;
  return {
    available: true,
    experiments: ((data ?? []) as Record<string, unknown>[])
      .filter((r) => r.rule === "stop_after_losses")
      .map((r) => ({
        id: String(r.id),
        accountId: (r.account_id as string | null) ?? null,
        supersedes: (r.supersedes as string | null) ?? null,
        status: r.status as StoredExperiment["status"],
        createdAt: String(r.created_at),
        protocol: {
          rule: "stop_after_losses",
          maxLosses: Number(r.max_losses),
          targetSessions: Number(r.target_sessions),
          startDay: String(r.start_day),
          version: Number(r.version),
          seed: Number(r.seed),
        },
      })),
  };
}

export async function startExperiment(
  userId: string,
  accountId: string | null,
  protocol: ExperimentProtocol,
  supersedes: string | null = null,
): Promise<void> {
  const { error } = await db.from("progress_experiments").insert({
    user_id: userId,
    account_id: accountId,
    rule: protocol.rule,
    max_losses: protocol.maxLosses,
    target_sessions: protocol.targetSessions,
    start_day: protocol.startDay,
    version: protocol.version,
    seed: protocol.seed,
    supersedes,
    status: "active",
  });
  if (error) throw error;
}

/** Clôt l'expérience (terminée ou abandonnée) avec son résultat — une fois. */
export async function closeExperiment(
  userId: string,
  id: string,
  status: "completed" | "abandoned",
  result: ExperimentResult,
): Promise<void> {
  const { error } = await db
    .from("progress_experiments")
    .update({ status, final_result: result, ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
}
