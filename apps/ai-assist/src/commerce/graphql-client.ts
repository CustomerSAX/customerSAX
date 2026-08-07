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

function getServiceUrl(): string {
  return process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";
}

function getPlatform(): string {
  return process.env.AI_COMMERCE_PLATFORM ?? "commercetools";
}

export async function bffQuery<TData>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const url = getServiceUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-commerce-platform": getPlatform()
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`BFF returned ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;

  if (payload.errors?.length) {
    const msg = payload.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL error: ${msg}`);
  }

  if (!payload.data) {
    throw new Error("BFF returned no data");
  }

  return payload.data;
}

/** Format a Money object to a human-readable currency string */
export function formatMoney(money?: { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null): string {
  if (!money) return "N/A";
  const { centAmount = 0, currencyCode = "USD", fractionDigits = 2 } = money;
  const value = centAmount / Math.pow(10, fractionDigits);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}
