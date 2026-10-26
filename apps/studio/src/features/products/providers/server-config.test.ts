import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), resolve: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../app/api/auth/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../app/api/auth/shared")>();
  return {
    ...actual,
    currentSessionToken: mocks.token,
    authServiceUrl: () => "http://auth.test"
  };
});
import { currentProductsConfiguration } from "./server-config";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "false");
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "false");
  vi.stubEnv("CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH", "false");
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("AUTH_SERVICE_URL", "http://auth.test");
  vi.stubEnv("PRODUCTS_PROVIDER", "commercetools");
  mocks.token.mockResolvedValue("session-token");
  vi.stubEnv("BFF_URL", "http://bff.test/graphql");
  mocks.fetch.mockImplementation(async (url: string) =>
    url === "http://auth.test/sessions/current"
      ? {
          ok: true,
          json: async () => ({
            user: {
              activeClientId: "client",
              activeProjectKey: "store",
              email: "agent@example.test",
              role: "agent"
            }
          })
        }
      : {
          ok: true,
          json: async () => ({
            data: { projectProductsConfiguration: await mocks.resolve() }
          })
        }
  );
  mocks.resolve.mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("resolves saved settings only for the authenticated active project", async () => {
  mocks.resolve.mockResolvedValue({
    provider: "algolia",
    appId: "APP",
    indexName: "project-index",
    searchApiKey: "search-only"
  });
  const settings = await currentProductsConfiguration();
  expect(mocks.fetch).toHaveBeenCalledWith(
    "http://bff.test/graphql",
    expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: expect.objectContaining({
        "x-csa-client-id": "client",
        "x-csa-project-key": "store",
        "x-csa-user-email": "agent@example.test"
      })
    })
  );
  expect(mocks.fetch).toHaveBeenCalledWith("http://auth.test/sessions/current", {
    headers: { authorization: "Bearer session-token" },
    cache: "no-store"
  });
  expect(settings.provider).toBe("algolia");
  expect(settings.searchConfig?.sortOptions).toEqual([
    { label: "Relevance", value: "project-index" }
  ]);
});
it("defaults unconfigured projects to Native even when the environment selects Algolia", async () => {
  vi.stubEnv("PRODUCTS_PROVIDER", "algolia");
  expect((await currentProductsConfiguration()).provider).toBe("commercetools");
  mocks.resolve.mockResolvedValue({ provider: "commercetools" });
  const settings = await currentProductsConfiguration();
  expect(settings.provider).toBe("commercetools");
  expect(settings.searchConfig).toBeUndefined();
});
it("fails closed for missing authentication or project selection", async () => {
  mocks.token.mockResolvedValue(null);
  await expect(currentProductsConfiguration()).rejects.toThrow("Sign in");
  expect(mocks.resolve).not.toHaveBeenCalled();
  mocks.token.mockResolvedValue("session-token");
  mocks.fetch.mockResolvedValue({ ok: false });
  await expect(currentProductsConfiguration()).rejects.toThrow("Sign in");
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: {} }) });
  await expect(currentProductsConfiguration()).rejects.toThrow("Select a project");
  expect(mocks.resolve).not.toHaveBeenCalled();
});
it("does not fall back to another catalog if project settings cannot be loaded", async () => {
  mocks.resolve.mockRejectedValue(new Error("Project unavailable"));
  await expect(currentProductsConfiguration()).rejects.toThrow("Project unavailable");
});

it("does not treat GraphQL errors or missing data as an unconfigured project", async () => {
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { activeClientId: "client", activeProjectKey: "store" }
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: "Unavailable" }] })
    });
  await expect(currentProductsConfiguration()).rejects.toThrow("Unable to load");
});

it("uses saved hub bindings without loading project Algolia credentials", async () => {
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "server-only-connector-key");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "client");
  const original = mocks.fetch.getMockImplementation();
  mocks.fetch.mockImplementation(async (url: string, init: RequestInit) =>
    url.endsWith("/bindings")
      ? Response.json({
          applicationId: "customersax",
          bindings: ["search-products", "browse-records"].map((action) => ({
            id: action,
            revision: 1,
            tenantId: "client",
            projectKey: "store",
            canonicalAction: action,
            connectorId: "algolia",
            operation: action === "search-products" ? "rc_search_products" : action,
            allowedIndex: "products",
            connectionId: "conn-a",
            releaseId: "release-a",
            enabled: true
          }))
        })
      : original?.(url, init)
  );
  const settings = await currentProductsConfiguration();
  expect(settings.connectionHubEnabled).toBe(true);
  expect(settings.searchConfig).toBeUndefined();
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).not.toContain("server-only-connector-key");
});
it("retains the existing provider for clients without hub configuration", async () => {
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "server-only-connector-key");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "another-client");
  const settings = await currentProductsConfiguration();
  expect(settings.connectionHubEnabled).toBe(false);
  expect(settings.provider).toBe("commercetools");
});
