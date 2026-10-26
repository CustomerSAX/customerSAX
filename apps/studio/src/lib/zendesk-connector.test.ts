import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn(), log: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./get-current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "test", log: { error: mocks.log } })
}));
import { zendeskConnector } from "./zendesk-connector";
import { GET, POST, DELETE } from "../app/api/connection-hub/zendesk/connector/route";

const binding = {
  id: "tickets",
  revision: 2,
  tenantId: "client-a",
  projectKey: "project-a",
  connectorId: "zendesk",
  canonicalAction: "zendesk-read",
  operation: "rc_zendesk_read",
  connectionId: "conn-old",
  releaseId: "release-old",
  allowedIndex: "tickets",
  providerAccount: "acme",
  enabled: true
};
const input = {
  clientId: "client-a",
  projectKey: "project-a",
  subdomain: "acme",
  accessToken: "synthetic-provider-secret"
};
const scope = { clientId: input.clientId, projectKey: input.projectKey };
let saved: (typeof binding)[];
const request = (method = "GET", body: unknown = input, origin = "http://studio.test") =>
  new NextRequest("http://studio.test/api/connection-hub/zendesk/connector", {
    method,
    headers: { "content-type": "application/json", origin },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) })
  });
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    CONNECTION_HUB_ENABLED: "true",
    USE_CONNECTION_HUB_PROD: "false",
    CONNECTION_HUB_URL: "http://127.0.0.1:3100",
    CONNECTION_HUB_API_KEY: "synthetic-execution-key",
    CONNECTION_HUB_ADMIN_API_KEY: "synthetic-admin-key",
    CONNECTION_HUB_CLIENT_ID: "client-a",
    CONNECTION_HUB_TENANT_ID: ""
  }))
    vi.stubEnv(key, value);
  mocks.user.mockResolvedValue({
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-a"
  });
  saved = [
    { ...binding },
    {
      ...binding,
      id: "assistant",
      canonicalAction: "zendesk-find-tickets",
      operation: "find-tickets",
      releaseId: "release-other"
    },
    {
      ...binding,
      id: "write",
      canonicalAction: "zendesk-create-ticket",
      operation: "create-ticket",
      enabled: false
    },
    { ...binding, id: "foreign-project", projectKey: "other" },
    { ...binding, id: "foreign-tenant", tenantId: "other" }
  ];
  mocks.fetch.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith("/projects/project-a/bindings"))
      return Response.json({ applicationId: "connection-hub", bindings: saved });
    if (url.endsWith("/releases"))
      return Response.json({
        releases: [
          { id: "release-new", version: "1.1.0", enabled: true, connectorId: "zendesk" }
        ]
      });
    if (url.endsWith("/connections"))
      return Response.json({
        id: "conn-new",
        connectorId: "zendesk",
        mode: "live",
        enabled: true
      });
    const body = JSON.parse(String(options.body));
    if (url.endsWith("/admin/bindings")) {
      const created = {
        ...binding,
        ...body,
        id: `created-${body.canonicalAction}`,
        revision: 1
      };
      saved.push(created);
      return Response.json(created);
    }
    const target = saved.find((item) => url.endsWith(`/bindings/${item.id}`));
    if (!target) throw new Error("Unexpected Hub request");
    if (target.revision !== body.expectedRevision)
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

it("replaces credentials for Tickets and Assistant, preserves disabled actions and releases, and leaves other scopes untouched", async () => {
  expect((await POST(request("POST"))).status).toBe(200);
  expect(
    saved.slice(0, 3).map((item) => [item.connectionId, item.enabled, item.releaseId])
  ).toEqual([
    ["conn-new", true, "release-old"],
    ["conn-new", true, "release-other"],
    ["conn-new", false, "release-old"]
  ]);
  expect(
    saved.slice(3).every((item) => item.connectionId === "conn-old" && item.enabled)
  ).toBe(true);
  const calls = mocks.fetch.mock.calls;
  const create = calls.find(([url]) => url.endsWith("/connections"));
  expect(JSON.parse(create![1].body)).toMatchObject({
    applicationId: "acme",
    apiKey: input.accessToken
  });
  expect(create![1].headers.authorization).toBe("Bearer synthetic-admin-key");
  expect(
    calls.some(([url]) => url.includes("/revoke") || url.includes("/releases/approve"))
  ).toBe(false);
  expect(
    calls
      .filter(([url]) => url.includes("/admin/bindings/"))
      .map(([, options]) => JSON.parse(options.body).expectedRevision)
  ).toEqual([2, 2, 2]);
});
it("removes all enabled Zendesk actions in this project without revoking shared credentials", async () => {
  saved[2].enabled = true;
  const response = await DELETE(request("DELETE", scope));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ connected: false, enabledActions: 0 });
  expect(saved.slice(0, 3).every((item) => !item.enabled)).toBe(true);
  expect(saved.slice(3).every((item) => item.enabled)).toBe(true);
  expect(mocks.fetch.mock.calls.some(([url]) => url.includes("/connections"))).toBe(
    false
  );
  mocks.fetch.mockClear();
  await zendeskConnector.disconnect(scope);
  expect(mocks.fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(
    true
  );
});
it("reconnects removed read bindings without re-enabling write actions", async () => {
  saved.slice(0, 3).forEach((item) => {
    item.enabled = false;
  });
  await zendeskConnector.connect(input);
  expect(saved.slice(0, 3).map((item) => item.enabled)).toEqual([true, true, false]);
});
it("creates only the two read bindings for a new connection", async () => {
  saved = [];
  const result = await zendeskConnector.connect(input);
  expect(result).toMatchObject({ connected: true, enabledActions: 2, incomplete: false });
  expect(saved.map((item) => item.canonicalAction)).toEqual([
    "zendesk-read",
    "zendesk-find-tickets"
  ]);
  expect(saved.every((item) => item.releaseId === "release-new")).toBe(true);
});
it("preserves an assistant-only selection when rotating credentials", async () => {
  saved = [saved[1]];
  await zendeskConnector.connect(input);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    connectionId: "conn-new",
    canonicalAction: "zendesk-find-tickets"
  });
});
it.each([
  null,
  { role: "agent", activeClientId: "client-a", activeProjectKey: "project-a" },
  { role: "admin", activeClientId: "other", activeProjectKey: "project-a" }
])(
  "requires an administrator in the configured client for every operation",
  async (user) => {
    mocks.user.mockResolvedValue(user);
    expect((await GET(request())).status).toBeGreaterThanOrEqual(400);
    expect((await POST(request("POST"))).status).toBeGreaterThanOrEqual(400);
    expect((await DELETE(request("DELETE", scope))).status).toBeGreaterThanOrEqual(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  }
);
it("rejects stale project and cross-origin mutations before Hub access", async () => {
  expect((await POST(request("POST", { ...input, projectKey: "other" }))).status).toBe(
    409
  );
  expect((await DELETE(request("DELETE", { ...scope, clientId: "other" }))).status).toBe(
    409
  );
  expect((await POST(request("POST", input, "https://evil.test"))).status).toBe(403);
  expect((await DELETE(request("DELETE", scope, "https://evil.test"))).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("rejects account changes and invalid credentials without modifying bindings", async () => {
  await expect(
    zendeskConnector.connect({ ...input, subdomain: "another" })
  ).rejects.toThrow("same Zendesk account");
  await expect(zendeskConnector.connect({ ...input, accessToken: " " })).rejects.toThrow(
    "OAuth access token"
  );
  expect(mocks.fetch.mock.calls.some(([, options]) => options.method === "POST")).toBe(
    false
  );
});
it("requires an approved release before sending a new project's credential", async () => {
  saved = [];
  const original = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation((url, options) =>
    url.endsWith("/releases") ? Response.json({ releases: [] }) : original(url, options)
  );
  await expect(zendeskConnector.connect(input)).rejects.toThrow("Approve the Zendesk");
  expect(mocks.fetch.mock.calls.some(([url]) => url.endsWith("/connections"))).toBe(
    false
  );
});
it("reports partial updates and allows retry without exposing credentials", async () => {
  const original = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation((url, options) =>
    url.endsWith("/bindings/assistant")
      ? new Response(null, { status: 409 })
      : original(url, options)
  );
  const response = await POST(request("POST"));
  expect(response.status).toBe(409);
  expect(saved[0].connectionId).toBe("conn-new");
  expect(saved[1].connectionId).toBe("conn-old");
  expect(await zendeskConnector.status()).toMatchObject({ incomplete: true });
  mocks.fetch.mockImplementation(original);
  expect(await zendeskConnector.connect(input)).toMatchObject({ incomplete: false });
});
it("does not report removal success if an action could not be disabled", async () => {
  const original = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation((url, options) =>
    url.endsWith("/bindings/assistant")
      ? new Response(null, { status: 409 })
      : original(url, options)
  );
  expect((await DELETE(request("DELETE", scope))).status).toBe(409);
  expect(saved[0].enabled).toBe(false);
  expect(saved[1].enabled).toBe(true);
  mocks.fetch.mockImplementation(original);
  expect(await zendeskConnector.disconnect(scope)).toMatchObject({ connected: false });
});
it("validates credentials before replacing any project action and sanitizes upstream errors", async () => {
  const original = mocks.fetch.getMockImplementation()!;
  mocks.fetch.mockImplementation((url, options) =>
    url.endsWith("/connections")
      ? new Response(input.accessToken, { status: 422 })
      : original(url, options)
  );
  const response = await POST(request("POST"));
  expect(response.status).toBe(422);
  expect(await response.text()).not.toContain(input.accessToken);
  expect(saved.every((item) => item.connectionId === "conn-old")).toBe(true);
  mocks.fetch.mockRejectedValue(new Error(input.accessToken));
  expect(await (await POST(request("POST"))).text()).not.toContain(input.accessToken);
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(input.accessToken);
});
it("returns only scoped status metadata, including disabled connections, without credentials", async () => {
  saved.slice(0, 3).forEach((item) => {
    item.enabled = false;
  });
  const response = await GET(request());
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    ok: true,
    clientId: "client-a",
    projectKey: "project-a",
    connected: false,
    enabledActions: 0,
    subdomain: "acme",
    incomplete: false
  });
});
it("rejects malformed or duplicate binding metadata without mutating anything", async () => {
  saved.push({ ...saved[0] });
  expect((await POST(request("POST"))).status).toBe(502);
  expect(mocks.fetch.mock.calls.some(([, options]) => options.method === "POST")).toBe(
    false
  );
});
