import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn(), log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./get-current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "test", log: { error: mocks.log } })
}));
import { zendeskPlugin } from "./zendesk-plugin";
import { POST, DELETE } from "../app/api/connection-hub/zendesk/route";
const binding = {
  id: "binding-a",
  revision: 2,
  tenantId: "client-a",
  projectKey: "project-a",
  connectorId: "zendesk",
  canonicalAction: "zendesk-find-tickets",
  connectionId: "conn-old",
  releaseId: "release-a",
  enabled: true,
  providerAccount: "acme"
};
const input = {
  clientId: "client-a",
  projectKey: "project-a",
  subdomain: "acme",
  accessToken: "synthetic-zendesk-token"
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries({
    CONNECTION_HUB_ENABLED: "true",
    USE_CONNECTION_HUB_PROD: "false",
    CONNECTION_HUB_URL: "http://127.0.0.1:3100",
    CONNECTION_HUB_API_KEY: "synthetic-execution-key",
    CONNECTION_HUB_ADMIN_API_KEY: "synthetic-admin-key",
    CONNECTION_HUB_CLIENT_ID: "client-a",
    CONNECTION_HUB_TENANT_ID: ""
  }))
    vi.stubEnv(name, value);
  mocks.user.mockResolvedValue({
    email: "admin@example.test",
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-a"
  });
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/bindings"))
      return Response.json({ applicationId: "customersax", bindings: [] });
    if (url.endsWith("/releases"))
      return Response.json({
        releases: [
          { id: "release-a", connectorId: "zendesk", version: "1.1.0", enabled: true }
        ]
      });
    if (url.endsWith("/connections"))
      return Response.json({
        id: "conn-new",
        revision: 1,
        connectorId: "zendesk",
        mode: "live",
        enabled: true
      });
    return Response.json({ id: "binding-new" });
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function request(method: string, body: unknown = input, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/connection-hub/zendesk", {
    method,
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
}
it("creates an encrypted Hub connection and only the independent assistant search binding", async () => {
  const result = await zendeskPlugin.connect(input);
  expect(result).toMatchObject({
    connected: true,
    subdomain: "acme",
    projectKey: "project-a"
  });
  expect(JSON.stringify(result)).not.toContain(input.accessToken);
  const calls = mocks.fetch.mock.calls;
  const create = calls.find(([url]) => url.endsWith("/connections"));
  expect(JSON.parse(create![1].body)).toEqual({
    connectorId: "zendesk",
    name: "CSA Assistant: project-a",
    applicationId: "acme",
    apiKey: input.accessToken,
    indexName: "tickets"
  });
  expect(create![1].headers.authorization).toBe("Bearer synthetic-admin-key");
  const target = calls.find(
    ([url, options]) => url.endsWith("/admin/bindings") && options.method === "POST"
  );
  expect(JSON.parse(target![1].body)).toMatchObject({
    projectKey: "project-a",
    canonicalAction: "zendesk-find-tickets",
    operation: "find-tickets",
    connectionId: "conn-new"
  });
  expect(
    calls.every(
      ([url]) =>
        !url.includes("zendesk-read") && !url.includes("/projects/project-a/ticketing")
    )
  ).toBe(true);
});
it("rejects unauthenticated, non-admin, foreign-client and changed-project connection attempts before Hub access", async () => {
  for (const user of [
    null,
    { role: "agent", activeClientId: "client-a", activeProjectKey: "project-a" },
    { role: "admin", activeClientId: "other", activeProjectKey: "project-a" }
  ]) {
    mocks.user.mockResolvedValue(user);
    await expect(zendeskPlugin.connect(input)).rejects.toThrow();
  }
  mocks.user.mockResolvedValue({
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-b"
  });
  await expect(zendeskPlugin.connect(input)).rejects.toThrow("Active project changed");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("requires a server-side management key and approved Zendesk release", async () => {
  vi.stubEnv("CONNECTION_HUB_ADMIN_API_KEY", "");
  await expect(zendeskPlugin.connect(input)).rejects.toThrow("admin key");
  vi.stubEnv("CONNECTION_HUB_ADMIN_API_KEY", "synthetic-admin-key");
  mocks.fetch.mockImplementation(async (url: string) =>
    Response.json(
      url.endsWith("/bindings")
        ? { applicationId: "customersax", bindings: [] }
        : { releases: [] }
    )
  );
  await expect(zendeskPlugin.connect(input)).rejects.toThrow("Approve the Zendesk");
  expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/connections"))).toBe(
    false
  );
});
it("updates only this project's existing search binding using its revision", async () => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({
      applicationId: "customersax",
      bindings: [
        { ...binding, canonicalAction: "zendesk-read", id: "primary-ticketing" },
        binding
      ]
    })
  );
  await zendeskPlugin.connect(input);
  const update = mocks.fetch.mock.calls.find(([url]) =>
    url.endsWith("/admin/bindings/binding-a")
  );
  expect(JSON.parse(update![1].body)).toMatchObject({
    expectedRevision: 2,
    connectionId: "conn-new"
  });
  expect(mocks.fetch.mock.calls.some(([url]) => url.includes("primary-ticketing"))).toBe(
    false
  );
});
it("disconnects only the assistant binding without revoking a shared account", async () => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({ applicationId: "customersax", bindings: [binding] })
  );
  const response = await DELETE(
    request("DELETE", { clientId: "client-a", projectKey: "project-a" })
  );
  expect(response.status).toBe(200);
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toMatchObject({
    enabled: false,
    expectedRevision: 2,
    connectionId: "conn-old"
  });
  expect(mocks.fetch.mock.calls.some(([url]) => url.includes("/revoke"))).toBe(false);
});
it("blocks cross-origin mutations and keeps upstream secrets out of errors and logs", async () => {
  expect((await POST(request("POST", input, "https://other.test"))).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.fetch.mockRejectedValue(new Error(input.accessToken));
  const response = await POST(request("POST"));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain(input.accessToken);
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(input.accessToken);
});
it("reports only the current tenant/project binding", async () => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({
      applicationId: "customersax",
      bindings: [
        { ...binding, tenantId: "other" },
        { ...binding, projectKey: "other" }
      ]
    })
  );
  expect(await zendeskPlugin.status()).toMatchObject({ connected: false });
});
