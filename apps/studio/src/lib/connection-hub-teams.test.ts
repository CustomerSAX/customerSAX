import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  session: vi.fn(),
  fetch: vi.fn(),
  log: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("../app/api/auth/shared", () => ({
  currentSessionToken: mocks.token,
  getValidatedSession: mocks.session
}));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "teams-request", log: { error: mocks.log } })
}));
import { connectionHubTeams } from "./connection-hub-teams";
import { POST } from "../app/api/connection-hub/teams/route";

const binding = {
  id: "binding-teams",
  connectionId: "conn-teams",
  connectorId: "microsoft-teams",
  canonicalAction: "teams-read",
  tenantId: "client-a",
  projectKey: "b2c-csa",
  enabled: true
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "private-server-api-key");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "client-a");
  mocks.token.mockResolvedValue("session-token");
  mocks.session.mockResolvedValue({
    user: { activeClientId: "client-a", activeProjectKey: "b2c-csa" }
  });
  mocks.fetch.mockImplementation(async (url: string) =>
    url.endsWith("/bindings")
      ? Response.json({ applicationId: "customersax", bindings: [binding] })
      : result()
  );
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function result(
  changes = {},
  data: unknown = { value: [{ id: "channel-1", displayName: "Test channel" }] }
) {
  return Response.json({
    data,
    execution: {
      mode: "live",
      connector: "@rc-connect/microsoft-teams",
      tenantId: "client-a",
      projectKey: "b2c-csa",
      bindingId: "binding-teams",
      connectionId: "conn-teams",
      providerStatus: 200,
      ...changes
    }
  });
}
function request(body: unknown) {
  return new NextRequest("http://studio.test/api/connection-hub/teams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
it("uses the signed-in project and sends only the Teams operation to Hub", async () => {
  const response = await POST(request({ operation: "channels" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    data: { value: [{ id: "channel-1" }] }
  });
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/projects/b2c-csa/actions/teams-read",
    expect.objectContaining({
      body: JSON.stringify({ operation: "channels" }),
      headers: expect.objectContaining({ "x-tenant-id": "client-a" })
    })
  );
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("requires a session and never accepts another client", async () => {
  mocks.token.mockResolvedValueOnce(undefined);
  expect((await POST(request({ operation: "channels" }))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.session.mockResolvedValueOnce({
    user: { activeClientId: "client-b", activeProjectKey: "b2c-csa" }
  });
  expect((await POST(request({ operation: "channels" }))).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("rejects caller-selected teams, connectors, arbitrary URLs and message writes", () => {
  for (const body of [
    { operation: "channels", teamId: "other" },
    { operation: "channels", connectorId: "algolia" },
    { operation: "messages", channelId: "../users" },
    { operation: "messages", channelId: "channel-1", limit: 51 },
    { operation: "send", channelId: "channel-1", message: "Do not send" },
    { operation: "channels", path: "https://evil.test" }
  ])
    expect(() => connectionHubTeams.parseInput(body)).toThrow();
  expect(
    connectionHubTeams.parseInput({
      operation: "messages",
      channelId: "19:test@thread.tacv2"
    })
  ).toEqual({ operation: "messages", channelId: "19:test@thread.tacv2", limit: 20 });
});
it("fails closed for disabled, cross-project or missing bindings", async () => {
  for (const bindings of [
    [],
    [{ ...binding, enabled: false }],
    [{ ...binding, projectKey: "other" }]
  ]) {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ applicationId: "customersax", bindings })
    );
    expect((await POST(request({ operation: "channels" }))).status).toBe(403);
  }
});
it("does not accept demo data, incorrect execution scopes or malformed provider payloads", async () => {
  for (const change of [
    { mode: "demo" },
    { projectKey: "other" },
    { tenantId: "other" },
    { connector: "@rc-connect/algolia" },
    { bindingId: "other" },
    { connectionId: "other" }
  ]) {
    mocks.fetch
      .mockResolvedValueOnce(
        Response.json({ applicationId: "customersax", bindings: [binding] })
      )
      .mockResolvedValueOnce(result(change));
    expect((await POST(request({ operation: "channels" }))).status).toBe(502);
  }
  mocks.fetch
    .mockResolvedValueOnce(
      Response.json({ applicationId: "customersax", bindings: [binding] })
    )
    .mockResolvedValueOnce(result({}, { value: "bad-data" }));
  expect((await POST(request({ operation: "channels" }))).status).toBe(502);
});
it("reports provider failures without echoing secrets and supports single message responses", async () => {
  mocks.fetch
    .mockResolvedValueOnce(
      Response.json({ applicationId: "customersax", bindings: [binding] })
    )
    .mockResolvedValueOnce(result({ providerStatus: 403 }, {}));
  const failed = await POST(request({ operation: "channels" }));
  expect(failed.status).toBe(502);
  expect(JSON.stringify(await failed.json())).not.toContain("private-server-api-key");
  mocks.fetch
    .mockResolvedValueOnce(
      Response.json({ applicationId: "customersax", bindings: [binding] })
    )
    .mockResolvedValueOnce(result({}, { id: "123", body: { content: "Test message" } }));
  expect(
    (
      await POST(
        request({ operation: "message", channelId: "channel-1", messageId: "123" })
      )
    ).status
  ).toBe(200);
});
it("uses a new binding lookup after a project switch", async () => {
  mocks.session.mockResolvedValueOnce({
    user: { activeClientId: "client-a", activeProjectKey: "project-b" }
  });
  mocks.fetch
    .mockResolvedValueOnce(
      Response.json({
        applicationId: "customersax",
        bindings: [{ ...binding, projectKey: "project-b" }]
      })
    )
    .mockResolvedValueOnce(result({ projectKey: "project-b" }));
  expect((await POST(request({ operation: "channels" }))).status).toBe(200);
  expect(mocks.fetch).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/projects/project-b/actions/teams-read",
    expect.anything()
  );
});
