/**
 * AI Core — public facade. Components call these THROUGH server functions
 * (never a vendor SDK) and get typed results back.
 *
 *   AI.chat(...)               → coached Q&A on the trader's real data
 *   AI.generateDailyBrief(...) → pre-market brief
 *   AI.generateWeeklyReview(..)→ weekly synthesis
 *   AI.analyzeTrade(...)       → mentor debrief of one analyzed trade
 *   AI.detectPatterns(...)     → structured recurring-pattern list
 *   AI.generateLessons(...)    → durable lessons from mistakes
 *
 * Memory helpers (loadMemory/remember/forget) persist what the coach
 * learns so every future call starts already knowing the trader.
 */

export {
  aiChat,
  aiGenerateDailyBrief,
  aiGenerateWeeklyReview,
  aiAnalyzeTrade,
  aiDetectPatterns,
  aiGenerateLessons,
} from "@/lib/ai.functions";

export { loadMemory, remember, forget } from "./memory";
export type { MemoryKind, MemoryEntry } from "./memory";
export { contextBlocks, languageName } from "./context";
export type { AIUserContext, AITradeSummary } from "./context";

import {
  aiChat,
  aiGenerateDailyBrief,
  aiGenerateWeeklyReview,
  aiAnalyzeTrade,
  aiDetectPatterns,
  aiGenerateLessons,
} from "@/lib/ai.functions";

export const AI = {
  chat: aiChat,
  generateDailyBrief: aiGenerateDailyBrief,
  generateWeeklyReview: aiGenerateWeeklyReview,
  analyzeTrade: aiAnalyzeTrade,
  detectPatterns: aiDetectPatterns,
  generateLessons: aiGenerateLessons,
} as const;
