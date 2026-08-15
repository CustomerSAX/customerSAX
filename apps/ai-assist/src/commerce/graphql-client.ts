/**
 * Platform-agnostic BFF GraphQL client.
 *
 * The platform identity is carried in the `x-csa-commerce-platform` header.
 * The LLM never knows which e-commerce backend it talks to — swapping platforms
 * is done by changing AI_COMMERCE_PLATFORM in the environment, no code changes.
 */

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
};

import { applyCsaHeaders } from "@csa/headers";
import { createLogger } from "@csa/logger";
import { contextStorage } from "../chat/system-prompt.js";
import { config } from "../config.js";

const log = createLogger("ai-assist").child({ module: "bff-client" });

function getServiceUrl(): string {
  return process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";
}

function getPlatform(): string {
  return process.env.AI_COMMERCE_PLATFORM ?? "commercetools";
}

/** Best-effort operation name from a GraphQL document, for tracing (no values logged). */
function operationName(query: string): string {
  const named = query.match(/\b(?:query|mutation|subscription)\s+([A-Za-z0-9_]+)/);
  return named?.[1] ?? "anonymous";
}

export async function bffQuery<TData>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const url = getServiceUrl();

  // Forward the full per-request CSA identity, not just projectKey. The
  // commercetools subgraph resolves a provisioned multi-tenant project on
  // (clientId, projectKey) — omitting x-csa-client-id silently falls back to
  // the single env project, a correctness AND tenant-isolation failure. Each
  // field is written only when present, so the single-tenant/env path (no
  // clientId in context) forwards exactly what it did before.
  const store = contextStorage.getStore();
  const headers = applyCsaHeaders(
    { "content-type": "application/json" } as Record<string, string>,
    {
      commercePlatform: getPlatform(),
      projectKey: store?.projectKey,
      clientId: store?.clientId,
      userRole: store?.userRole,
      userEmail: store?.userEmail
    }
  );

  const op = operationName(query);
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables })
    });
  } catch (err) {
    log.debug("bffQuery", { op, ms: Date.now() - startedAt, ok: false });
    throw err;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    log.debug("bffQuery", { op, status: response.status, ms: Date.now() - startedAt, ok: false });
    throw new Error(`BFF returned ${response.status}: ${text.slice(0, config.commerce.errorBodyPreviewChars)}`);
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;

  if (payload.errors?.length) {
    const msg = payload.errors.map((e) => e.message).join("; ");
    log.debug("bffQuery", { op, status: response.status, ms: Date.now() - startedAt, ok: false });
    throw new Error(`GraphQL error: ${msg}`);
  }

  if (!payload.data) {
    log.debug("bffQuery", { op, status: response.status, ms: Date.now() - startedAt, ok: false });
    throw new Error("BFF returned no data");
  }

  log.debug("bffQuery", { op, status: response.status, ms: Date.now() - startedAt, ok: true });
  return payload.data;
}

/** Format a Money object to a human-readable currency string */
export function formatMoney(money?: { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null): string {
  if (!money) return "N/A";
  const { centAmount = 0, currencyCode = "USD", fractionDigits = 2 } = money;
  const value = centAmount / Math.pow(10, fractionDigits);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}
