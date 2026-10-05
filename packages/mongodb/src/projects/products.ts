import { ObjectId } from "mongodb";
import { getProjectsCollection } from "../admin/db.js";
import { testProjectConnection } from "./test-connection.js";
import { encrypt, decrypt } from "../encrypt.js";

export type ProjectProducts = {
  provider: "commercetools" | "algolia";
  appId?: string;
  indexName?: string;
  searchApiKeyEncrypted?: string;
};
export type ProductsInput = {
  provider: string;
  appId?: string | null;
  indexName?: string | null;
  searchApiKey?: string | null;
};
export function productsSettingsView(settings?: ProjectProducts) {
  return {
    configured: !!settings,
    provider: settings?.provider ?? "commercetools",
    appId: settings?.appId ?? "",
    indexName: settings?.indexName ?? "",
    searchApiKeySet: !!settings?.searchApiKeyEncrypted
  };
}
export function prepareProducts(
  input: ProductsInput,
  previous?: ProjectProducts
): ProjectProducts {
  if (input.provider === "commercetools")
    return { ...previous, provider: "commercetools" };
  if (input.provider !== "algolia") throw new Error("Unsupported products provider");
  if (!process.env.SUPERADMIN_ENCRYPTION_KEY?.trim())
    throw new Error(
      "Configure SUPERADMIN_ENCRYPTION_KEY on the admin service before storing Algolia credentials"
    );
  const appId = input.appId?.trim() ?? "";
  const indexName = input.indexName?.trim() ?? "";
  if (!/^[a-zA-Z0-9]+$/.test(appId))
    throw new Error("Enter a valid Algolia application ID");
  if (!indexName) throw new Error("Algolia index name is required");
  const key = input.searchApiKey?.trim();
  if (!key && (previous?.appId !== appId || previous?.indexName !== indexName))
    throw new Error("Enter the search-only key when changing the application or index");
  const searchApiKeyEncrypted = key ? encrypt(key) : previous?.searchApiKeyEncrypted;
  if (!searchApiKeyEncrypted) throw new Error("Algolia search-only API key is required");
  return { provider: "algolia", appId, indexName, searchApiKeyEncrypted };
}
async function project(clientId: string, id: string) {
  if (!ObjectId.isValid(id)) throw new Error("Project not found for this client");
  const doc = await (
    await getProjectsCollection()
  ).findOne({ _id: new ObjectId(id), clientId });
  if (!doc) throw new Error("Project not found for this client");
  return doc;
}
export async function getProjectProducts(clientId: string, id: string) {
  return productsSettingsView((await project(clientId, id)).products);
}
export async function saveProjectProducts(
  clientId: string,
  id: string,
  input: ProductsInput
) {
  const doc = await project(clientId, id);
  if (
    input.provider === "commercetools" &&
    doc.platform &&
    doc.platform !== "commercetools"
  )
    throw new Error("CommerceTools products require a CommerceTools project");
  const settings = prepareProducts(input, doc.products);
  const result = await (
    await getProjectsCollection()
  ).updateOne(
    { _id: doc._id, clientId },
    { $set: { products: settings, updatedAt: new Date() } }
  );
  if (!result.matchedCount) throw new Error("Project no longer exists");
  return productsSettingsView(settings);
}

/** Server-only: return the browser-safe search key solely for the authenticated active project. */
export async function resolveProjectProducts(clientId: string, projectKey: string) {
  const doc = await (await getProjectsCollection()).findOne({ clientId, projectKey });
  if (!doc) throw new Error("Active project does not belong to this client");
  const settings = doc.products as ProjectProducts | undefined;
  if (!settings) return null;
  if (settings.provider === "commercetools")
    return { provider: "commercetools" as const };
  if (!settings.appId || !settings.indexName || !settings.searchApiKeyEncrypted)
    throw new Error("Project Algolia configuration is incomplete");
  return {
    provider: "algolia" as const,
    appId: settings.appId,
    indexName: settings.indexName,
    searchApiKey: decrypt(settings.searchApiKeyEncrypted)
  };
}
export async function testProjectProducts(
  clientId: string,
  id: string,
  input: ProductsInput
) {
  const doc = await project(clientId, id);
  if (
    input.provider === "commercetools" &&
    doc.platform &&
    doc.platform !== "commercetools"
  )
    throw new Error("CommerceTools products require a CommerceTools project");
  const settings = prepareProducts(input, doc.products);
  if (settings.provider === "commercetools") {
    const result = await testProjectConnection(id);
    return { success: result.ok, message: result.message };
  }
  try {
    const response = await fetch(
      `https://${settings.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(settings.indexName!)}/query`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          "content-type": "application/json",
          "x-algolia-application-id": settings.appId!,
          "x-algolia-api-key": decrypt(settings.searchApiKeyEncrypted!)
        },
        body: JSON.stringify({ query: "", hitsPerPage: 0, analytics: false })
      }
    );
    return response.ok
      ? { success: true, message: "Algolia index is reachable with this search key." }
      : {
          success: false,
          message: `Algolia connection failed (HTTP ${response.status}). Check the application, index, and search key permissions.`
        };
  } catch {
    return {
      success: false,
      message: "Could not reach Algolia. Check the application ID and try again."
    };
  }
}
