import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Trade } from "@/tradevault/types";
import {
  buildMonthlyReport,
  monthRange,
  prevMonthOf,
  type MonthlyReportData,
} from "@/tradevault/utils/monthlyReport";
import { sendWebPush, type PushSubRow } from "./push-crypto.server";

// Monthly report generation core — used by the Vercel cron (service role,
// all active users) and by the on-demand server function (RLS client, self).

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;

interface DbTradeRow {
  id: string;
  trade_date: string;
  symbol: string;
  direction: string;
  pnl: number;
  risk_amount: number;
  r_multiple: number;
  strategy: string;
  mistakes: string[] | null;
  setup_quality: number;
  notes: string | null;
  screenshots: string[] | null;
  entry_time: string | null;
  exit_time: string | null;
  confluences: string[] | null;
  confidence: number;
}

// Server-side copy of the row mapper: store.ts is a client module (it imports
// the browser Supabase client), so it can't be imported here.
function rowToTrade(r: DbTradeRow): Trade {
  const dir = r.direction === "short" ? "short" : r.direction === "be" ? "be" : "long";
  return {
    id: r.id,
    date: r.trade_date,
    symbol: r.symbol,
    direction: dir,
    pnl: Number(r.pnl),
    riskAmount: Number(r.risk_amount),
    rMultiple: Number(r.r_multiple),
    strategy: r.strategy,
    mistakes: r.mistakes ?? [],
    setupQuality: r.setup_quality,
    notes: r.notes ?? "",
    screenshots: r.screenshots ?? [],
    entryTime: r.entry_time ?? "",
    exitTime: r.exit_time ?? "",
    confluences: r.confluences ?? [],
    confidence: r.confidence,
  };
}

async function loadTradesBetween(
  sb: AnyClient,
  userId: string,
  start: string,
  end: string,
): Promise<Trade[]> {
  const { data, error } = await sb
    .from("trades")
    .select(
      "id, trade_date, symbol, direction, pnl, risk_amount, r_multiple, strategy, mistakes, setup_quality, notes, screenshots, entry_time, exit_time, confluences, confidence",
    )
    .eq("user_id", userId)
    .gte("trade_date", start)
    .lte("trade_date", end);
  if (error) throw error;
  return ((data ?? []) as DbTradeRow[]).map(rowToTrade);
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
  hi: "Hindi",
};

/**
 * Étape 5 (option A): a compact Gemini synthesis embedded in the report.
 * Strictly best-effort — any failure returns null and the report ships
 * without a summary rather than failing the whole generation.
 */
async function generateAiSummary(
  report: MonthlyReportData,
  language: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || report.trades === 0) return null;

  const targetLanguage = LANG_NAMES[language] || "English";
  const systemPrompt = `You are a quantitative trading performance coach. You receive one month of aggregated journal metrics (JSON). Write a SHORT monthly debrief in ${targetLanguage} using GitHub-flavored Markdown:
- 3 to 5 bullet points max, each citing real numbers from the data ($, %, R).
- One bullet on the biggest strength, one on the costliest leak (use the mistakes list), one concrete action for next month.
- No headers, no intro, no outro — bullets only. Never invent numbers.`;

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(report) }] }],
          generationConfig: { maxOutputTokens: 1024 },
        }),
      },
    );
    if (!res.ok) {
      console.error("[monthly-report] Gemini failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    const content: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    return content.trim() || null;
  } catch (e) {
    console.error("[monthly-report] Gemini error", e);
    return null;
  }
}

/**
 * Builds and upserts the report for one user + month. Returns null when the
 * user has no trades that month (no empty reports in the history).
 */
export async function generateReportForUser(
  sb: AnyClient,
  userId: string,
  month: string,
  opts: { withAi?: boolean } = {},
): Promise<MonthlyReportData | null> {
  const { start, end } = monthRange(month);
  const prevM = prevMonthOf(month);
  const prevRange = monthRange(prevM);

  const [monthTrades, prevTrades, profileRes] = await Promise.all([
    loadTradesBetween(sb, userId, start, end),
    loadTradesBetween(sb, userId, prevRange.start, prevRange.end),
    sb.from("profiles").select("starting_balance, language").eq("id", userId).maybeSingle(),
  ]);
  if (monthTrades.length === 0) return null;

  const startingBalance = Number(profileRes.data?.starting_balance ?? 0) || 0;
  const language = (profileRes.data?.language as string | undefined) || "en";

  const report = buildMonthlyReport(month, monthTrades, prevTrades, startingBalance);
  if (opts.withAi !== false) {
    report.aiSummary = await generateAiSummary(report, language);
  }

  const { error } = await sb
    .from("monthly_reports")
    .upsert(
      { user_id: userId, month, report, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );
  if (error) throw error;
  return report;
}

// Short push copy in the user's language (falls back to English).
const PUSH_COPY: Record<string, { title: string; body: string }> = {
  en: {
    title: "Your monthly report is ready",
    body: "See your {month} performance, setups and leaks.",
  },
  fr: {
    title: "Ton rapport mensuel est prêt",
    body: "Découvre ta performance, tes setups et tes fuites de {month}.",
  },
  es: {
    title: "Tu informe mensual está listo",
    body: "Mira tu rendimiento, setups y fugas de {month}.",
  },
  pt: {
    title: "O seu relatório mensal está pronto",
    body: "Veja o seu desempenho, setups e fugas de {month}.",
  },
  de: {
    title: "Dein Monatsbericht ist fertig",
    body: "Sieh dir deine Performance, Setups und Lecks für {month} an.",
  },
  it: {
    title: "Il tuo report mensile è pronto",
    body: "Guarda la tua performance, i setup e le perdite di {month}.",
  },
  nl: {
    title: "Je maandrapport is klaar",
    body: "Bekijk je prestaties, setups en lekken van {month}.",
  },
  ru: {
    title: "Ваш месячный отчёт готов",
    body: "Посмотрите результаты, сетапы и утечки за {month}.",
  },
  zh: { title: "您的月度报告已生成", body: "查看您 {month} 的表现、策略与失误成本。" },
  ja: {
    title: "月次レポートが完成しました",
    body: "{month} のパフォーマンス、セットアップ、ミスを確認しましょう。",
  },
  ar: { title: "تقريرك الشهري جاهز", body: "اطّلع على أدائك وإعداداتك وأخطائك لشهر {month}." },
  hi: {
    title: "आपकी मासिक रिपोर्ट तैयार है",
    body: "{month} का प्रदर्शन, सेटअप और गलतियाँ देखें।",
  },
};

async function notifyUser(
  sb: AnyClient,
  userId: string,
  month: string,
  language: string,
): Promise<void> {
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs || subs.length === 0) return;

  const copy = PUSH_COPY[language] ?? PUSH_COPY.en;
  try {
    await sendWebPush(
      subs as PushSubRow[],
      {
        title: copy.title,
        body: copy.body.replace("{month}", month),
        // Deep link: App.tsx reads ?report=YYYY-MM and opens the Reports page.
        url: `/?report=${month}`,
        icon: "/icon-512.png",
      },
      async (id) => {
        await sb.from("push_subscriptions").delete().eq("id", id);
      },
    );
  } catch (e) {
    console.error("[monthly-report] push failed for", userId, e);
  }
}

/**
 * Vercel cron entrypoint (see src/server.ts). Runs on the 1st of each month
 * and generates the PREVIOUS month's report for every user who traded then.
 */
export async function handleMonthlyReportsCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase service credentials missing" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Previous month (UTC): running on the 1st produces the just-closed month.
  const now = new Date();
  const month = prevMonthOf(
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
  );
  const { start, end } = monthRange(month);

  const { data: rows, error } = await sb
    .from("trades")
    .select("user_id")
    .gte("trade_date", start)
    .lte("trade_date", end);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
  let generated = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      const report = await generateReportForUser(sb, userId, month);
      if (report) {
        generated++;
        const { data: prof } = await sb
          .from("profiles")
          .select("language")
          .eq("id", userId)
          .maybeSingle();
        await notifyUser(sb, userId, month, (prof?.language as string | undefined) || "en");
      }
    } catch (e) {
      failed++;
      console.error("[monthly-report] generation failed for", userId, e);
    }
  }

  return new Response(JSON.stringify({ month, users: userIds.length, generated, failed }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
