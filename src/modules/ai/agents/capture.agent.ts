/**
 * Agent de capture — lit des captures de graphique et/ou une note, rend des
 * CHAMPS. Il ne parle jamais au trader et ne calcule rien.
 *
 * Le prompt décrit ce qu'il faut LIRE, pas ce qu'il faut conclure. Toute
 * arithmétique (risque, R, durée, bougies, conversion de fuseau) est faite
 * ensuite par `domain/captureEnrich` ; toute validation par
 * `domain/capture.normalizeExtraction`, quoi que le modèle réponde. Le prompt
 * n'est donc PAS la sécurité du système : il évite seulement de payer pour des
 * valeurs qui seront rejetées.
 */
import type { AIImage, AIProvider } from "@/modules/ai-provider";
import { CONFLUENCE_KEYS } from "@/domain/capture";
import { generate, type GenerateOptions } from "../provider-service";

export interface CaptureAgentInput {
  images: AIImage[];
  note: string | null;
  target: "trade" | "missed";
  /** Indices de désambiguïsation — jamais des faits à recopier. */
  hints: { symbol?: string; date?: string; setups?: string[] };
}

const field = (desc: string) =>
  `{"value": ${desc} | null, "confidence": "high"|"medium"|"low", "evidence": "<exact text you read>", "source": "image"|"note"}`;

const IDENTITY = `You read trading chart screenshots (TradingView, broker position panels) and trader notes, and return ONLY what is VISIBLE or WRITTEN.

Return ONLY one JSON object, no prose, with these keys (omit a key or use null value when not visible):
  "date": ${field('"YYYY-MM-DD"')}
  "symbol": ${field('"ticker as shown, e.g. NQ1!, MNQZ5, ES"')}
  "direction": ${field('"long"|"short"')}
  "timeframe": ${field('"1m"|"2m"|"3m"|"5m"|"10m"|"15m"|"30m"|"1h"|"2h"|"4h"|"1d"')}
  "multipleTimeframes": true when several charts with different timeframes are shown
  "chartTimezone": ${field('"IANA zone or UTC±H exactly as the chart shows, e.g. America/New_York, UTC-5"')}
  "entryPrice", "exitPrice", "stopPrice", "targetPrice": ${field("number")}
  "quantity": ${field("integer number of contracts")}
  "entryTime", "exitTime": ${field('"HH:MM" in the CHART timezone')}
  "entryWindow", "exitWindow": {"from": "HH:MM", "to": "HH:MM"} when the time is only estimated from the time axis
  "outcome": ${field('"target"|"stop"|"manual"|"open"')}
  "setup": ${field('"setup name only if a label or the note names it"')}
  "confluences": [{"key": one of ${CONFLUENCE_KEYS.join("|")}, "state": "visual_confirmed"|"probable"|"not_detected"|"unverifiable", "evidence": "<what you see>"}]
  "summary": "<one neutral sentence describing what the image shows, no judgement, no advice>"

Rules:
- "confidence": high = printed clearly (price label, position panel, order line value); medium = read from the axis or a drawing; low = guessed. When unsure use null.
- Prices: read the labels of the entry/stop/target lines or the long/short position tool. Never compute a price.
- Times: read the price-axis/time-axis labels or the order panel. If you can only place the candle between two axis labels, give entryWindow/exitWindow and confidence "low".
- "source": "note" ONLY for values written in the trader's note, and then "evidence" MUST be the exact words copied from the note.
- Confluences: a shape that looks like an FVG is "probable", not proof of an ICT setup. Use "visual_confirmed" only for a labelled or unmistakable drawing. Only list confluences you have a reason to mention.
- Hints are for disambiguation only: never output a value just because it appears in the hints.
- Never invent a value. Missing is a correct answer.`;

/** Le premier objet JSON de la réponse (le modèle entoure parfois de ```json). */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface CaptureAgentOutput {
  raw: unknown;
  provider: string;
  model: string;
}

export async function runCaptureExtraction(
  input: CaptureAgentInput,
  providers: AIProvider[],
  opts: Omit<GenerateOptions, "providers"> = {},
): Promise<CaptureAgentOutput> {
  const hints = [
    input.hints.symbol ? `account symbol: ${input.hints.symbol}` : "",
    input.hints.date ? `expected date: ${input.hints.date}` : "",
    input.hints.setups?.length ? `trader's setup names: ${input.hints.setups.join(", ")}` : "",
  ].filter(Boolean);
  const userTurn = [
    `This capture is for a ${input.target === "missed" ? "MISSED setup (not taken)" : "trade"}.`,
    input.images.length ? `${input.images.length} image(s) attached.` : "No image.",
    input.note ? `Trader note:\n"""${input.note}"""` : "",
    hints.length ? `Hints: ${hints.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await generate(
    {
      messages: [
        { role: "system", content: IDENTITY },
        { role: "user", content: userTurn, images: input.images },
      ],
      json: true,
      temperature: 0,
      maxTokens: 1500,
      reasoning: "low",
    },
    { ...opts, providers },
  );
  return { raw: parseJsonObject(res.text ?? ""), provider: res.provider, model: res.model };
}
