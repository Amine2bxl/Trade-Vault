import { serviceClient } from "./billing.server";
import { json } from "../shared/response";
import { scan } from "@/modules/patterns/scan";
import { deriveAction } from "@/modules/patterns/derive";
import type { DetectedPattern } from "@/modules/patterns/detectors";
import {
  parseWriterOutput,
  writerSystemPrompt,
  writerUserPrompt,
  type WriterLanguage,
} from "@/modules/patterns/writer";
import { resolveProvider } from "@/modules/ai-provider";
import {
  planWrites,
  toSessionLikes,
  toTradeLikes,
  windowStart,
  type KnownPatternRow,
} from "@/modules/patterns/persist";

/**
 * Le passage de détection nocturne — `ECOSYSTEM_WIRING.md` Phase 3.
 *
 * Ce fichier ne contient AUCUNE règle statistique. Les seuils, les planchers
 * d'effet, la règle d'oubli, le tri : tout est dans `src/modules/patterns/`,
 * testé sans base. Ici il n'y a que des entrées/sorties — lire, appeler, écrire.
 * C'est délibéré : un handler qui porte des règles est un handler dans lequel
 * on finit par « ajuster un seuil pour voir ».
 *
 * ── OÙ LE MODÈLE INTERVIENT, ET SEULEMENT LÀ ──────────────────────────────
 * Les motifs sont écrits sans lui. Ensuite, et seulement si `deriveAction` a
 * produit une action, un modèle est appelé pour écrire DEUX CHAÎNES : le
 * libellé de l'objet et sa justification. Il ne choisit ni le motif, ni
 * l'action, ni le seuil — ceux-là sont déjà fixés quand on l'appelle.
 * `parseWriterOutput` refuse sa sortie au moindre écart, et un refus est un
 * silence : aucun gabarit ne vient rattraper une phrase rejetée.
 *
 * ── FENÊTRE ────────────────────────────────────────────────────────────────
 * 90 jours (`WINDOW_DAYS`, dans `persist.ts` avec sa justification).
 */

/** Les colonnes dont les détecteurs ont besoin, et rien de plus. */
const TRADE_COLS = "user_id, trade_date, pnl, r_multiple, mistakes, entry_time";

interface ScanReport {
  users: number;
  written: number;
  suppressed: number;
  /** Propositions réellement insérées — au plus une par utilisateur. */
  proposed: number;
  failed: number;
}

export async function handlePatternScanCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  if (!sb) return json({ error: "supabase service credentials missing" }, 500);

  const since = windowStart(new Date());

  // Les utilisateurs actifs sur la fenêtre. Balayer tout le monde ferait tourner
  // quatre détecteurs sur des comptes vides pour rien.
  const { data: rows, error } = await sb.from("trades").select("user_id").gte("trade_date", since);
  if (error) return json({ error: error.message }, 500);

  const owners = (rows ?? []) as { user_id: string }[];
  const userIds: string[] = [...new Set(owners.map((r) => r.user_id))];
  const report: ScanReport = {
    users: userIds.length,
    written: 0,
    suppressed: 0,
    proposed: 0,
    failed: 0,
  };

  for (const userId of userIds) {
    try {
      const result = await scanUser(sb, userId, since);
      report.written += result.written;
      report.suppressed += result.suppressed;
      if (result.proposed) report.proposed += 1;
    } catch (e) {
      report.failed += 1;
      // Un compte qui échoue ne doit pas emporter le passage des autres.
      console.error("[pattern-scan] failed for", userId, e);
    }
  }

  return json(report, 200);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
  since: string,
): Promise<{ written: number; suppressed: number; proposed: boolean }> {
  const [trades, sessions, known] = await Promise.all([
    sb.from("trades").select(TRADE_COLS).eq("user_id", userId).gte("trade_date", since),
    sb
      .from("trading_sessions")
      .select("session_date, readiness_score")
      .eq("user_id", userId)
      .gte("session_date", since),
    sb.from("detected_patterns").select("id, kind, cluster_id, dismissed_at").eq("user_id", userId),
  ]);

  const knownRows: KnownPatternRow[] = known.data ?? [];
  const output = scan({
    trades: toTradeLikes(trades.data ?? []),
    sessions: toSessionLikes(sessions.data ?? []),
    known: knownRows.map((k) => ({
      kind: k.kind,
      clusterId: k.cluster_id,
      dismissedAt: k.dismissed_at,
    })),
  });

  const now = new Date().toISOString();
  let written = 0;
  /** L'identifiant de ligne de chaque motif publié, dans l'ordre de tri. */
  const patternIds: (string | null)[] = [];

  for (const write of planWrites(output.patterns, knownRows)) {
    if (write.id) {
      // Une ligne par motif : le passage de cette nuit remplace les preuves de
      // la veille. `first_seen` n'est PAS touché — depuis quand le motif tient
      // fait partie de ce qu'on montre.
      const { error: upErr } = await sb
        .from("detected_patterns")
        .update({ evidence: write.evidence, impact_r: write.impact_r, last_seen: now })
        .eq("id", write.id);
      if (upErr) throw upErr;
      patternIds.push(write.id);
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("detected_patterns")
        .insert({
          user_id: userId,
          kind: write.kind,
          cluster_id: write.cluster_id,
          evidence: write.evidence,
          impact_r: write.impact_r,
          first_seen: now,
          last_seen: now,
        })
        .select("id")
        .maybeSingle();
      if (insErr) throw insErr;
      patternIds.push((inserted?.id as string | undefined) ?? null);
    }
    written += 1;
  }

  const proposed = await proposeOne(sb, userId, output.patterns, patternIds);
  return { written, suppressed: output.suppressed, proposed };
}

/**
 * AU PLUS UNE proposition par passage, sur le motif le plus lourd qui en a une.
 *
 * Le budget (3 en attente, 1 par jour) est porté par la base ; ce plafond-ci est
 * l'autre moitié de la même idée : même si la base l'autorisait, proposer trois
 * choses le même soir revient à demander au trader de trancher trois fois. Un
 * refus du trigger n'est donc PAS une erreur — c'est le budget qui fonctionne.
 *
 * Tout échec est silencieux et local : pas de proposition ce soir, les motifs
 * sont écrits quand même. Une panne de fournisseur ne doit pas coûter le scan.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function proposeOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
  patterns: DetectedPattern[],
  patternIds: (string | null)[],
): Promise<boolean> {
  for (let i = 0; i < patterns.length; i += 1) {
    const action = deriveAction(patterns[i]);
    const patternId = patternIds[i];
    if (!action || !patternId) continue;

    const { data: profile } = await sb
      .from("profiles")
      .select("language")
      .eq("id", userId)
      .maybeSingle();
    const language: WriterLanguage = profile?.language === "fr" ? "fr" : "en";

    let raw: string;
    try {
      const provider = resolveProvider();
      const response = await provider.complete({
        messages: [
          { role: "system", content: writerSystemPrompt(language) },
          { role: "user", content: writerUserPrompt(action, language) },
        ],
        json: true,
        temperature: 0.2,
        maxTokens: 300,
      });
      raw = response.text;
    } catch (e) {
      console.error("[pattern-scan] writer call failed", e);
      return false;
    }

    const result = parseWriterOutput(raw, action);
    if (!result.ok) {
      // Refus JOURNALISÉ, rien d'inséré. Une justification refusée est un
      // silence, jamais un texte approximatif rattrapé par un gabarit.
      console.error("[pattern-scan] writer output rejected", { userId, reason: result.reason });
      return false;
    }

    const { error } = await sb.from("agent_proposals").insert({
      user_id: userId,
      pattern_id: patternId,
      action_type: action.actionType,
      payload: result.payload,
      rationale: result.rationale,
    });
    if (error) {
      // Budget atteint ou proposition déjà vivante pour ce motif : attendu.
      console.log("[pattern-scan] proposal not inserted", { userId, reason: error.message });
      return false;
    }
    return true;
  }
  return false;
}
