import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  session: vi.fn(),
  fetch: vi.fn(),
  log: vi.fn(),
  project: "b2c-csa",
  bindings: vi.fn(),
  result: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("../app/api/auth/shared", () => ({
  currentSessionToken: mocks.token,
  getValidatedSession: mocks.session
}));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "request-1", log: { error: mocks.log } })
}));
import { connectionHub } from "./connection-hub";
import { POST } from "../app/api/connection-hub/products/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.project = "b2c-csa";
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "private-server-api-key");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "client-a");
  mocks.token.mockResolvedValue("session-token");
  mocks.session.mockImplementation(async () => ({
    user: { activeClientId: "client-a", activeProjectKey: mocks.project }
  }));
  mocks.bindings.mockImplementation(() => [
    {
      id: "binding-1",
      tenantId: "client-a",
      projectKey: mocks.project,
      canonicalAction: "search-products",
      enabled: true
    }
  ]);
  mocks.result.mockImplementation(() => ({
    data: { hits: [{ objectID: "product-1" }], nbHits: 1 },
    execution: { mode: "live", projectKey: mocks.project, tenantId: "client-a" }
  }));
  mocks.fetch.mockImplementation(async (url: string) =>
    url.endsWith("/bindings")
      ? Response.json({ applicationId: "customersax", bindings: mocks.bindings() })
      : Response.json(mocks.result())
  );
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

it("resolves the selected project's saved binding and sends only business inputs", async () => {
  const response = await POST(request({ query: "product", limit: 5 }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    results: [{ objectID: "product-1" }],
    total: 1
  });
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/projects/b2c-csa/actions/search-products",
    expect.objectContaining({
      body: JSON.stringify({ query: "product", limit: 5 }),
      headers: expect.objectContaining({ "x-tenant-id": "client-a" })
    })
  );
});
it("uses the session project after a dropdown change", async () => {
  mocks.project = "other-project";
  expect((await POST(request({ query: "product" }))).status).toBe(200);
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/projects/other-project/actions/search-products",
    expect.anything()
  );
});
it("uses upstream browse with an honest unknown total", async () => {
  mocks.result.mockImplementation(() => ({
    data: [{ objectID: "product-1" }],
    execution: { mode: "live", projectKey: mocks.project, tenantId: "client-a" }
  }));
  const response = await POST(request({ query: "", limit: 5 }));
  expect(await response.json()).toEqual({
    ok: true,
    results: [{ objectID: "product-1" }],
    total: null
  });
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/projects/b2c-csa/actions/browse-records",
    expect.objectContaining({ body: JSON.stringify({ limit: 5 }) })
  );
});
it("rejects missing sessions and different tenants before connector requests", async () => {
  mocks.token.mockResolvedValue(null);
  expect((await POST(request({ query: "product" }))).status).toBe(401);
  mocks.token.mockResolvedValue("session-token");
  mocks.session.mockResolvedValue({
    user: { activeClientId: "other-client", activeProjectKey: "b2c-csa" }
  });
  expect((await POST(request({ query: "product" }))).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each([
  { query: "product", projectKey: "forged" },
  { query: "product", connectionId: "forged" },
  { query: "product", version: "latest" },
  { query: "product", limit: 101 }
])("rejects caller-selected scope or targets: %j", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it("keeps disabled bindings on the hub path and propagates revocation errors", async () => {
  mocks.bindings.mockImplementation(() => [
    {
      tenantId: "client-a",
      projectKey: mocks.project,
      canonicalAction: "search-products",
      enabled: false
    }
  ]);
  const config = await connectionHub.forProject({
    clientId: "client-a",
    projectKey: mocks.project
  });
  expect(config).toBeDefined();
  mocks.fetch.mockImplementation(async (url: string) =>
    url.endsWith("/bindings")
      ? Response.json({ applicationId: "customersax", bindings: mocks.bindings() })
      : new Response("revoked", { status: 403 })
  );
  expect((await POST(request({ query: "product" }))).status).toBe(403);
});
it("does not activate an unbound project or reuse a different project's binding", async () => {
  mocks.bindings.mockReturnValue([
    {
      tenantId: "client-a",
      projectKey: "another-project",
      canonicalAction: "search-products"
    }
  ]);
  expect(
    await connectionHub.forProject({ clientId: "client-a", projectKey: mocks.project })
  ).toBeUndefined();
});
it.each([
  {
    data: { hits: [], nbHits: 0 },
    execution: { mode: "demo", projectKey: "b2c-csa", tenantId: "client-a" }
  },
  {
    data: { hits: null, nbHits: 0 },
    execution: { mode: "live", projectKey: "b2c-csa", tenantId: "client-a" }
  },
  {
    data: { hits: [], nbHits: 0 },
    execution: { mode: "live", projectKey: "wrong-project", tenantId: "client-a" }
  }
])("rejects simulated, malformed or cross-project responses", async (payload) => {
  mocks.result.mockReturnValue(payload);
  expect((await POST(request({ query: "product" }))).status).toBe(502);
});
it("does not treat a failed binding lookup as an unbound project", async () => {
  mocks.fetch.mockResolvedValue(new Response("private-error", { status: 500 }));
  const response = await POST(request({ query: "product" }));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-error");
});
