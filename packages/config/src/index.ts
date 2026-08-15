/**
 * `@csa/config` — the shared environment/configuration layer for the CSA platform.
 *
 * This package is deliberately the lowest-level shared dependency: it has no
 * runtime dependencies and is imported (directly or via `@csa/mongodb`) by every
 * service to (a) load `.env` files at startup and (b) read individual variables.
 *
 * It replaces the five byte-similar `load-env.ts` files that previously lived in
 * `apps/auth`, `apps/ticketing`, `apps/admin`, `apps/commerce/commercetools` and
 * `apps/bff`, plus the `env`/`requiredEnv` helpers that used to live in
 * `@csa/mongodb`'s `connection.ts` and the `envInt` helper from
 * `apps/ai-assist/src/config.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads `.env` files into `process.env` for local development.
 *
 * Behaviour (identical to the hand-rolled `load-env.ts` files it replaces):
 *  - The current working directory's `.env` (`<cwd>/.env`) is always loaded
 *    first, followed by every path in `extraPaths` in the order given.
 *  - The candidate list is de-duplicated (a path appearing twice is loaded
 *    once), preserving first-seen order.
 *  - A missing file is silently skipped.
 *  - A variable is only set when it is not already present in `process.env`
 *    (`process.env[name] === undefined`) — i.e. real environment variables and
 *    earlier files always win over later files. Nothing is ever overridden.
 *  - Quoted values (`"`, `'` or `` ` ``) are unwrapped and `\n` sequences inside
 *    them are turned into real newlines (needed for multi-line keys/certs).
 *
 * Per-service differences (the app's own `.env`, and the shared `auth/.env`
 * that `admin`/`commercetools` also read) are passed via `extraPaths` as
 * absolute paths, typically computed from the caller's own `import.meta.url`.
 *
 * @param opts.extraPaths Absolute `.env` paths to load after `<cwd>/.env`.
 */
export function loadEnv(opts: { extraPaths?: string[] } = {}): void {
  const cwdEnvPath = resolve(process.cwd(), ".env");
  const candidates = [cwdEnvPath, ...(opts.extraPaths ?? [])];

  for (const envPath of Array.from(new Set(candidates))) {
    loadEnvFile(envPath);
  }
}

function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = normalizeEnvValue(trimmed.slice(separatorIndex + 1).trim());

    if (name && process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}

function normalizeEnvValue(value: string): string {
  const quote = value[0];
  const last = value[value.length - 1];

  if ((quote === "\"" || quote === "'" || quote === "`") && last === quote) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value;
}

/** Reads and trims an env var, returning `undefined` when empty/unset. */
export function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Like {@link env} but throws when the variable is missing. */
export function requiredEnv(name: string): string {
  const value = env(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/** Parse a positive integer env var, falling back to `fallback` when unset/invalid. */
export function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
