import { install, mapSourcePosition } from "source-map-support";
import { AppDataSource, ensureSchema } from "./db";
import { SystemLog, safeErrorMeta, safeLogMetadata, safeLogPath } from '@idp/shared';

const globalAny = globalThis as typeof globalThis & { __WBOT_LOGGER_INIT?: boolean };

if (!globalAny.__WBOT_LOGGER_INIT) {
  globalAny.__WBOT_LOGGER_INIT = true;
  Error.stackTraceLimit = Math.max(Error.stackTraceLimit || 10, 100);
  if (typeof (process as any).setSourceMapsEnabled === "function") {
    try {
      (process as any).setSourceMapsEnabled(true);
    } catch {
      // ignore source map enabling errors
    }
  }
  install({ environment: "node", handleUncaughtExceptions: false });
}

export type LogEntry = {
  level: "info" | "warning" | "error";
  source: string;
  action?: string | null;
  message?: string | null;
  meta?: any;
};

type ErrorFrame = {
  file: string;
  line: number;
  column: number;
  method?: string;
};

export type ErrorMeta = {
  name?: string;
  message?: string;
  stack?: string;
  frames?: ErrorFrame[];
};

export const insertLog = async ({ level, source, action, message, meta }: LogEntry) => {
  try {
    await ensureSchema();
    const repo = AppDataSource.getRepository(SystemLog);
    const log = repo.create({
      level,
      source,
      action: action ? (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(action)
        ? action.split(' ')[0] + ' ' + safeLogPath(action.slice(action.indexOf(' ') + 1)) : action) : null,
      message: message || null,
      meta: meta ? safeLogMetadata(meta) : null,
    });
    await repo.save(log);
  } catch {
    // Logging failures must never crash the app
    console.error("Failed to insert log");
  }
};

export const toErrorMeta = (err: any): ErrorMeta | null => {
  const details = safeErrorMeta(err);
  if (!details) return null;
  return { ...details, frames: details.frames.map((frame) => {
    try {
      const mapped = mapSourcePosition({ source: frame.file, line: frame.line, column: frame.column });
      return { ...frame, file: mapped.source || frame.file, line: mapped.line || frame.line, column: mapped.column || frame.column };
    } catch { return frame; }
  }) };
};

const baseLog =
  (level: LogEntry["level"]) =>
  (entry: Omit<LogEntry, "level">) => {
    if (level === "info") return Promise.resolve();
    return insertLog({ level, ...entry });
  };

export const logger = {
  info: baseLog("info"),
  warn: baseLog("warning"),
  error: baseLog("error"),
};
