import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), resolve: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../app/api/auth/shared", () => ({
  currentSessionToken: mocks.token,
  authServiceUrl: () => "http://auth.test"
}));
import { currentProductsConfiguration } from "./server-config";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
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
