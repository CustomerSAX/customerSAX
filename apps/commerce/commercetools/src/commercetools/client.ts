import { getCommercetoolsToken } from "./auth.js";

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export async function commercetoolsGraphql<TData>(
  query: string,
  variables: Record<string, unknown> = {}
) {
  const apiUrl = trimTrailingSlash(requiredEnv("COMMERCETOOLS_API_URL"));
  const projectKey = requiredEnv("COMMERCETOOLS_PROJECT_KEY");
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

  if (!response.ok) {
    throw new Error(`commercetools GraphQL failed with ${response.status}`);
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("commercetools GraphQL returned no data");
  }

  return payload.data;
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
