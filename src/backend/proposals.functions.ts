import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateProposal } from "@/modules/patterns/proposalSchemas";

/**
 * L'acceptation d'une proposition — LA seule voie d'écriture de Jarvis.
 *
 * Jarvis ne modifie jamais les données du trader. Il dépose une ligne en
 * attente ; c'est CE fichier, côté serveur, après un accord explicite, qui
 * crée l'objet réel. La différence n'est pas théorique : elle sépare un
 * assistant d'un processus qui réorganise le travail de quelqu'un sans son
 * accord.
 *
 * TROIS REFUS, DANS CET ORDRE :
 *
 * 1. La proposition doit être `pending` et non périmée. Accepter une
 *    proposition de trois semaines appliquerait un conseil tiré de données que
 *    le trader a déjà dépassées.
 * 2. Le payload est REVALIDÉ ici, même s'il l'a été à l'insertion. Le schéma
 *    peut s'être resserré entre-temps, et une ligne écrite hier n'a aucune
 *    autorité sur ce qu'on crée aujourd'hui.
 * 3. La justification repasse par le filtre de causalité. Elle est affichée à
 *    l'utilisateur au moment de la décision : c'est la dernière occasion de ne
 *    pas lui promettre une cause.
 *
 * `applied_ref` est écrit avec l'identifiant de l'objet réellement créé. Sans
 * lui, « Jarvis a créé cette règle » serait un récit ; avec lui, c'est
 * vérifiable.
 */

const Input = z.object({ proposalId: z.string().uuid() });

interface ProposalRow {
  id: string;
  action_type: string;
  payload: unknown;
  rationale: string;
  status: string;
  expires_at: string;
}

/** Résultat volontairement explicite : l'appelant doit pouvoir dire pourquoi. */
export interface AcceptResult {
  ok: boolean;
  appliedRef: string | null;
  reason: string | null;
}

export const acceptProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<AcceptResult> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const userId = context.userId as string;

    const { data: row, error } = await sb
      .from("agent_proposals")
      .select("id, action_type, payload, rationale, status, expires_at")
      .eq("id", data.proposalId)
      .maybeSingle();

    if (error || !row) return { ok: false, appliedRef: null, reason: "proposal not found" };

    const proposal = row as ProposalRow;
    if (proposal.status !== "pending") {
      return { ok: false, appliedRef: null, reason: `already ${proposal.status}` };
    }
    if (new Date(proposal.expires_at).getTime() < Date.now()) {
      await sb
        .from("agent_proposals")
        .update({ status: "expired", decided_at: new Date().toISOString() })
        .eq("id", proposal.id);
      return { ok: false, appliedRef: null, reason: "expired" };
    }

    const check = validateProposal({
      actionType: proposal.action_type,
      payload: proposal.payload,
      rationale: proposal.rationale,
    });
    if (!check.ok) {
      // Refus JOURNALISÉ et rien de créé — l'exigence explicite du spec.
      console.error("[proposals] rejected on accept", {
        id: proposal.id,
        reason: check.reason,
      });
      return { ok: false, appliedRef: null, reason: check.reason };
    }

    // ── RÉSERVATION ATOMIQUE ────────────────────────────────────────────────
    //
    // La lecture de `status` plus haut n'engage à rien : entre elle et
    // l'écriture, une seconde requête peut passer. Un double-clic, ou le même
    // écran ouvert sur deux appareils, créait DEUX règles de trading pour une
    // seule proposition — et le trader se retrouvait avec un doublon qu'il
    // n'avait jamais accepté deux fois.
    //
    // `update … where status = 'pending'` est un test-et-pose : la première
    // requête change la ligne, la seconde ne matche plus rien. `select()` rend
    // les lignes touchées, donc un tableau vide signifie « perdu la course ».
    const { data: claimed, error: claimError } = await sb
      .from("agent_proposals")
      .update({ status: "accepted", decided_at: new Date().toISOString() })
      .eq("id", proposal.id)
      .eq("status", "pending")
      .select("id");

    if (claimError) {
      return { ok: false, appliedRef: null, reason: "could not claim proposal" };
    }
    if (!claimed || claimed.length === 0) {
      // Quelqu'un d'autre l'a prise entre-temps. Ce n'est pas une erreur : la
      // proposition A ÉTÉ appliquée, simplement pas par cet appel.
      return { ok: false, appliedRef: null, reason: "already accepted" };
    }

    const appliedRef = await applyAction(sb, userId, proposal.action_type, check.value);
    if (!appliedRef) {
      // L'action n'a rien créé : on REND la proposition. La laisser `accepted`
      // sans `applied_ref` la rendrait morte — ni appliquée, ni réessayable.
      await sb
        .from("agent_proposals")
        .update({ status: "pending", decided_at: null })
        .eq("id", proposal.id)
        .eq("status", "accepted");
      return { ok: false, appliedRef: null, reason: "action not supported yet" };
    }

    await sb.from("agent_proposals").update({ applied_ref: appliedRef }).eq("id", proposal.id);

    return { ok: true, appliedRef, reason: null };
  });

/**
 * Crée l'objet réel et rend son identifiant.
 *
 * DEUX TYPES D'ACTION SEULEMENT pour l'instant : une règle de trading et un
 * item de checklist. Les quatre autres (`create_goal`, `create_mission`,
 * `add_tag`, `add_note`) sont déclarés dans le schéma mais rendent `null` ici,
 * et le moteur n'en émet pas — plutôt que d'écrire quatre chemins de création
 * non testés pour des propositions que rien ne produit encore.
 */

async function applyAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
  actionType: string,
  payload: unknown,
): Promise<string | null> {
  if (actionType === "create_rule") {
    const { text, metric, threshold } = payload as {
      text: string;
      metric: string;
      threshold?: number;
    };
    const { data } = await sb
      .from("profiles")
      .select("trading_rules")
      .eq("id", userId)
      .maybeSingle();
    const rules = Array.isArray(data?.trading_rules) ? data.trading_rules : [];
    const id = crypto.randomUUID();
    const next = [
      ...rules,
      {
        id,
        kind: metric === "none" ? "custom" : metric,
        value: threshold === undefined ? "" : String(threshold),
        text,
        enabled: true,
      },
    ];
    await sb.from("profiles").update({ trading_rules: next }).eq("id", userId);
    return `trading_rule:${id}`;
  }

  if (actionType === "add_checklist_item") {
    const { text, position } = payload as { text: string; position?: number };
    const { data } = await sb
      .from("profiles")
      .select("checklist_config")
      .eq("id", userId)
      .maybeSingle();
    const config = (data?.checklist_config ?? {}) as { items?: { text: string }[] };
    const items = Array.isArray(config.items) ? [...config.items] : [];
    const id = crypto.randomUUID();
    const item = { id, text, on: true };
    const at = position === undefined ? items.length : Math.min(position, items.length);
    items.splice(at, 0, item);
    await sb
      .from("profiles")
      .update({ checklist_config: { ...config, items } })
      .eq("id", userId);
    return `checklist_item:${id}`;
  }

  return null;
}

/**
 * Passe les propositions échues en `expired`.
 *
 * Une proposition de plus de quatorze jours s'appuie sur des données que le
 * trader a dépassées ; la laisser en attente ferait grossir le compteur du
 * budget d'intervention sans que rien ne soit proposé.
 *
 * Rend le nombre de lignes traitées pour que l'appelant (le tick quotidien
 * existant) puisse le journaliser.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function expireStaleProposals(sb: any): Promise<number> {
  const { data, error } = await sb
    .from("agent_proposals")
    .update({ status: "expired", decided_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) {
    console.error("[proposals] expiry sweep failed", error);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}
