import { applyCsaHeaders } from "@csa/headers";
import type { CurrentUser } from "@/lib/get-current-user";

const bffUrl =
  process.env.BFF_URL?.trim() ||
  process.env.NEXT_PUBLIC_BFF_URL?.trim() ||
  process.env.AI_COMMERCE_SERVICE_URL?.trim() ||
  "http://127.0.0.1:4000/graphql";

export async function executeBffGraphql<T = any>(
  query: string,
  variables: Record<string, unknown>,
  user?: CurrentUser,
  clientId?: string
): Promise<T> {
  const effectiveClientId =
    clientId ||
    user?.activeClientId ||
    user?.organization?.id ||
    (user?.tenantId !== "csa" ? user?.tenantId : undefined);

  const headers = applyCsaHeaders(
    { "content-type": "application/json" } as Record<string, string>,
    {
      clientId: effectiveClientId,
      userRole: user?.role || "admin",
      userEmail: user?.email || "admin@customersax.com",
      projectKey: user?.activeProjectKey
    }
  );

  const res = await fetch(bffUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Backend service error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  return json.data as T;
}

