/**
 * `@csa/headers` — the single source of truth for the CSA cross-service HTTP
 * header contract.
 *
 * Every hop in the platform (webapp → BFF → subgraphs, ai-assist → BFF) carries
 * per-tenant/user identity and a correlation id as a fixed set of `x-csa-*`
 * (plus `x-request-id`) headers. Historically the literal header names were
 * copy-pasted across ~30 sites (bff/admin/ticketing/commercetools `index.ts`,
 * the webapp route handlers, ai-assist's clients, `@csa/logger`), each with its
 * own hand-rolled `headerValue` normalizer. This package owns the contract in
 * ONE place so a rename or a new header is a single edit.
 *
 * It is deliberately dependency-free and runtime-agnostic: `readCsaContext`
 * works for both a `node:http` `IncomingMessage` and the object Apollo passes as
 * `context({ req })`, and `applyCsaHeaders` writes to anything with a `.set`
 * method (a fetch `Headers`, Apollo's `RemoteGraphQLDataSource` request headers)
 * as well as a plain header record.
 */

/** The canonical CSA header names, keyed by their logical field. */
export const CSA_HEADERS = {
  commercePlatform: "x-csa-commerce-platform",
  projectKey: "x-csa-project-key",
  clientId: "x-csa-client-id",
  userRole: "x-csa-user-role",
  userEmail: "x-csa-user-email",
  requestId: "x-request-id",
} as const;

/** A logical field name in the header contract (e.g. `"projectKey"`). */
export type CsaHeaderField = keyof typeof CSA_HEADERS;

/** A canonical wire header name (e.g. `"x-csa-project-key"`). */
export type CsaHeaderName = (typeof CSA_HEADERS)[CsaHeaderField];

/**
 * The per-request identity/correlation carried across service hops. Every field
 * is optional — a value is only present when the corresponding header was set.
 */
export interface CsaContext {
  commercePlatform?: string;
  projectKey?: string;
  clientId?: string;
  userRole?: string;
  userEmail?: string;
  requestId?: string;
}

/**
 * Normalizes a raw header value to a single string.
 *
 * `node:http` represents a repeated header as `string[]`; a single header as
 * `string`; an absent one as `undefined`. This is the normalizer that used to
 * be copy-pasted into every service's `index.ts` and `@csa/logger`.
 */
export function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A readable inbound header bag — either fetch-style (`.get`) or node-style (record). */
type ReadableHeaders =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function readHeader(headers: ReadableHeaders, name: string): string | undefined {
  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get(name: string): string | null }).get(name) ?? undefined;
  }
  return headerValue((headers as Record<string, string | string[] | undefined>)[name]);
}

/**
 * Reads the CSA context off an inbound request's headers.
 *
 * Accepts anything with a `headers` bag: a `node:http` `IncomingMessage`, the
 * `req` object Apollo hands to a `context({ req })` factory, or a fetch-style
 * `{ headers: Headers }`. Values are returned verbatim (no trimming) — callers
 * that need a guaranteed correlation id (e.g. `@csa/logger`) apply their own
 * trim/fallback.
 */
export function readCsaContext(req: { headers: ReadableHeaders }): CsaContext {
  const headers = req.headers;
  return {
    commercePlatform: readHeader(headers, CSA_HEADERS.commercePlatform),
    projectKey: readHeader(headers, CSA_HEADERS.projectKey),
    clientId: readHeader(headers, CSA_HEADERS.clientId),
    userRole: readHeader(headers, CSA_HEADERS.userRole),
    userEmail: readHeader(headers, CSA_HEADERS.userEmail),
    requestId: readHeader(headers, CSA_HEADERS.requestId),
  };
}

/** A writable outbound header target — either `.set`-based or a plain record. */
type WritableHeaders =
  | { set(name: string, value: string): void }
  | Record<string, string>;

function writeHeader(target: WritableHeaders, name: string, value: string): void {
  if (typeof (target as { set?: unknown }).set === "function") {
    (target as { set(name: string, value: string): void }).set(name, value);
  } else {
    (target as Record<string, string>)[name] = value;
  }
}

/**
 * Writes the present fields of `ctx` onto an outgoing headers object and returns
 * it. Works for a fetch `Headers`, Apollo's `RemoteGraphQLDataSource` request
 * headers, or a plain `Record<string, string>`. Only keys that are present
 * (`!== undefined`) on `ctx` are written — absent identity is never forwarded as
 * an empty header.
 */
export function applyCsaHeaders<T extends WritableHeaders>(target: T, ctx: CsaContext): T {
  if (ctx.commercePlatform !== undefined) writeHeader(target, CSA_HEADERS.commercePlatform, ctx.commercePlatform);
  if (ctx.projectKey !== undefined) writeHeader(target, CSA_HEADERS.projectKey, ctx.projectKey);
  if (ctx.clientId !== undefined) writeHeader(target, CSA_HEADERS.clientId, ctx.clientId);
  if (ctx.userRole !== undefined) writeHeader(target, CSA_HEADERS.userRole, ctx.userRole);
  if (ctx.userEmail !== undefined) writeHeader(target, CSA_HEADERS.userEmail, ctx.userEmail);
  if (ctx.requestId !== undefined) writeHeader(target, CSA_HEADERS.requestId, ctx.requestId);
  return target;
}
