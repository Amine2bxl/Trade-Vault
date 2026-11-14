/**
 * LA CHAÎNE DE FOURNISSEURS — l'utilisateur ne voit jamais une panne.
 *
 * Yahoo, puis Stooq, puis FRED. La première série VALIDE est retenue ; la
 * suivante qui répond sert de témoin : si elles concordent, la série est
 * « vérifiée ». Un fournisseur qui échoue (réseau, format, série invalide)
 * passe la main au suivant. Si aucun ne répond, rien n'est écrit : la base
 * garde la dernière série connue, et la page continue de la servir.
 *
 * Les appels réseau sont injectés (`fetchers`) : la logique se teste sans
 * réseau, et le serveur branche les vrais.
 */
import type { TrackedAsset } from "./assets";
import type { MarketSource, MonthlyClose } from "./types";
import { contiguousTail, seriesAgree, validateSeries } from "./validate";

export type Fetcher = (code: string) => Promise<MonthlyClose[]>;
export type Fetchers = Record<MarketSource, Fetcher>;

export const SOURCE_ORDER: readonly MarketSource[] = ["yahoo", "stooq", "fred"];

export interface AssetHistory {
  symbol: string;
  series: MonthlyClose[];
  source: MarketSource;
  /** Concordance avec une seconde source. */
  verified: boolean;
  witness: MarketSource | null;
  /** Ce qui a échoué en route, pour le journal de synchro. */
  failures: string[];
}

export async function fetchAssetHistory(
  asset: TrackedAsset,
  fetchers: Fetchers,
): Promise<AssetHistory | null> {
  const failures: string[] = [];
  let primary: { source: MarketSource; series: MonthlyClose[] } | null = null;
  for (const source of SOURCE_ORDER) {
    const code = asset[source];
    if (!code) continue;
    let series: MonthlyClose[];
    try {
      series = contiguousTail(await fetchers[source](code));
    } catch (e) {
      failures.push(`${source}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const invalid = validateSeries(series, asset.category);
    if (invalid) {
      failures.push(`${source}: ${invalid}`);
      continue;
    }
    if (!primary) {
      primary = { source, series };
      continue;
    }
    // Un témoin valide : la vérification est faite, on s'arrête là.
    const agree = seriesAgree(primary.series, series);
    if (!agree) failures.push(`${source}: disagrees with ${primary.source}`);
    return {
      symbol: asset.symbol,
      series: primary.series,
      source: primary.source,
      verified: agree,
      witness: agree ? source : null,
      failures,
    };
  }
  if (!primary) return null;
  return {
    symbol: asset.symbol,
    series: primary.series,
    source: primary.source,
    verified: false,
    witness: null,
    failures,
  };
}
