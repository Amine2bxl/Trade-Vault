import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/backend/require-admin";
import { summarizeRuns, type AgentRunRow, type TelemetrySummary } from "./telemetry-summary";

/**
 * Lecture de la télémétrie IA pour l'écran de diagnostic `/dev/ai`.
 *
 * PÉRIMÈTRE : les appels du compte ADMINISTRATEUR connecté, et eux seuls.
 *
 * Deux gardes, pas une. La première est la garde d'accès : `requireAdminAccess`
 * — la version précédente se contentait de `requireSupabaseAuth` parce qu'il
 * n'existait alors aucun rôle administrateur, et `/dev/ai` n'était protégée que
 * par l'absence de lien vers elle. Ce n'est plus le cas.
 *
 * La seconde est le PÉRIMÈTRE DES DONNÉES, et elle reste inchangée : même pour
 * un administrateur, la requête est filtrée sur `userId`. Élargir aux agrégats
 * globaux ferait de cette page une vue sur l'activité IA de tout le monde, ce
 * qui n'est pas ce qu'on veut d'un écran de diagnostic technique.
 *
 * Conséquence assumée : les chiffres reflètent l'usage du compte connecté. Pour
 * calibrer un modèle ou un budget de tokens, tester depuis un compte dédié.
 */

/** Fenêtre par défaut. 7 jours : assez pour une tendance, assez court pour que
 *  la requête reste bornée sans pagination. */
const DEFAULT_DAYS = 7;
/** Plafond dur de lignes lues — protège la page d'un compte très actif. */
const MAX_ROWS = 1000;

export interface TelemetryStats extends TelemetrySummary {
  days: number;
  /** `false` quand la table n'existe pas encore (migration non appliquée). */
  available: boolean;
}

export const aiTelemetryStats = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<TelemetryStats> => {
    const { supabase, userId } = context as {
      supabase: {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              gte: (
                c: string,
                v: string,
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          };
        };
      };
      userId: string;
    };

    const since = new Date(Date.now() - DEFAULT_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("ai_agent_runs")
      .select("model, provider, status, input_tokens, output_tokens, latency_ms, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    // Table absente (migration pas encore appliquée) : on le DIT au lieu
    // d'afficher des zéros, qui laisseraient croire à une absence d'activité.
    if (error) {
      return {
        ...summarizeRuns([]),
        days: DEFAULT_DAYS,
        available: false,
      };
    }

    return {
      ...summarizeRuns((data ?? []) as AgentRunRow[]),
      days: DEFAULT_DAYS,
      available: true,
    };
  });
