/**
 * Pricing defaults for the commercetools project the current request runs
 * against (multi-tenant: see `project-config.ts` / `project-context.ts`).
 *
 * Price selection must never assume a currency. A project priced in AUD
 * (or EUR, GBP, ...) previously got `resolvedPrice: null` for every product
 * because callers fell back to a hardcoded "USD". When the caller does not
 * pass an explicit currency, use the project's own configured currency
 * (the first entry of `project.currencies`, which is how commercetools
 * orders them in project settings).
 *
 * Cached per project for 10 minutes: project settings change rarely and
 * this is read on every catalog search. A failed lookup is not cached and
 * resolves to `undefined` so callers can fall back to the product's own
 * price data rather than a fabricated currency.
 */
import { createLogger } from "@csa/logger";
import { commercetoolsGraphql } from "./client.js";
import { resolveCommercetoolsProject } from "./project-config.js";

const log = createLogger("commercetools").child({ module: "project-pricing" });

export type ProjectPricingDefaults = {
  currency?: string;
  country?: string;
};

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { value: ProjectPricingDefaults; expiresAt: number }>();

export async function projectPricingDefaults(): Promise<ProjectPricingDefaults> {
  let projectKey: string | undefined;
  try {
    const config = await resolveCommercetoolsProject();
    projectKey = config.projectKey;
    const cacheKey = `${config.apiUrl}|${config.projectKey}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const data = await commercetoolsGraphql<{
      project: { currencies?: string[]; countries?: string[] } | null;
    }>(`#graphql
      query ProjectPricingDefaults {
        project { currencies countries }
      }
    `);
    const value: ProjectPricingDefaults = {
      currency: data.project?.currencies?.[0],
      country: data.project?.countries?.[0]
    };
    cache.set(cacheKey, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch (error) {
    log.error("project pricing lookup failed", error, { projectKey });
    return {};
  }
}
