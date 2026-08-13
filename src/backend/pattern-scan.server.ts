import { serviceClient } from "./billing.server";
import { json } from "../shared/response";
import { scan } from "@/modules/patterns/scan";
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
 * ── CE QU'IL N'ÉCRIT PAS ───────────────────────────────────────────────────
 * Il écrit des MOTIFS, pas des propositions. Une proposition porte une phrase,
 * et la phrase n'existe pas encore à ce stade. Rien ici n'appelle un modèle.
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
  const report: ScanReport = { users: userIds.length, written: 0, suppressed: 0, failed: 0 };

  for (const userId of userIds) {
    try {
      const result = await scanUser(sb, userId, since);
      report.written += result.written;
      report.suppressed += result.suppressed;
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
): Promise<{ written: number; suppressed: number }> {
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
    } else {
      const { error: insErr } = await sb.from("detected_patterns").insert({
        user_id: userId,
        kind: write.kind,
        cluster_id: write.cluster_id,
        evidence: write.evidence,
        impact_r: write.impact_r,
        first_seen: now,
        last_seen: now,
      });
      if (insErr) throw insErr;
    }
    written += 1;
  }

  return { written, suppressed: output.suppressed };
}
