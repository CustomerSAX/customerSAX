/**
 * `@csa/logger/client` — a tiny, dependency-free `Logger` shim for browser /
 * client-component code (the webapp). Same shape as the server `Logger`, but
 * backed by `console` and with NO Winston, NO `AsyncLocalStorage`, and no
 * Node-only imports — so it is safe to bundle into a client component.
 *
 * Output is a single structured line per call (JSON in production, a readable
 * `console` call in development) so client logs stay greppable and shape-
 * compatible with the backend's.
 */

export interface LogMeta {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, err?: unknown, meta?: LogMeta): void;
  child(bindings: LogMeta): Logger;
}

function normalizeTrace(err: unknown): { name?: string; message: string; stack?: string } {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  if (err === undefined || err === null) return { message: String(err) };
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";

function makeLogger(service: string, bindings: LogMeta): Logger {
  const emit = (
    level: "debug" | "info" | "warn" | "error",
    consoleFn: (...args: unknown[]) => void,
    message: string,
    meta?: LogMeta
  ) => {
    const record = { level, service, ...bindings, message, ...meta };
    if (isProd) {
      consoleFn(JSON.stringify(record));
    } else {
      const tag = [service, bindings.module].filter(Boolean).join(":");
      consoleFn(`[${tag}] ${message}`, meta ?? "");
    }
  };

  return {
    debug: (message, meta) => emit("debug", console.debug.bind(console), message, meta),
    info: (message, meta) => emit("info", console.info.bind(console), message, meta),
    warn: (message, meta) => emit("warn", console.warn.bind(console), message, meta),
    error: (message, err, meta) =>
      emit("error", console.error.bind(console), message, { ...(err === undefined ? {} : normalizeTrace(err)), ...meta }),
    child: (childBindings) => makeLogger(service, { ...bindings, ...childBindings }),
  };
}

/** Creates a console-backed client logger with the shared `Logger` shape. */
export function createLogger(service: string, base?: LogMeta): Logger {
  return makeLogger(service, base ?? {});
}
