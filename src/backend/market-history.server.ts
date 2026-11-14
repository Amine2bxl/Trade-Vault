/**
 * SYNCHRO DE L'HISTORIQUE DE MARCHÉ — cron quotidien `/api/cron/market-history`.
 *
 * Pour chaque actif suivi : la chaîne de fournisseurs (Yahoo → Stooq → FRED,
 * voir `modules/market-history/chain`) rend une série validée et, quand un
 * témoin concorde, vérifiée. Les clôtures sont fusionnées (upsert) : un actif
 * dont toutes les sources tombent garde sa dernière série — la page ne voit
 * jamais un trou. Rien ne s'écrit côté utilisateur ; la clé de service reste
 * sur le serveur.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  TRACKED_ASSETS,
  fetchAssetHistory,
  parseFredDaily,
  parseStooqMonthly,
  parseYahooMonthly,
  type Fetchers,
} from "@/modules/market-history";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;

const TIMEOUT_MS = 12_000;
const CONCURRENCY = 4;

function serviceClient(): AnyClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; market-history/1.0)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Les vrais appels réseau, branchés sur les parseurs purs. */
export function liveFetchers(now = new Date()): Fetchers {
  return {
    yahoo: async (code) =>
      parseYahooMonthly(
        JSON.parse(
          await getText(
            // `period1`/`period2` et non `range=max` : ce dernier rend le
            // passé en barres TRIMESTRIELLES (des « trous » d'un mois sur deux).
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}?period1=0&period2=${Math.floor(now.getTime() / 1000)}&interval=1mo`,
          ),
        ),
        now,
      ),
    stooq: async (code) =>
      parseStooqMonthly(
        await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(code)}&i=m`),
        now,
      ),
    fred: async (code) =>
      parseFredDaily(
        await getText(
          `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(code)}`,
        ),
        now,
      ),
  };
}

export interface MarketSyncResult {
  ok: boolean;
  assets: number;
  verified: number;
  failed: string[];
}

export async function syncMarketHistory(
  fetchers: Fetchers = liveFetchers(),
): Promise<MarketSyncResult> {
  const sb = serviceClient();
  if (!sb) return { ok: false, assets: 0, verified: 0, failed: ["service credentials missing"] };
  const attemptAt = new Date().toISOString();
  const failed: string[] = [];
  let assets = 0;
  let verified = 0;

  const queue = [...TRACKED_ASSETS];
  const worker = async () => {
    for (let asset = queue.shift(); asset; asset = queue.shift()) {
      const history = await fetchAssetHistory(asset, fetchers).catch(() => null);
      if (!history) {
        failed.push(asset.symbol);
        continue;
      }
      if (history.failures.length)
        console.warn(`[market-history] ${asset.symbol}: ${history.failures.join(" · ")}`);
      const now = new Date().toISOString();
      const rows = history.series.map((s) => ({
        symbol: asset.symbol,
        month: `${s.month}-01`,
        close: s.close,
        source: history.source,
        updated_at: now,
      }));
      const { error } = await sb
        .from("market_monthly_closes")
        .upsert(rows, { onConflict: "symbol,month" });
      if (error) {
        console.error(`[market-history] ${asset.symbol} write failed`, error);
        failed.push(asset.symbol);
        continue;
      }
      const meta = await sb.from("market_history_assets").upsert(
        {
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category,
          source: history.source,
          witness: history.witness,
          verified: history.verified,
          months: history.series.length,
          last_month: `${history.series.at(-1)?.month}-01`,
          updated_at: now,
        },
        { onConflict: "symbol" },
      );
      if (meta.error) console.error(`[market-history] ${asset.symbol} meta failed`, meta.error);
      assets++;
      if (history.verified) verified++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = assets > 0;
  const { data } = await sb
    .from("market_history_sync")
    .select("consecutive_failures")
    .eq("id", true)
    .maybeSingle();
  await sb.from("market_history_sync").upsert(
    {
      id: true,
      last_attempt_at: attemptAt,
      ...(ok ? { last_success_at: attemptAt } : {}),
      last_error: failed.length ? `failed: ${failed.join(", ")}` : null,
      consecutive_failures: ok ? 0 : (data?.consecutive_failures ?? 0) + 1,
    },
    { onConflict: "id" },
  );
  return { ok, assets, verified, failed };
}

/** Point d'entrée cron Vercel (voir src/server.ts). */
export async function handleMarketHistoryCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const result = await syncMarketHistory();
  // 200 même en échec partiel : la dernière série connue reste servie, et le
  // prochain passage reprend là où celui-ci a échoué.
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
