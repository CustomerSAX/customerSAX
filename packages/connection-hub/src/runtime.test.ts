import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hubRuntime, platformConfiguration } from "./runtime.js";
const fetchMock = vi.fn();
const binding = {
  id: "binding-a",
  tenantId: "tenant-a",
  projectKey: "project-a",
  connectorId: "zendesk",
  canonicalAction: "zendesk-custom-api-call",
  operation: "custom_api_call",
  connectionId: "connection-a",
  releaseId: "release-a",
  revision: 3,
  allowedIndex: "tickets",
  enabled: true
};
const config = {
  url: "https://hub.test",
  apiKey: "synthetic-platform-key",
  tenants: { "client-a": "tenant-a" }
};
beforeEach(() => {
  vi.stubEnv("CONNECTION_HUB_PLATFORM_CONFIG", JSON.stringify(config));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const project = () => {
  fetchMock.mockResolvedValueOnce(
    Response.json({
      applicationId: "connection-hub",
      bindings: [
        binding,
        { ...binding, tenantId: "other" },
        { ...binding, projectKey: "other" }
      ]
    })
  );
  return hubRuntime.project("client-a", "project-a");
};
const result = (overrides = {}, status = 200, body: unknown = { ticket: { id: 42 } }) =>
  Response.json({
    data: { status, body },
    execution: {
      mode: "live",
      tenantId: "tenant-a",
      projectKey: "project-a",
      connector: "@rc-connect/zendesk",
      bindingId: "binding-a",
      bindingRevision: 3,
      connectionId: "connection-a",
      releaseId: "release-a",
      action: "custom_api_call",
      providerStatus: status,
      ...overrides
    }
  });
it("resolves centrally registered clients without any per-service Hub variables", () => {
  vi.stubEnv("CONNECTION_HUB_ENABLED", "false");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "obsolete");
  expect(platformConfiguration("client-a")).toMatchObject({
    url: config.url,
    tenantId: "tenant-a",
    clientId: "client-a"
  });
  expect(() => platformConfiguration("foreign-client")).toThrow("not registered");
});
it("fails closed when production registration is missing or malformed", () => {
  vi.stubEnv("CONNECTION_HUB_PLATFORM_CONFIG", "");
  vi.stubEnv("CONNECTION_HUB_ENABLED", "false");
  expect(() => platformConfiguration("client-a")).toThrow("not been provisioned");
  vi.stubEnv("CONNECTION_HUB_PLATFORM_CONFIG", "{bad");
  expect(() => platformConfiguration("client-a")).toThrow("Invalid");
});
it.each([
  "http://hub.test",
  "https://user:secret@hub.test",
  "https://hub.test/route",
  "https://hub.test/?key=bad"
])("rejects unsafe platform origins %s", (url) => {
  vi.stubEnv("CONNECTION_HUB_PLATFORM_CONFIG", JSON.stringify({ ...config, url }));
  expect(() => platformConfiguration("client-a")).toThrow("Invalid");
});
it("only returns this tenant/project's bindings and never supplies provider credentials", async () => {
  const scope = await project();
  expect(scope?.bindings).toEqual([binding]);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://hub.test/v1/projects/project-a/bindings",
    expect.objectContaining({
      headers: {
        authorization: "Bearer synthetic-platform-key",
        "x-tenant-id": "tenant-a"
      }
    })
  );
});
it("executes Hub writes and returns provider data after checking execution provenance", async () => {
  const scope = (await project())!;
  fetchMock.mockResolvedValueOnce(result({}, 201));
  expect(
    await hubRuntime.api(scope, scope.bindings[0], "tickets.json", "POST", {
      ticket: { subject: "Example" }
    })
  ).toEqual({ ticket: { id: 42 } });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    method: "POST",
    body_type: "json",
    body: { data: { ticket: { subject: "Example" } } },
    failsafe: false
  });
});
it.each([
  { tenantId: "foreign" },
  { projectKey: "foreign" },
  { mode: "demo" },
  { connector: "other" },
  { bindingId: "other" },
  { connectionId: "other" },
  { bindingRevision: 4 },
  { releaseId: "other" },
  { action: "other" }
])("rejects execution scope or revision changes %j", async (changes) => {
  const scope = (await project())!;
  fetchMock.mockResolvedValueOnce(result(changes));
  await expect(hubRuntime.api(scope, scope.bindings[0], "tickets.json")).rejects.toThrow(
    "did not match"
  );
});
it("never executes a disabled or unrelated binding", async () => {
  const scope = (await project())!;
  await expect(
    hubRuntime.execute(scope, { ...binding, enabled: false }, {})
  ).rejects.toThrow("Enable");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("maps missing resources and provider permission errors without fallback", async () => {
  const scope = (await project())!;
  fetchMock.mockResolvedValueOnce(result({}, 404));
  expect(await hubRuntime.api(scope, scope.bindings[0], "tickets/999.json")).toBeNull();
  fetchMock.mockResolvedValueOnce(result({}, 403));
  await expect(hubRuntime.api(scope, scope.bindings[0], "tickets.json")).rejects.toThrow(
    "HTTP 403"
  );
});
it("rejects requests to arbitrary accounts and Hub outages", async () => {
  const scope = (await project())!;
  for (const path of ["https://evil.test", "//evil.test", "../oauth/tokens"])
    await expect(hubRuntime.api(scope, scope.bindings[0], path)).rejects.toThrow(
      "Invalid"
    );
  fetchMock.mockRejectedValueOnce(new Error("sensitive-upstream-detail"));
  await expect(hubRuntime.api(scope, scope.bindings[0], "tickets.json")).rejects.toThrow(
    "unavailable"
  );
});
