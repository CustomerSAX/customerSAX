import { createLogger } from "@csa/logger";
import { getCommercetoolsToken } from "./auth.js";
import { resolveCommercetoolsProject } from "./project-config.js";

const log = createLogger("commercetools").child({ module: "client" });

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export async function commercetoolsGraphql<TData>(
  query: string,
  variables: Record<string, unknown> = {}
) {
  const config = await resolveCommercetoolsProject();
  const token = await getCommercetoolsToken(config);

  const response = await fetch(`${config.apiUrl}/${config.projectKey}/graphql`, {
    body: JSON.stringify({
      query,
      variables
    }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    method: "POST"
  });

  const payload = (await parseJsonSafely(response)) as GraphqlResponse<TData>;

  if (!response.ok) {
    const message = payload?.errors?.length
      ? payload.errors.map((error) => error.message).join("; ")
      : `HTTP ${response.status} ${response.statusText}`;

    throw new Error(`commercetools GraphQL failed: ${message}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("commercetools GraphQL returned no data");
  }

  return payload.data;
}

async function parseJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Runs a single-entity lookup (getById/getByKey/etc.) and turns any
 * commercetools error — invalid id, not found, malformed argument — into a
 * graceful `null` instead of letting it bubble up as an unhandled 500. The
 * real error is still logged server-side so the root cause isn't lost.
 */
export async function commercetoolsLookup<TData>(
  fn: () => Promise<TData | null>,
  context: string
): Promise<TData | null> {
  try {
    return await fn();
  } catch (error) {
    log.error("lookup failed", error, { context });

    return null;
  }
}

export function escapeWhere(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
