/**
 * The shared Winston-backed structured logger for CSA backend services.
 *
 * `createLogger(service)` returns a small, stable `Logger` facade (not the raw
 * Winston instance) so every service logs the same way:
 *   - one JSON object per line in production (ready for Cloud Logging);
 *   - a colorized single-line format in development;
 *   - `service` on every line, plus any `child({ module })` bindings;
 *   - the active request context (requestId / tenant / route) auto-merged in.
 *
 * `error(msg, err, meta)` accepts the error as its own argument and normalizes
 * it to `{ name, message, stack }` so stack traces survive JSON serialization.
 */
import winston from "winston";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

export interface LogMeta {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  /** Logs at error level; `err` is normalized to `{ name, message, stack }`. */
  error(message: string, err?: unknown, meta?: LogMeta): void;
  /** Returns a logger that merges `bindings` (e.g. `{ module }`) into every line. */
  child(bindings: LogMeta): Logger;
}

const MAX_STRINGIFY = 8000;

/**
 * JSON.stringify that can't throw: guards cycles with a WeakSet, renders
 * bigints as strings and Errors as `{ name, message, stack }`, and caps the
 * output at ~8000 chars so a pathological object can't flood the logs.
 */
export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  let out: string;
  try {
    out = JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack };
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    });
  } catch {
    out = String(value);
  }
  if (out === undefined) return "undefined";
  return out.length > MAX_STRINGIFY ? out.slice(0, MAX_STRINGIFY) + "…[truncated]" : out;
}

/**
 * Normalizes any thrown value into a plain, JSON-safe trace object. Real
 * `Error`s keep name/message/stack; everything else is described honestly
 * without inventing a stack.
 */
export function normalizeTrace(err: unknown): { name?: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === "string") return { message: err };
  if (err === undefined || err === null) return { message: String(err) };
  return { message: safeStringify(err) };
}

let contextGetter: (() => Record<string, unknown> | undefined) | undefined;

/**
 * Wires the logger to a request-context source (set once by `index.ts` barrel).
 * Kept as an injection point so `logger.ts` has no import cycle with
 * `context.ts` and stays usable in isolation/tests.
 */
export function setContextProvider(getter: () => Record<string, unknown> | undefined): void {
  contextGetter = getter;
}

function devConsoleFormat() {
  return combine(
    colorize(),
    timestamp({ format: "HH:mm:ss.SSS" }),
    printf((info) => {
      const { level, message, timestamp: ts, service, module, stack, ...rest } = info as Record<string, unknown> & {
        level: string;
        message: unknown;
        timestamp?: string;
      };
      const tag = [service, module].filter(Boolean).join(":");
      const prefix = tag ? `[${tag}] ` : "";
      const restKeys = Object.keys(rest);
      const meta = restKeys.length ? " " + safeStringify(rest) : "";
      const trace = typeof stack === "string" ? "\n" + stack : "";
      return `${ts} ${level} ${prefix}${String(message)}${meta}${trace}`;
    })
  );
}

/**
 * Creates a service logger. `service` is stamped on every line; `base` bindings
 * (rarely needed) are merged into `defaultMeta`.
 */
export function createLogger(service: string, base?: LogMeta): Logger {
  const isProd = process.env.NODE_ENV === "production";
  const level = process.env.LOG_LEVEL || "info";

  const winstonLogger = winston.createLogger({
    level,
    format: combine(timestamp(), errors({ stack: true }), json()),
    defaultMeta: { service, ...base },
    transports: [
      new winston.transports.Console(isProd ? {} : { format: devConsoleFormat() }),
    ],
  });

  return makeLogger(winstonLogger, {});
}

function makeLogger(winstonLogger: winston.Logger, bindings: LogMeta): Logger {
  const emit = (level: "debug" | "info" | "warn" | "error", message: string, meta?: LogMeta) => {
    const ctx = contextGetter?.();
    winstonLogger.log(level, message, { ...ctx, ...bindings, ...meta });
  };

  return {
    debug: (message, meta) => emit("debug", message, meta),
    info: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, err, meta) => {
      const trace = err === undefined ? {} : normalizeTrace(err);
      emit("error", message, { ...trace, ...meta });
    },
    child: (childBindings) => makeLogger(winstonLogger, { ...bindings, ...childBindings }),
  };
}
