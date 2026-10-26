import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn(), log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./get-current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "test", log: { error: mocks.log } })
}));
import { algoliaPlugin } from "./algolia-plugin";
import { POST, DELETE } from "../app/api/connection-hub/algolia/route";
const input = {
  clientId: "client-a",
  projectKey: "project-a",
  applicationId: "APP123",
  apiKey: "synthetic-provider-key",
  indexName: "products"
};
type Binding = {
  id: string;
  revision: number;
  tenantId: string;
  projectKey: string;
  canonicalAction: string;
  connectorId: string;
  operation: string;
  connectionId: string;
  releaseId: string;
  allowedIndex: string;
  enabled: boolean;
};
let saved: Binding[];
function rows() {
  return ["search-products", "browse-records"].map((action) => ({
    id: action,
    revision: 2,
    tenantId: "client-a",
    projectKey: "project-a",
    canonicalAction: action,
    connectorId: "algolia",
    operation: action === "search-products" ? "rc_search_products" : action,
    connectionId: "old",
    releaseId: "release-a",
    allowedIndex: "products",
    enabled: true
  }));
}
beforeEach(() => {
  vi.clearAllMocks();
  saved = [];
  for (const [key, value] of Object.entries({
    CONNECTION_HUB_ENABLED: "true",
    USE_CONNECTION_HUB_PROD: "false",
    CONNECTION_HUB_URL: "http://127.0.0.1:3100",
    CONNECTION_HUB_CLIENT_ID: "client-a",
    CONNECTION_HUB_API_KEY: "synthetic-execution-key",
    CONNECTION_HUB_ADMIN_API_KEY: "synthetic-admin-key",
    CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH: "false",
    CONNECTION_HUB_TENANT_ID: ""
  }))
    vi.stubEnv(key, value);
  mocks.user.mockResolvedValue({
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-a"
  });
  mocks.fetch.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith("/project-a/bindings"))
      return Response.json({ applicationId: "connection-hub", bindings: saved });
    if (url.endsWith("/releases"))
      return Response.json({
        releases: [
          { id: "release-a", version: "1.1.0", connectorId: "algolia", enabled: true }
        ]
      });
    if (url.endsWith("/connections"))
      return Response.json({
        id: "new",
        connectorId: "algolia",
        mode: "live",
        enabled: true
      });
    const body = JSON.parse(String(options.body));
    const old = saved.find((item) => url.endsWith(`/bindings/${item.id}`));
    if (old)
      saved = saved.map((item) =>
        item === old ? { ...item, ...body, revision: item.revision + 1 } : item
      );
    else
      saved = [
        ...saved,
        { ...body, id: body.canonicalAction, revision: 1, tenantId: "client-a" }
      ];
    return Response.json({ id: old?.id ?? body.canonicalAction });
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function request(method = "POST", body: unknown = input, origin = "http://studio.test") {
  return new NextRequest("http://studio.test/api/connection-hub/algolia", {
    method,
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
}
it("validates the account in Hub and selects only search and browse for this project", async () => {
  const result = await algoliaPlugin.connect(input);
  expect(result).toMatchObject({
    connected: true,
    selected: true,
    indexName: "products"
  });
  expect(JSON.stringify(result)).not.toContain(input.apiKey);
  expect(saved.map((row) => row.operation)).toEqual([
    "rc_search_products",
    "browse-records"
  ]);
  expect(
    saved.every(
      (row) => row.connectionId === "new" && row.enabled && row.projectKey === "project-a"
    )
  ).toBe(true);
  const connection = mocks.fetch.mock.calls.find(([url]) =>
    url.endsWith("/connections")
  )!;
  expect(connection[1].headers.authorization).toBe("Bearer synthetic-admin-key");
  expect(JSON.parse(connection[1].body)).toMatchObject({
    applicationId: input.applicationId,
    apiKey: input.apiKey,
    indexName: input.indexName
  });
  expect(
    mocks.fetch.mock.calls.every(
      ([url]) => !url.includes("approve") && !url.includes("ticketing")
    )
  ).toBe(true);
});
it("uses revisions for replacement and removal, preserving Zendesk and native settings", async () => {
  saved = [
    ...rows(),
    {
      ...rows()[0],
      id: "zendesk",
      canonicalAction: "zendesk-find-tickets",
      connectorId: "zendesk"
    }
  ];
  await algoliaPlugin.connect(input);
  const updates = mocks.fetch.mock.calls.filter(([url]) => /admin\/bindings\//.test(url));
  expect(updates).toHaveLength(2);
  expect(
    updates.every(([, options]) => JSON.parse(options.body).expectedRevision === 2)
  ).toBe(true);
  const response = await DELETE(
    request("DELETE", { clientId: "client-a", projectKey: "project-a" })
  );
  expect(response.status).toBe(200);
  expect(
    saved.filter((item) => item.connectorId === "algolia").every((item) => !item.enabled)
  ).toBe(true);
  expect(saved.find((item) => item.id === "zendesk")?.enabled).toBe(true);
  expect(mocks.fetch.mock.calls.some(([url]) => url.includes("revoke"))).toBe(false);
});
it("rejects agents, unauthenticated users, foreign clients and changed project before mutations", async () => {
  for (const user of [
    null,
    { role: "agent", activeClientId: "client-a", activeProjectKey: "project-a" },
    { role: "admin", activeClientId: "other", activeProjectKey: "project-a" },
    { role: "admin", activeClientId: "client-a", activeProjectKey: "other" }
  ]) {
    mocks.user.mockResolvedValue(user);
    await expect(algoliaPlugin.connect(input)).rejects.toThrow();
  }
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("requires an approved release before sending provider credentials", async () => {
  mocks.fetch.mockImplementation(async (url: string) =>
    Response.json(
      url.endsWith("/bindings")
        ? { applicationId: "connection-hub", bindings: [] }
        : { releases: [] }
    )
  );
  await expect(algoliaPlugin.connect(input)).rejects.toThrow("Approve an Algolia");
  expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/connections"))).toBe(
    false
  );
});
it("rejects forged connection targets and cross-origin requests", async () => {
  await expect(
    algoliaPlugin.connect({ ...input, connectionId: "foreign" })
  ).rejects.toThrow();
  expect((await POST(request("POST", input, "https://foreign.test"))).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("reports incomplete selection after a partial update without hiding or leaking the failure", async () => {
  const handler = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation(async (url, options) => {
    if (String(options?.body).includes('"canonicalAction":"browse-records"'))
      return new Response(input.apiKey, { status: 409 });
    return handler(url, options);
  });
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(await response.text()).not.toContain(input.apiKey);
  expect(await algoliaPlugin.status()).toMatchObject({
    selected: true,
    connected: false,
    incomplete: true
  });
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(input.apiKey);
});
it("does not present another tenant's connection as selected", async () => {
  saved = rows().map((row) => ({ ...row, tenantId: "foreign" }));
  expect(await algoliaPlugin.status()).toMatchObject({
    selected: false,
    connected: false
  });
});
