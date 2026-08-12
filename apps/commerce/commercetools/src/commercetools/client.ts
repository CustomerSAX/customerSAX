import { getCommercetoolsToken } from "./auth.js";

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export async function commercetoolsGraphql<TData>(
  query: string,
  variables: Record<string, unknown> = {}
) {
  const projectKey = requiredEnv("COMMERCETOOLS_PROJECT_KEY");
  const apiUrl = resolveApiUrl(projectKey);
  const token = await getCommercetoolsToken();

  const response = await fetch(`${apiUrl}/${projectKey}/graphql`, {
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
    console.error(
      `[commercetools] ${context} failed: ${error instanceof Error ? error.message : String(error)}`
    );

    return null;
  }
}

export function escapeWhere(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "");
}

// Accept either the API origin used by this adapter or an existing full
// project GraphQL URL used by older CSA deployments.
function resolveApiUrl(projectKey: string) {
  const apiUrl = process.env.COMMERCETOOLS_API_URL?.trim();
  if (apiUrl) return trimTrailingSlash(apiUrl);

  const graphqlUrl = process.env.COMMERCETOOLS_GRAPHQL_URL?.trim();
  if (graphqlUrl) {
    const suffix = `/${projectKey}/graphql`;
    const normalized = trimTrailingSlash(graphqlUrl);
    return normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : normalized;
  }

  throw new Error("Missing required environment variable: COMMERCETOOLS_API_URL or COMMERCETOOLS_GRAPHQL_URL");
}
