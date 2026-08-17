/**
 * Shared helpers for the studio API routes' outbound BFF calls.
 *
 * The commerce platform the BFF fronts is a per-deployment env choice
 * (`BFF_COMMERCE_PLATFORM`), never a hardcoded literal — the studio routes used
 * to send a fixed `x-csa-commerce-platform: commercetools`, which silently sent
 * the wrong platform on any non-commercetools deployment. Read it from the env
 * (defaulting to `commercetools`) exactly like `api/tickets/route.ts` does.
 */
import { CSA_HEADERS } from "@csa/headers";

/** The commerce platform the BFF is configured to front, from the environment. */
export function commercePlatform(): string {
  return process.env.BFF_COMMERCE_PLATFORM ?? "commercetools";
}

/** JSON request headers for an outbound BFF call, carrying the commerce platform. */
export function bffJsonHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    [CSA_HEADERS.commercePlatform]: commercePlatform(),
  };
}
