/**
 * Structured logger for server-side logging. Outputs JSON lines for log
 * aggregation (CloudWatch, Logtail, etc.). Silent in client bundles.
 */

const IS_SERVER = typeof window === "undefined";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!IS_SERVER) return;
  const entry: LogEntry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
