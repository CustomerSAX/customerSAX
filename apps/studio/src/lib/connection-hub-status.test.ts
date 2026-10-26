import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn(), log: vi.fn() }));
vi.mock("./get-current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "test", log: { error: mocks.log } })
}));
vi.mock("./connection-hub-transport", () => ({
  connectionHubTransport: {
    getConfig: () => ({
      url: "https://hub.test",
      clientId: "client-a",
      tenantId: "hub-tenant"
    }),
    headers: async () => ({ authorization: "Bearer synthetic-execution-key" })
  }
}));
import { GET } from "../app/api/connection-hub/status/route";
const binding = {
  tenantId: "hub-tenant",
  projectKey: "project-a",
  connectorId: "zendesk",
  operation: "find-tickets",
  enabled: true
};
const request = () =>
  new NextRequest("http://studio.test/api/connection-hub/status?projectKey=untrusted");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-a"
  });
  mocks.fetch.mockResolvedValue(
    Response.json({ applicationId: "connection-hub", bindings: [binding] })
  );
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("returns enabled and disabled actions only for the authenticated project, without credential metadata", async () => {
  mocks.fetch.mockResolvedValue(
    Response.json({
      applicationId: "connection-hub",
      bindings: [
        { ...binding, secret: "never-expose", connectionId: "private-id" },
        { ...binding, operation: "create-ticket", enabled: false },
        { ...binding, tenantId: "foreign" },
        { ...binding, projectKey: "foreign" }
      ]
    })
  );
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    clientId: "client-a",
    projectKey: "project-a",
    bindings: [
      { connectorId: "zendesk", operation: "find-tickets", enabled: true },
      { connectorId: "zendesk", operation: "create-ticket", enabled: false }
    ]
  });
  expect(mocks.fetch.mock.calls[0][0]).toBe(
    "https://hub.test/v1/projects/project-a/bindings"
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each([
  null,
  { role: "agent", activeClientId: "client-a", activeProjectKey: "project-a" },
  { role: "admin", activeClientId: "foreign", activeProjectKey: "project-a" },
  { role: "admin", activeClientId: "client-a" }
])("requires administrator access and valid project scope", async (user) => {
  mocks.user.mockResolvedValue(user);
  expect((await GET(request())).status).toBeGreaterThanOrEqual(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("distinguishes an empty configured project from a status lookup failure", async () => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({ applicationId: "customersax", bindings: [] })
  );
  expect((await (await GET(request())).json()).bindings).toEqual([]);
  mocks.fetch.mockRejectedValueOnce(new Error("private-provider-detail"));
  const response = await GET(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-provider-detail");
});
it("rejects malformed metadata instead of presenting it as disconnected", async () => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({
      applicationId: "customersax",
      bindings: [{ ...binding, enabled: "true" }]
    })
  );
  expect((await GET(request())).status).toBe(502);
});
