import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn(), log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./get-current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "test", log: { error: mocks.log } })
}));
import { connectionHubManagement } from "./connection-hub-management";
import { DELETE } from "../app/api/connection-hub/connectors/[connectorId]/route";

const scope = { clientId: "client-a", projectKey: "project-a" };
const binding = {
  id: "binding-a",
  tenantId: "hub-tenant",
  projectKey: "project-a",
  connectorId: "zendesk",
  operation: "read",
  connectionId: "shared-account",
  releaseId: "approved-release",
  allowedIndex: "resource",
  revision: 2,
  enabled: true
};
let saved: (typeof binding)[];
function remove(
  connectorId = "zendesk",
  body: unknown = scope,
  origin = "http://studio.test"
) {
  return DELETE(
    new NextRequest(`http://studio.test/api/connection-hub/connectors/${connectorId}`, {
      method: "DELETE",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ connectorId }) }
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    CONNECTION_HUB_ENABLED: "true",
    USE_CONNECTION_HUB_PROD: "false",
    CONNECTION_HUB_URL: "http://127.0.0.1:3100",
    CONNECTION_HUB_API_KEY: "synthetic-execution-key",
    CONNECTION_HUB_ADMIN_API_KEY: "synthetic-management-key",
    CONNECTION_HUB_CLIENT_ID: "client-a",
    CONNECTION_HUB_TENANT_ID: "hub-tenant",
    CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH: "false"
  }))
    vi.stubEnv(key, value);
  mocks.user.mockResolvedValue({
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-a"
  });
  saved = [
    { ...binding },
    { ...binding, id: "another-action", operation: "write", revision: 4 },
    { ...binding, id: "disabled", enabled: false },
    { ...binding, id: "other-project", projectKey: "other" },
    { ...binding, id: "other-tenant", tenantId: "other" },
    { ...binding, id: "other-provider", connectorId: "github" }
  ];
  mocks.fetch.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith("/projects/project-a/bindings"))
      return Response.json({ applicationId: "connection-hub", bindings: saved });
    const target = saved.find((item) => url.endsWith(`/admin/bindings/${item.id}`));
    if (!target) throw new Error("Unexpected Hub request");
    const body = JSON.parse(String(options.body));
    if (body.expectedRevision !== target.revision)
      return new Response(null, { status: 409 });
    Object.assign(target, body, { revision: target.revision + 1 });
    return Response.json(target);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([
  "algolia",
  "zendesk",
  "microsoft-teams",
  "jira-cloud",
  "jira-data-center",
  "gmail",
  "microsoft-outlook",
  "zoho-mail",
  "sendgrid",
  "mailgun",
  "postmark",
  "salesforce",
  "pipedrive",
  "zoho-crm",
  "microsoft-dynamics-crm",
  "close",
  "github",
  "future-connector"
])(
  "removes all enabled %s actions without changing other projects, tenants or accounts",
  async (connectorId) => {
    saved.slice(0, 5).forEach((item) => {
      item.connectorId = connectorId;
    });
    saved[5].connectorId = "different-provider";
    const response = await remove(connectorId);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      ...scope,
      connectorId,
      connected: false
    });
    expect(saved.slice(0, 3).every((item) => !item.enabled)).toBe(true);
    expect(saved.slice(3).every((item) => item.enabled)).toBe(true);
    const writes = mocks.fetch.mock.calls.filter(
      ([, options]) => options.method === "POST"
    );
    expect(writes).toHaveLength(2);
    expect(
      writes.map(([, options]) => JSON.parse(options.body).expectedRevision)
    ).toEqual([2, 4]);
    expect(
      writes.every(
        ([, options]) =>
          options.headers.authorization === "Bearer synthetic-management-key" &&
          options.headers["x-tenant-id"] === "hub-tenant"
      )
    ).toBe(true);
    expect(
      mocks.fetch.mock.calls.every(
        ([url]) => !url.includes("/connections") && !url.includes("/releases")
      )
    ).toBe(true);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
);
it.each([
  null,
  { role: "agent", activeClientId: "client-a", activeProjectKey: "project-a" },
  { role: "admin", activeClientId: "foreign", activeProjectKey: "project-a" },
  { role: "admin", activeClientId: "client-a" }
])("rejects unauthorized sessions before Hub access", async (user) => {
  mocks.user.mockResolvedValue(user);
  expect((await remove()).status).toBeGreaterThanOrEqual(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("rejects stale scopes, cross-origin requests and client-supplied binding targets", async () => {
  expect((await remove("zendesk", { ...scope, projectKey: "other" })).status).toBe(409);
  expect((await remove("zendesk", { ...scope, clientId: "other" })).status).toBe(409);
  expect((await remove("zendesk", scope, "https://other.test")).status).toBe(403);
  expect((await remove("zendesk", { ...scope, bindingId: "other" })).status).toBe(400);
  expect((await remove("../connections/revoke")).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("does not need an enabled binding for idempotent removal", async () => {
  saved = [];
  expect((await remove()).status).toBe(200);
  saved = [{ ...binding, enabled: false }];
  expect((await remove()).status).toBe(200);
  expect(mocks.fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(
    true
  );
});
it("requires the server-side admin key and never substitutes the execution key", async () => {
  vi.stubEnv("CONNECTION_HUB_ADMIN_API_KEY", "");
  expect((await remove()).status).toBe(503);
  expect(mocks.fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(
    true
  );
});
it("uses production Hub settings and management key without local fallback", async () => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  vi.stubEnv("CONNECTION_HUB_PROD_URL", "https://production.test");
  vi.stubEnv("CONNECTION_HUB_PROD_API_KEY", "production-execution-key");
  vi.stubEnv("CONNECTION_HUB_PROD_ADMIN_API_KEY", "production-management-key");
  vi.stubEnv("CONNECTION_HUB_PROD_TENANT_ID", "hub-tenant");
  expect((await remove()).status).toBe(200);
  expect(
    mocks.fetch.mock.calls.every(([url]) => url.startsWith("https://production.test/"))
  ).toBe(true);
  expect(
    mocks.fetch.mock.calls
      .filter(([, options]) => options.method === "POST")
      .every(
        ([, options]) =>
          options.headers.authorization === "Bearer production-management-key"
      )
  ).toBe(true);
});
it("fails on concurrent or partial changes and permits retry", async () => {
  const original = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation((url, options) =>
    url.endsWith("/bindings/another-action")
      ? new Response(null, { status: 409 })
      : original(url, options)
  );
  expect((await remove()).status).toBe(409);
  expect(saved[0].enabled).toBe(false);
  expect(saved[1].enabled).toBe(true);
  mocks.fetch.mockImplementation(original);
  expect((await remove()).status).toBe(200);
  expect(saved.slice(0, 2).every((item) => !item.enabled)).toBe(true);
});
it("verifies disabled state rather than trusting successful update responses", async () => {
  const original = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation((url, options) =>
    options.method === "POST"
      ? Response.json({ id: "acknowledged" })
      : original(url, options)
  );
  expect((await remove()).status).toBe(409);
});
it("validates every enabled binding before mutating anything", async () => {
  saved[1].revision = 0;
  expect((await remove()).status).toBe(502);
  expect(mocks.fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(
    true
  );
});
it("keeps upstream errors and secrets out of responses and logs", async () => {
  mocks.fetch.mockRejectedValue(new Error("private-upstream-token"));
  const response = await remove();
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-upstream-token");
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("private-upstream-token");
});
it("rejects unrecognized application metadata and malformed state", async () => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({ applicationId: "other", bindings: [] })
  );
  await expect(connectionHubManagement.remove("zendesk", scope)).rejects.toThrow(
    "Unable to read"
  );
  mocks.fetch.mockResolvedValueOnce(
    Response.json({
      applicationId: "connection-hub",
      bindings: [{ ...binding, enabled: "yes" }]
    })
  );
  expect((await remove()).status).toBe(502);
});
