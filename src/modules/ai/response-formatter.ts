/**
 * Response Formatter — turns a raw provider `AIResponse` into the shape a
 * feature wants: clean text, validated JSON, or a custom format registered by
 * name. Keeps parsing/validation in ONE place instead of every caller doing
 * its own `JSON.parse` and hoping.
 *
 * Extensible: `registerFormatter(name, fn)` adds an output format without
 * touching this file. Business-agnostic — it knows nothing about trades.
 */
import type { ZodType } from "zod";
import type { AIResponse, ProviderToolCall } from "@/modules/ai-provider";

export interface FormattedResponse<T = unknown> {
  text: string;
  json?: T;
  toolCalls?: ProviderToolCall[];
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** Strip a ```json … ``` (or bare ```) fence some models wrap JSON in. */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

export type JsonParse<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parse the model's text as JSON, optionally validating with a Zod schema.
 *  Never throws — returns a discriminated result the caller can branch on. */
export function tryParseJson<T = unknown>(res: AIResponse, schema?: ZodType<T>): JsonParse<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(res.text));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid JSON" };
  }
  if (!schema) return { ok: true, value: parsed as T };
  const check = schema.safeParse(parsed);
  return check.success
    ? { ok: true, value: check.data }
    : { ok: false, error: check.error.message };
}

/** Base normalization every formatter builds on. */
export function toFormatted(res: AIResponse): FormattedResponse {
  return {
    text: res.text.trim(),
    provider: res.provider,
    model: res.model,
    usage: res.usage,
    ...(res.toolCalls?.length && { toolCalls: res.toolCalls }),
  };
}

// ── Formatter registry ───────────────────────────────────────────────────────

export type Formatter<T = unknown> = (res: AIResponse) => FormattedResponse<T>;

const formatters = new Map<string, Formatter>();

export function registerFormatter(name: string, fn: Formatter): () => void {
  formatters.set(name, fn);
  return () => {
    if (formatters.get(name) === fn) formatters.delete(name);
  };
}

export function getFormatter(name: string): Formatter | undefined {
  return formatters.get(name);
}

// Built-in formats.
const textFormatter: Formatter = (res) => toFormatted(res);
const jsonFormatter: Formatter = (res) => {
  const parsed = tryParseJson(res);
  const base = toFormatted(res);
  return parsed.ok ? { ...base, json: parsed.value } : base;
};

registerFormatter("text", textFormatter);
registerFormatter("markdown", textFormatter);
registerFormatter("json", jsonFormatter);

/** Format with a named formatter (defaults to plain text if unknown). */
export function formatWith(name: string, res: AIResponse): FormattedResponse {
  return (formatters.get(name) ?? textFormatter)(res);
}
