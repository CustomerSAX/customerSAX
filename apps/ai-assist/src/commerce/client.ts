import { applyCsaHeaders } from "@csa/headers";
import { getCommercePlatform, getCommerceServiceUrl } from "./platform.js";

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export type CommerceContext = {
  platform: string;
  provider?: string;
  serviceUrl?: string;
};

export async function getCommerceContext(): Promise<CommerceContext> {
  const serviceUrl = getCommerceServiceUrl();

  if (!serviceUrl) {
    return {
      platform: getCommercePlatform()
    };
  }

  const data = await graphql<{ commerceProvider: string }>(
    serviceUrl,
    `query CommerceProvider {
      commerceProvider
    }`
  );

  return {
    platform: getCommercePlatform(),
    provider: data.commerceProvider,
    serviceUrl
  };
}

async function graphql<TData>(url: string, query: string): Promise<TData> {
  const response = await fetch(url, {
    body: JSON.stringify({ query }),
    headers: applyCsaHeaders(
      { "content-type": "application/json" } as Record<string, string>,
      { commercePlatform: getCommercePlatform() }
    ),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Commerce service returned ${response.status}`);
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Commerce service returned no data");
  }

  return payload.data;
}
