import {
  MC_REQUIRED,
  guessMapping,
  mapRowsToTrades,
  parseCsv,
  parseMoney,
} from "@/app/features/journal/csvImport";
import { historicalModel, metricsOf, type StrategyModel } from "@/modules/probability/strategy";

/** Le même parseur que le journal ; un fichier en R n'est jamais transformé
 * en faux trades monétaires. Les valeurs manquantes ne valent jamais zéro. */
export function readStrategyCsv(text: string): StrategyModel {
  const { headers, rows } = parseCsv(text),
    mapping = guessMapping(headers);
  if (mapping.pnl === undefined) {
    if (mapping.rMultiple === undefined) throw new Error("NO_PNL");
    const values = rows
      .map((row) => parseMoney(row[mapping.rMultiple!] ?? ""))
      .filter((r): r is number => r !== null && Number.isFinite(r));
    if (values.length < 5) throw new Error("TOO_FEW");
    return {
      kind: "historical",
      values,
      metrics: metricsOf(values),
      sampleSize: values.length,
      estimated: 0,
      excluded: rows.length - values.length,
    };
  }
  const { valid, invalid } = mapRowsToTrades(rows, mapping, { required: MC_REQUIRED });
  const model = historicalModel(valid);
  model.excluded += invalid;
  if (model.sampleSize < 5) throw new Error("TOO_FEW");
  return model;
}
