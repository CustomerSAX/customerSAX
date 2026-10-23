import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { connectionHubZendesk } from "./connection-hub.js";

const request = vi.fn();
const binding = {
  id: "binding-a",
  connectorId: "zendesk",
  canonicalAction: "zendesk-read",
  projectKey: "b2c-csa",
  tenantId: "client-a",
  connectionId: "conn-a",
  enabled: true,
  providerAccount: "acme"
};
beforeEach(() => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "false");
  vi.stubEnv("CONNECTION_HUB_TENANT_ID", "");
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "execution-key-for-tests");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "client-a");
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function lookup(bindings: unknown[] = [binding]) {
  request.mockResolvedValueOnce(
    Response.json({ applicationId: "customersax", bindings })
  );
  return connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "b2c-csa" });
}
function result(overrides = {}, data: unknown = { results: [] }) {
  return Response.json({
    data,
    execution: {
      mode: "live",
      connector: "@rc-connect/zendesk",
      tenantId: "client-a",
      projectKey: "b2c-csa",
      connectionId: "conn-a",
      bindingId: "binding-a",
      providerStatus: 200,
      ...overrides
    }
  });
}
it("routes Zendesk reads through a scoped binding without sending provider credentials", async () => {
  const connection = await lookup();
  request.mockResolvedValueOnce(result({}, { results: [{ id: 1 }], count: 1 }));
  expect(await connection?.api("search.json?query=type%3Aticket")).toEqual({
    results: [{ id: 1 }],
    count: 1
  });
  expect(request).toHaveBeenLastCalledWith(
    "http://127.0.0.1:3100/v1/projects/b2c-csa/actions/zendesk-read",
    expect.objectContaining({
      body: JSON.stringify({ path: "search.json?query=type%3Aticket" }),
      headers: expect.objectContaining({ "x-tenant-id": "client-a" })
    })
  );
  expect(connection?.subdomain).toBe("acme");
});
it("preserves unbound project behavior and never reuses another tenant binding", async () => {
  expect(
    await connectionHubZendesk.forProject({ clientId: "other", projectKey: "b2c-csa" })
  ).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
  expect(await lookup([])).toBeUndefined();
  expect(await lookup([{ ...binding, projectKey: "other" }])).toBeUndefined();
});
it("fails closed on disabled bindings and lookup outages", async () => {
  await expect(lookup([{ ...binding, enabled: false }])).rejects.toThrow("unavailable");
  request.mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(
    connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "b2c-csa" })
  ).rejects.toThrow("unavailable");
});
it("rejects forged execution scope, demo responses and malformed data", async () => {
  const connection = await lookup();
  if (!connection) throw new Error("Missing test connection");
  for (const changes of [
    { tenantId: "other" },
    { projectKey: "other" },
    { connectionId: "other" },
    { bindingId: "other" },
    { mode: "demo" },
    { connector: "@rc-connect/algolia" }
  ]) {
    request.mockResolvedValueOnce(result(changes));
    await expect(connection.api("tickets.json")).rejects.toThrow("unavailable");
  }
  request.mockResolvedValueOnce(result({}, []));
  await expect(connection.api("tickets.json")).rejects.toThrow("unavailable");
});
it("maps missing tickets and rejects writes in the read-only POC", async () => {
  const connection = await lookup();
  if (!connection) throw new Error("Missing test connection");
  request.mockResolvedValueOnce(result({ providerStatus: 404 }, {}));
  await expect(connection.api("tickets/999.json")).rejects.toMatchObject({
    extensions: { code: "NOT_FOUND" }
  });
  await expect(
    connection.api("tickets.json", "POST", { ticket: {} })
  ).rejects.toMatchObject({ extensions: { code: "UNSUPPORTED_OPERATION" } });
});
it("rejects URLs containing credentials or a path", async () => {
  vi.stubEnv("CONNECTION_HUB_URL", "http://user:secret@127.0.0.1:3100");
  await expect(
    connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "b2c-csa" })
  ).rejects.toThrow("unavailable");
  expect(request).not.toHaveBeenCalled();
});

it("uses production Hub settings and mapped tenant for the existing Tickets adapter", async () => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  vi.stubEnv("CONNECTION_HUB_PROD_URL", "https://hub.example.test");
  vi.stubEnv("CONNECTION_HUB_PROD_API_KEY", "production-execution-key");
  vi.stubEnv("CONNECTION_HUB_PROD_TENANT_ID", "hub-tenant");
  request.mockResolvedValueOnce(Response.json({ applicationId: "connection-hub", bindings: [{ ...binding, tenantId: "hub-tenant" }] }));
  const connection = await connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "b2c-csa" });
  expect(request).toHaveBeenLastCalledWith("https://hub.example.test/v1/projects/b2c-csa/bindings", expect.objectContaining({ headers: { authorization: "Bearer production-execution-key", "x-tenant-id": "hub-tenant" } }));
  request.mockResolvedValueOnce(result({ tenantId: "hub-tenant" }, { tickets: [] }));
  expect(await connection?.api("tickets.json")).toEqual({ tickets: [] });
  expect(request.mock.calls[1][0]).toBe("https://hub.example.test/v1/projects/b2c-csa/actions/zendesk-read");
});
it("rejects invalid production mode and insecure production URLs", async () => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "invalid");
  await expect(connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "b2c-csa" })).rejects.toThrow("unavailable");
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  vi.stubEnv("CONNECTION_HUB_PROD_URL", "http://localhost:3100");
  vi.stubEnv("CONNECTION_HUB_PROD_API_KEY", "production-execution-key");
  await expect(connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "b2c-csa" })).rejects.toThrow("unavailable");
  expect(request).not.toHaveBeenCalled();
});
