import { supabase } from "@/integrations/supabase/client";
import { acceptProposal } from "@/backend/proposals.functions";

/**
 * Les propositions de Jarvis, côté client — LECTURE et DÉCISION, jamais plus.
 *
 * Ce module ne crée aucune proposition : la politique RLS ne donne au
 * navigateur que `select` et `update`, et c'est exactement ce qu'on utilise
 * ici. L'objet réel n'est créé qu'à l'acceptation, côté serveur, par
 * `acceptProposal` — ce module se contente de l'appeler et de rendre son
 * verdict tel quel.
 *
 * REFUSER EST UNE DÉCISION, PAS UNE ABSENCE. `dismissProposal` écrit
 * `dismissed` et `decided_at` ; c'est ce qui permet à la règle d'oubli
 * (30 jours, `DISMISS_DAYS`) de fonctionner et au bouton « ignorer » de vouloir
 * dire quelque chose.
 */

export interface PendingProposal {
  id: string;
  patternId: string | null;
  actionType: string;
  /** Le libellé de l'objet qui serait créé. */
  text: string;
  /** La justification, filtrée à l'écriture par `checkCausalLanguage`. */
  rationale: string;
  createdAt: string;
  expiresAt: string;
  /** Ce que le motif a mesuré — affiché avec la proposition, jamais séparé. */
  evidence: {
    n: number;
    comparisons: number;
    comparisonN: number | null;
    metric: string;
    value: number;
    baseline: number | null;
  } | null;
  impactR: number | null;
}

interface ProposalRow {
  id: string;
  pattern_id: string | null;
  action_type: string;
  payload: { text?: string } | null;
  rationale: string;
  created_at: string;
  expires_at: string;
  detected_patterns: { evidence: PendingProposal["evidence"]; impact_r: number | null } | null;
}

/**
 * Les propositions en attente, la plus récente d'abord.
 *
 * Le motif est joint dans la même requête : une proposition SANS ses chiffres
 * ne doit pas pouvoir s'afficher, et deux requêtes séparées auraient laissé la
 * porte ouverte à un rendu partiel pendant le chargement.
 */
export async function loadPendingProposals(userId: string): Promise<PendingProposal[]> {
  const { data, error } = await supabase
    .from("agent_proposals")
    .select(
      "id, pattern_id, action_type, payload, rationale, created_at, expires_at, detected_patterns(evidence, impact_r)",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as ProposalRow[]).map((row) => ({
    id: row.id,
    patternId: row.pattern_id,
    actionType: row.action_type,
    text: typeof row.payload?.text === "string" ? row.payload.text : "",
    rationale: row.rationale,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    evidence: row.detected_patterns?.evidence ?? null,
    impactR: row.detected_patterns?.impact_r ?? null,
  }));
}

/** Refus explicite. Rend `false` si l'écriture échoue — l'appelant le dit. */
export async function dismissProposal(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("agent_proposals")
    .update({ status: "dismissed", decided_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export interface AcceptOutcome {
  ok: boolean;
  reason: string | null;
}

/**
 * Accepte — et c'est le SERVEUR qui crée l'objet.
 *
 * Le client n'écrit ni la règle ni l'item de checklist : il demande, le serveur
 * revalide, crée, et écrit `applied_ref`. Un chemin client qui créerait l'objet
 * lui-même contournerait la revalidation et rendrait « Jarvis a créé ceci »
 * invérifiable.
 */
export async function acceptProposalById(id: string): Promise<AcceptOutcome> {
  try {
    const result = await acceptProposal({ data: { proposalId: id } });
    return { ok: result.ok, reason: result.reason };
  } catch (e) {
    console.error("[proposals] accept failed", e);
    return { ok: false, reason: "network" };
  }
}
