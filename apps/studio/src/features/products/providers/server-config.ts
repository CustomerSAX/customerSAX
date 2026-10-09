import "server-only";
import { applyCsaHeaders } from "@csa/headers";
import { currentSessionToken, getValidatedSession } from "../../../app/api/auth/shared";
import { productsProvider } from "./config";

/** Resolve only from the authenticated session, never from URL-supplied project IDs. */
export async function currentProductsConfiguration() {
  const token = await currentSessionToken();
  if (!token) throw new Error("Sign in to browse products");
  const session = await getValidatedSession(token);
  const user = session?.user as {
    activeClientId?: string;
    activeProjectKey?: string;
    email?: string;
    role?: string;
  } | undefined;
  if (!user) throw new Error("Sign in to browse products");
  if (!user?.activeClientId || !user.activeProjectKey)
    throw new Error("Select a project to browse products");
  const result = await fetch(
    process.env.BFF_URL?.trim() ||
      process.env.AI_COMMERCE_SERVICE_URL?.trim() ||
      "http://127.0.0.1:4000/graphql",
    {
      method: "POST",
      headers: applyCsaHeaders(
        { "content-type": "application/json" } as Record<string, string>,
        {
          clientId: user.activeClientId,
          projectKey: user.activeProjectKey,
          userEmail: user.email,
          userRole: user.role
        }
      ),
      body: JSON.stringify({
        query: `query CurrentProductsConfiguration {
        projectProductsConfiguration { provider appId indexName searchApiKey }
      }`
      }),
      cache: "no-store"
    }
  );
  if (!result.ok) throw new Error("Products configuration service is unavailable");
  const payload = (await result.json()) as {
    data?: {
      projectProductsConfiguration?: {
        provider: "commercetools" | "algolia";
        appId?: string;
        indexName?: string;
        searchApiKey?: string;
      } | null;
    };
    errors?: unknown[];
  };
  if (payload.errors?.length || payload.data?.projectProductsConfiguration === undefined)
    throw new Error("Unable to load Products configuration");
  const settings = payload.data.projectProductsConfiguration;
  if (
    settings?.provider === "algolia" &&
    (!settings.appId || !settings.indexName || !settings.searchApiKey)
  )
    throw new Error("Project Algolia configuration is incomplete");
  const provider = productsProvider(settings?.provider);
  return {
    key: `${user.activeClientId}:${user.activeProjectKey}:${provider}`,
    provider,
    searchConfig:
      settings?.provider === "algolia"
        ? {
            enabled: true,
            provider: "algolia",
            appId: settings.appId,
            indexName: settings.indexName,
            searchApiKey: settings.searchApiKey,
            sortOptions: [{ label: "Relevance", value: settings.indexName! }]
          }
        : undefined
  };
}
