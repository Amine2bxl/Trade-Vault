/**
 * LECTURE DE LA SAISONNALITÉ DE MARCHÉ — fonction serveur publique.
 *
 * Lit les clôtures synchronisées par le cron et calcule, pour chaque actif,
 * sa saisonnalité (`domain/marketSeasonality`). Le calcul se fait ici : la
 * page reçoit douze chiffres par actif, pas des milliers de clôtures.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { seasonalityFromCloses, type MarketSeasonality } from "@/domain/marketSeasonality";

export interface MarketAssetSeasonality {
  symbol: string;
  name: string;
  category: "indices" | "forex" | "commodities" | "crypto";
  source: "yahoo" | "stooq" | "fred";
  witness: "yahoo" | "stooq" | "fred" | null;
  verified: boolean;
  seasonality: MarketSeasonality;
}

export interface MarketSeasonalityPayload {
  assets: MarketAssetSeasonality[];
  lastSuccessAt: string | null;
}

const PAGE = 1000;

// Authentifiée : la page n'existe que dans l'app connectée — aucune raison
// d'ouvrir une route de plus au monde.
export const fetchMarketSeasonality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<MarketSeasonalityPayload> => {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { assets: [], lastSuccessAt: null };
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const [meta, sync] = await Promise.all([
      sb
        .from("market_history_assets")
        .select("symbol, name, category, source, witness, verified")
        .order("symbol"),
      sb.from("market_history_sync").select("last_success_at").eq("id", true).maybeSingle(),
    ]);
    if (meta.error || !meta.data?.length) {
      if (meta.error) console.error("[market-history] read failed", meta.error);
      return { assets: [], lastSuccessAt: null };
    }

    const closes = new Map<string, { month: string; close: number }[]>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("market_monthly_closes")
        .select("symbol, month, close")
        .order("symbol")
        .order("month")
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[market-history] closes read failed", error);
        return { assets: [], lastSuccessAt: null };
      }
      for (const r of data ?? []) {
        const list = closes.get(r.symbol) ?? [];
        list.push({ month: String(r.month).slice(0, 7), close: Number(r.close) });
        closes.set(r.symbol, list);
      }
      if (!data || data.length < PAGE) break;
    }

    return {
      assets: meta.data.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        source: a.source,
        witness: a.witness,
        verified: a.verified,
        seasonality: seasonalityFromCloses(closes.get(a.symbol) ?? []),
      })),
      lastSuccessAt: sync.data?.last_success_at ?? null,
    };
  });
