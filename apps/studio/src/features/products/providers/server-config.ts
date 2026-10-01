import "server-only";
import { resolveProjectProducts } from "@csa/mongodb";
import { authServiceUrl, currentSessionToken } from "../../../app/api/auth/shared";
import { productsProvider } from "./config";

/** Resolve only from the authenticated session, never from URL-supplied project IDs. */
export async function currentProductsConfiguration() {
  const token = await currentSessionToken();
  if (!token) throw new Error("Sign in to browse products");
  const response = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Sign in to browse products");
  const { user } = (await response.json()) as {
    user?: { activeClientId?: string; activeProjectKey?: string };
  };
  if (!user?.activeClientId || !user.activeProjectKey)
    throw new Error("Select a project to browse products");
  const settings = await resolveProjectProducts(
    user.activeClientId,
    user.activeProjectKey
  );
  const provider = settings?.provider ?? productsProvider(process.env.PRODUCTS_PROVIDER);
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
