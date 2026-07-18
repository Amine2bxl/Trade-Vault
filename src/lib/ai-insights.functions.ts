import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProAccess } from "@/lib/require-pro";
import { resolveProvider, type AIMessage } from "@/modules/core/ai-provider";
import { contextBlocks, languageName } from "@/modules/ai/context";

/**
 * Legacy endpoint kept for the AI assistant UI — now a thin wrapper over
 * the AI Provider layer (modules/core/ai-provider). Prefer the richer
 * AI Core services in src/lib/ai.functions.ts for new features.
 */

const TradeSummary = z.object({
  date: z.string().max(10),
  symbol: z.string().max(20),
  direction: z.string().max(10),
  pnl: z.number(),
  rMultiple: z.number(),
  strategy: z.string().max(50),
  mistakes: z.array(z.string().max(100)).max(20),
  setupQuality: z.number(),
  confluences: z.array(z.string().max(100)).max(30),
  notes: z.string().max(10000).optional(),
});

const InsightInput = z.object({
  question: z.string().min(1).max(500),
  trades: z.array(TradeSummary).max(500),
  language: z.string().min(2).max(8).optional(),
});

export const askTradingInsight = createServerFn({ method: "POST" })
  // Pro-gated + rate-limited: without this the endpoint spends AI quota for
  // any authenticated user, including expired trials. `requireProAccess`
  // chains the auth middleware, so the Bearer token (attached globally via
  // src/integrations/supabase/auth-attacher.ts) is still required first.
  .middleware([requireProAccess])
  .inputValidator((input: unknown) => InsightInput.parse(input))
  .handler(async ({ data }) => {
    const targetLanguage = languageName(data.language);

    const systemPrompt = `You are an elite quantitative trading performance coach with 20+ years of experience mentoring prop traders. You analyze a trader's actual journal data and deliver sharp, candid, evidence-based feedback. Every claim you make MUST cite specific numbers from the data (win rate, avg R, $ amounts, symbol, day of week, mistake tag). Never generalize. Never invent numbers. If the data is thin, say so and ask for what to log.

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

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${contextBlocks({ trades: data.trades })}\n\nQuestion: ${data.question}`,
      },
    ];

    const res = await resolveProvider().complete({ messages, maxTokens: 4096 });
    return { answer: res.text };
  });
