import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TradeSummary = z.object({
  date: z.string(),
  symbol: z.string(),
  direction: z.string(),
  pnl: z.number(),
  rMultiple: z.number(),
  strategy: z.string(),
  mistakes: z.array(z.string()),
  setupQuality: z.number(),
  confluences: z.array(z.string()),
});

const InsightInput = z.object({
  question: z.string().min(1).max(500),
  trades: z.array(TradeSummary).max(500),
  language: z.string().min(2).max(8).optional(),
});

export const askTradingInsight = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InsightInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const language = data.language || 'en';
    const LANG_NAMES: Record<string, string> = {
      en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German',
      it: 'Italian', nl: 'Dutch', ru: 'Russian', zh: 'Chinese', ja: 'Japanese',
      ar: 'Arabic', hi: 'Hindi',
    };
    const targetLanguage = LANG_NAMES[language] || 'English';

    const tradesContext =
      data.trades.length === 0
        ? "The user has no trades logged yet."
        : `Here are the user's ${data.trades.length} most recent trades (JSON):\n${JSON.stringify(data.trades, null, 1)}`;

    const systemPrompt =
              `You are an elite quantitative trading performance coach with 20+ years of experience mentoring prop traders. You analyze a trader's actual journal data and deliver sharp, candid, evidence-based feedback. Every claim you make MUST cite specific numbers from the data (win rate, avg R, $ amounts, symbol, day of week, mistake tag). Never generalize. Never invent numbers. If the data is thin, say so and ask for what to log.

COMPUTE these before writing:
- Win rate = wins / (wins + losses), excluding break-even
- Avg R (winners), Avg R (losers), Expectancy = winRate*avgWinR - lossRate*|avgLossR|
- Best/worst symbol by total P&L and by expectancy
- Best/worst day of week by expectancy
- Most frequent mistake tags and their $ cost
- Setup quality vs outcome correlation

IMPORTANT: Write the ENTIRE response in ${targetLanguage}. Translate every section header, label, and bullet — keep only the emojis and metric values (numbers, currencies, R, %).

Respond using GitHub-flavored Markdown with this exact structure (omit a section only if truly not applicable):

## 🎯 Key Takeaways
- 3-5 punchy bullets with the most important findings (include real numbers / % / $ / R).

## 📊 Stats Snapshot
A compact markdown table of the most relevant metrics for the question (e.g. Win Rate, Avg R, Expectancy, Best Day, Worst Symbol). Use this format:
| Metric | Value |
| --- | --- |
| Win Rate | 54% |

## ✅ Strengths
- What's working, with evidence.

## ⚠️ Weaknesses
- What's hurting performance, with evidence (cite mistakes, symbols, days).

## 🧭 Action Plan
1. Concrete, prioritized steps. Each step = one specific behavior change + how to measure it.

## 💡 Bottom Line
One bold sentence summarizing the verdict.

Rules: Use **bold** for key numbers. Keep paragraphs short. No fluff. No generic advice. If the trader has no data, say so clearly and suggest what to log first.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `${tradesContext}\n\nQuestion: ${data.question}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402 || res.status === 403) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI request failed: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.content?.[0]?.text ?? "";
    return { answer: content };
  });