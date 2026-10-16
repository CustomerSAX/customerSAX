import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  fetch: vi.fn(),
  log: vi.fn(),
  session: vi.fn(),
  settings: vi.fn(),
  provider: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("../app/api/auth/shared", () => ({
  currentSessionToken: mocks.token,
  authServiceUrl: () => "http://auth.test"
}));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "request-1", log: { error: mocks.log } })
}));
import { connectionHub } from "./connection-hub";
import { POST } from "../app/api/connection-hub/products/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "private-server-api-key");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "client-a");
  vi.stubEnv("BFF_URL", "http://bff.test/graphql");
  mocks.token.mockResolvedValue("session-token");
  mocks.session.mockReturnValue({
    user: {
      activeClientId: "client-a",
      activeProjectKey: "project-a",
      email: "agent@example.test",
      role: "agent"
    }
  });
  mocks.settings.mockReturnValue({
    provider: "algolia",
    appId: "APP",
    indexName: "products"
  });
  mocks.provider.mockImplementation(async () =>
    Response.json({
      data: { hits: [{ objectID: "product-1", name: "Product" }], nbHits: 1 },
      execution: { mode: "live" }
    })
  );
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url === "http://auth.test/sessions/current")
      return Response.json(mocks.session());
    if (url === "http://bff.test/graphql")
      return Response.json({ data: { projectProductsConfiguration: mocks.settings() } });
    return mocks.provider(url);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(body: unknown) {
  return new NextRequest("http://studio.test/api/connection-hub/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

it("uses session scope and the saved project catalog without exposing credentials", async () => {
  const response = await POST(request({ query: "product", limit: 5 }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    results: [{ objectID: "product-1", name: "Product" }],
    total: 1
  });
  expect(mocks.fetch).toHaveBeenCalledWith(
    "http://127.0.0.1:3100/v1/actions/search-products",
    expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer private-server-api-key",
        "x-csa-project-key": "project-a"
      }),
      body: JSON.stringify({
        query: "product",
        limit: 5,
        binding: { applicationId: "APP", indexName: "products" }
      }),
      cache: "no-store",
      redirect: "error"
    })
  );
});

it("uses upstream browse without inventing a catalog total", async () => {
  mocks.provider.mockImplementation(async () =>
    Response.json({ data: [{ objectID: "product-1" }], execution: { mode: "live" } })
  );
  const response = await POST(request({ query: "", limit: 5 }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    results: [{ objectID: "product-1" }],
    total: null
  });
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/actions/browse-records",
    expect.objectContaining({
      body: JSON.stringify({
        limit: 5,
        binding: { applicationId: "APP", indexName: "products" }
      })
    })
  );
});

it("rejects unauthenticated requests before any backend access", async () => {
  mocks.token.mockResolvedValue(null);
  expect((await POST(request({ query: "product" }))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("rejects another client before loading project settings", async () => {
  mocks.session.mockReturnValue({
    user: { activeClientId: "client-b", activeProjectKey: "project-a" }
  });
  expect((await POST(request({ query: "product" }))).status).toBe(403);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("follows a dropdown project switch and ignores the obsolete fixed-project environment variable", async () => {
  vi.stubEnv("CONNECTION_HUB_PROJECT_KEY", "obsolete-project");
  mocks.session.mockReturnValue({
    user: {
      activeClientId: "client-a",
      activeProjectKey: "project-b",
      email: "agent@example.test"
    }
  });
  expect((await POST(request({ query: "product" }))).status).toBe(200);
  const settingsCall = mocks.fetch.mock.calls.find(
    ([url]) => url === "http://bff.test/graphql"
  );
  expect(new Headers(settingsCall?.[1]?.headers).get("x-csa-project-key")).toBe(
    "project-b"
  );
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/actions/search-products",
    expect.objectContaining({
      headers: expect.objectContaining({ "x-csa-project-key": "project-b" })
    })
  );
});

it.each([null, { provider: "commercetools" }])(
  "rejects a selected project without a saved Algolia configuration: %j",
  async (settings) => {
    mocks.settings.mockReturnValue(settings);
    expect((await POST(request({ query: "product" }))).status).toBe(403);
    expect(mocks.provider).not.toHaveBeenCalled();
  }
);

it("passes only the selected project's saved index and propagates catalog mismatch rejection", async () => {
  mocks.settings.mockReturnValue({
    provider: "algolia",
    appId: "OTHERAPP",
    indexName: "other-catalog"
  });
  mocks.provider.mockImplementation(
    async () => new Response("CONNECTION_BINDING_MISMATCH", { status: 403 })
  );
  expect((await POST(request({ query: "product" }))).status).toBe(403);
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/actions/search-products",
    expect.objectContaining({
      body: JSON.stringify({
        query: "product",
        limit: 20,
        binding: { applicationId: "OTHERAPP", indexName: "other-catalog" }
      })
    })
  );
});

it.each([
  { query: "product", tenantId: "client-b" },
  { query: "product", projectKey: "project-b" },
  { query: "product", index: "private" },
  { query: "product", limit: 101 },
  { query: "x".repeat(301) }
])("rejects forged scope and invalid input: %j", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.provider).not.toHaveBeenCalled();
});

it("does not use a browser-supplied project header", async () => {
  const forged = new NextRequest("http://studio.test/api/connection-hub/products", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csa-project-key": "forged-project"
    },
    body: JSON.stringify({ query: "product" })
  });
  expect((await POST(forged)).status).toBe(200);
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/actions/search-products",
    expect.objectContaining({
      headers: expect.objectContaining({ "x-csa-project-key": "project-a" })
    })
  );
});

it("keeps provider failure distinct from empty results and hides internal details", async () => {
  mocks.provider.mockImplementation(
    async () => new Response("private-provider-error", { status: 500 })
  );
  const response = await POST(request({ query: "product" }));
  expect(response.status).toBe(502);
  const body = await response.text();
  expect(body).not.toContain("private-provider-error");
  expect(body).not.toContain("private-server-api-key");
  expect(JSON.parse(body).ok).toBe(false);
});

it.each([
  { data: { hits: [], nbHits: 0 }, execution: { mode: "demo" } },
  { data: { hits: null, nbHits: 0 }, execution: { mode: "live" } }
])("rejects simulated or malformed results", async (payload) => {
  mocks.provider.mockImplementation(async () => Response.json(payload));
  expect((await POST(request({ query: "product" }))).status).toBe(502);
});

it("fails closed when project settings are unavailable", async () => {
  mocks.settings.mockImplementation(() => {
    throw new Error("BFF unavailable");
  });
  expect((await POST(request({ query: "product" }))).status).toBe(502);
  expect(mocks.provider).not.toHaveBeenCalled();
});

it("does not require a fixed project key but still requires a configured client", () => {
  vi.stubEnv("CONNECTION_HUB_PROJECT_KEY", "");
  expect(connectionHub.getConfig()).toBeDefined();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "false");
  expect(connectionHub.getConfig()).toBeUndefined();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "");
  expect(() => connectionHub.getConfig()).toThrow();
});
