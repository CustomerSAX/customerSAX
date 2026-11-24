import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  session: vi.fn(),
  fetch: vi.fn(),
  identity: vi.fn(),
  log: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getIdTokenClient() {
      return { getRequestHeaders: mocks.identity };
    }
  }
}));
vi.mock("../app/api/auth/shared", () => ({
  currentSessionToken: mocks.token,
  getValidatedSession: mocks.session
}));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "request-1", log: { error: mocks.log } })
}));
import { connectionHubCatalog } from "./connection-hub-catalog";
import { GET } from "../app/api/connection-hub/connectors/route";

function node(id: string) {
  return {
    id,
    name: id,
    description: "Connector description",
    category: "Search",
    authentication: { type: "api_key" },
    actions: [{ id: "search", name: "Search records", readOnly: true }]
  };
}
function page(
  nodes = [node("algolia")],
  hasNextPage = false,
  endCursor: string | null = nodes.at(-1)?.id ?? null
) {
  return Response.json({
    data: { connectors: { nodes, pageInfo: { hasNextPage, endCursor } } }
  });
}
const request = () => new NextRequest("http://studio.test/api/connection-hub/connectors");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  vi.stubEnv("CONNECTION_HUB_PROD_URL", "https://hub.example.test");
  vi.stubEnv("CONNECTION_HUB_PROD_API_KEY", "synthetic-hub-api-key");
  vi.stubEnv("CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH", "false");
  vi.stubEnv("CONNECTION_HUB_PREVIEW_CATALOG", "false");
  mocks.token.mockResolvedValue("session");
  mocks.session.mockResolvedValue({
    user: { role: "admin", activeClientId: "client-a" }
  });
  mocks.fetch.mockImplementation(async () => page());
  mocks.identity.mockResolvedValue(
    new Headers({ authorization: "Bearer synthetic-google-token" })
  );
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("serves real catalog metadata through an authenticated server endpoint without exposing its key", async () => {
  const response = await GET(request());
  const payload = await response.json();
  expect(response.status).toBe(200);
  expect(payload.connectors[0]).toMatchObject({
    id: "algolia",
    authenticationType: "api_key",
    actions: [{ id: "search", name: "Search records", readOnly: true }]
  });
  expect(JSON.stringify(payload)).not.toContain("synthetic-hub-api-key");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.fetch).toHaveBeenCalledWith(
    "https://hub.example.test/graphql",
    expect.objectContaining({
      headers: {
        authorization: "Bearer synthetic-hub-api-key",
        "content-type": "application/json"
      },
      redirect: "error",
      cache: "no-store"
    })
  );
  expect(mocks.identity).not.toHaveBeenCalled();
});
it("fetches every catalog page rather than stopping at Hub's default page size", async () => {
  mocks.fetch
    .mockResolvedValueOnce(page([node("algolia")], true))
    .mockResolvedValueOnce(page([node("zendesk")]));
  expect((await connectionHubCatalog.list()).map((connector) => connector.id)).toEqual([
    "algolia",
    "zendesk"
  ]);
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).variables).toEqual({
    first: 50,
    after: null
  });
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).variables).toEqual({
    first: 50,
    after: "algolia"
  });
});
it.each([
  null,
  { user: null },
  { user: { role: "agent" } },
  { user: { role: "forged" } }
])("rejects missing or non-admin identity: %j", async (session) => {
  mocks.session.mockResolvedValue(session);
  expect([401, 403]).toContain((await GET(request())).status);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("requires a cookie session before any Hub request and permits authenticated superadmins", async () => {
  mocks.token.mockResolvedValueOnce(null);
  expect((await GET(request())).status).toBe(401);
  expect(mocks.session).not.toHaveBeenCalled();
  mocks.session.mockResolvedValue({ user: { role: "superadmin" } });
  expect((await GET(request())).status).toBe(200);
});
it("supports any authenticated client without requiring a Hub tenant or project binding", async () => {
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "");
  vi.stubEnv("CONNECTION_HUB_PROD_TENANT_ID", "");
  mocks.session.mockResolvedValue({
    user: { role: "admin", activeClientId: "another-client" }
  });
  expect((await GET(request())).status).toBe(200);
  expect(mocks.fetch.mock.calls[0][0]).toBe("https://hub.example.test/graphql");
});
it("allows Google authentication only when explicitly configured for this catalog", async () => {
  vi.stubEnv("CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH", "true");
  await connectionHubCatalog.list();
  expect(mocks.fetch.mock.calls[0][1].headers).toMatchObject({
    authorization: "Bearer synthetic-hub-api-key",
    "X-Serverless-Authorization": "Bearer synthetic-google-token"
  });
});
it.each([
  ["CONNECTION_HUB_ENABLED", "false"],
  ["USE_CONNECTION_HUB_PROD", "yes"],
  ["CONNECTION_HUB_PROD_API_KEY", ""],
  ["CONNECTION_HUB_PROD_URL", "http://127.0.0.1:3100"],
  ["CONNECTION_HUB_PROD_URL", "https://hub.example.test/path"],
  ["CONNECTION_HUB_PROD_URL", "https://user:pass@hub.example.test"],
  ["CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH", "yes"],
  ["CONNECTION_HUB_PREVIEW_CATALOG", "yes"]
])("fails closed without falling back to local credentials: %s", async (name, value) => {
  vi.stubEnv(name, value);
  expect((await GET(request())).status).toBe(503);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("returns a legitimate empty catalog as success", async () => {
  mocks.fetch.mockResolvedValue(page([]));
  expect(await connectionHubCatalog.list()).toEqual([]);
});
it("appends preview connectors without replacing live catalog entries", async () => {
  vi.stubEnv("CONNECTION_HUB_PREVIEW_CATALOG", "true");
  mocks.fetch.mockResolvedValue(
    page([node("shopify"), node("commercetools"), node("algolia"), node("zendesk")])
  );
  const connectors = await connectionHubCatalog.list();
  for (const id of ["shopify", "commercetools", "algolia", "zendesk"])
    expect(connectors.filter((item) => item.id === id)).toEqual([
      expect.objectContaining({ name: id, availability: "available" })
    ]);
  expect(connectors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "sap-commerce-cloud", availability: "preview" }),
      expect.objectContaining({ id: "sap-s4hana", availability: "preview" }),
      expect.objectContaining({ id: "contentful", availability: "preview" }),
      expect.objectContaining({ id: "amplience", availability: "preview" }),
      expect.objectContaining({ id: "bloomreach-discovery", availability: "preview" }),
      expect.objectContaining({ id: "bloomreach-engagement", availability: "preview" })
    ])
  );
});
it("enables the preview catalog by default for Studio", async () => {
  vi.stubEnv("CONNECTION_HUB_PREVIEW_CATALOG", "");
  mocks.fetch.mockResolvedValue(page([node("algolia")]));
  expect(await connectionHubCatalog.list()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "algolia", availability: "available" }),
      expect.objectContaining({ id: "contentful", availability: "preview" })
    ])
  );
});
it("uses vendor-aligned authentication methods and credible action inventories", async () => {
  vi.stubEnv("CONNECTION_HUB_PREVIEW_CATALOG", "true");
  mocks.fetch.mockResolvedValue(page([]));
  const connectors = new Map(
    (await connectionHubCatalog.list()).map((connector) => [connector.id, connector])
  );
  expect(connectors.get("commercetools")).toMatchObject({
    authenticationType: "OAUTH2",
    actions: expect.arrayContaining([
      expect.objectContaining({ id: "products-search" }),
      expect.objectContaining({ id: "orders-create" })
    ])
  });
  expect(connectors.get("shopify")?.actions).toHaveLength(13);
  expect(connectors.get("bigcommerce")).toMatchObject({
    authenticationType: "ACCESS_TOKEN"
  });
  expect(connectors.get("sap-commerce-cloud")?.actions).toHaveLength(14);
  expect(connectors.get("sap-s4hana")?.actions).toHaveLength(12);
  expect(connectors.get("microsoft-dynamics-365")?.actions).toHaveLength(12);
  expect(connectors.get("oracle-netsuite")?.actions).toHaveLength(13);
  expect(connectors.get("contentful")).toMatchObject({
    authenticationType: "ACCESS_TOKEN"
  });
  expect(connectors.get("amplience")).toMatchObject({ authenticationType: "OAUTH2" });
  expect(connectors.get("adobe-experience-manager")).toMatchObject({
    authenticationType: "OAUTH2"
  });
  expect(connectors.get("bloomreach-discovery")).toMatchObject({
    authenticationType: "API_KEY"
  });
  expect(connectors.get("bloomreach-engagement")).toMatchObject({
    authenticationType: "BASIC_AUTH"
  });
});
it("reports upstream errors in place without leaking its response or request credentials", async () => {
  mocks.fetch.mockResolvedValue(
    Response.json({ errors: [{ message: "synthetic-provider-secret" }] })
  );
  const response = await GET(request());
  expect(response.status).toBe(502);
  expect(JSON.stringify(await response.json())).not.toContain(
    "synthetic-provider-secret"
  );
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("synthetic-provider-secret");
});
it("rejects malformed metadata and repeated pagination instead of showing a partial catalog", async () => {
  mocks.fetch.mockResolvedValueOnce(
    page([
      {
        ...node("algolia"),
        actions: [
          { id: "search", name: "Search", readOnly: true },
          { id: "search", name: "Duplicate", readOnly: true }
        ]
      }
    ])
  );
  await expect(connectionHubCatalog.list()).rejects.toThrow("catalog is unavailable");
  mocks.fetch
    .mockResolvedValueOnce(page([node("algolia")], true, "cursor"))
    .mockResolvedValueOnce(page([node("zendesk")], true, "cursor"));
  await expect(connectionHubCatalog.list()).rejects.toThrow("catalog is unavailable");
});
