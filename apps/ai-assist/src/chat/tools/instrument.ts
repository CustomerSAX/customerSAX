/**
 * Per-tool execution tracing.
 *
 * Wraps each tool's `execute` so every tool the assistant runs in a turn emits
 * one structured line — the "what the assistant did" trace. PII-safe by
 * construction: only the tool name, the ARG KEYS (never their values), the
 * duration, and an ok/error outcome are logged. The active requestId/projectKey
 * auto-merge from the request context (see `@csa/logger`).
 *
 * A tool is considered failed when it returns a truthy `error` field (the
 * repo-wide convention for "the backend call itself failed", distinct from a
 * legitimately empty result) or throws.
 */
import type { Logger } from "@csa/logger";

type LooseExecute = (...args: unknown[]) => unknown;

function isErrorResult(result: unknown): boolean {
  return Boolean(
    result && typeof result === "object" && "error" in result && (result as { error?: unknown }).error
  );
}

/**
 * Returns a copy of `tools` in which each tool's `execute` is wrapped with a
 * start (debug) + end (info) trace line under `module: "tools"`.
 *
 * The originals are NOT modified. Many tools are shared module-level objects
 * and the tool sets are rebuilt on every request, so wrapping in place stacked
 * one more wrapper per request — every call then logged N times after N
 * requests. Copying keeps exactly one wrapper per build.
 */
export function instrumentTools<T extends Record<string, unknown>>(tools: T, baseLog: Logger): T {
  const log = baseLog.child({ module: "tools" });
  const instrumented: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(tools)) {
    const tool = value as { execute?: LooseExecute };
    const original = tool.execute;
    if (typeof original !== "function") {
      instrumented[name] = value;
      continue;
    }

    instrumented[name] = {
      ...tool,
      execute: async (...args: unknown[]) => {
        const first = args[0];
        const argKeys = first && typeof first === "object" ? Object.keys(first as object) : [];
        const startedAt = Date.now();
        log.debug(`tool ${name}`, { argKeys });
        try {
          const result = await original(...args);
          log.info(`tool ${name}`, { argKeys, ok: !isErrorResult(result), ms: Date.now() - startedAt });
          return result;
        } catch (err) {
          log.error(`tool ${name}`, err, { argKeys, ok: false, ms: Date.now() - startedAt });
          throw err;
        }
      }
    };
  }

  return instrumented as T;
}
