/**
 * A minimal logger port for the data layer.
 *
 * `@csa/mongodb` is imported by services that ALSO create the shared
 * `@csa/logger`; depending on `@csa/logger` here would form a package cycle
 * (logger → nothing, but a service → mongodb → logger → …) and couple the data
 * layer to Winston. Instead this package accepts any object with this tiny
 * structural shape — which the real `@csa/logger` `Logger` satisfies — and
 * defaults to a no-op so existing callers keep working untouched.
 */
export interface InjectedLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, err?: unknown, meta?: Record<string, unknown>): void;
}

/** No-op logger used when a caller does not inject one. */
export const noopLogger: InjectedLogger = {
  warn() {},
  error() {},
};
