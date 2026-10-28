import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assertProjectScope } from "@csa/mongodb";
import { searchZendeskPlugin } from "./plugin.js";
vi.mock("@csa/mongodb", () => ({ assertProjectScope: vi.fn() }));
const fetchMock = vi.fn();
const identity = {
  clientId: "client-a",
  projectKey: "project-a",
  userEmail: "agent@example.test",
  userRole: "agent"
};
const binding = {
  id: "binding-a",
  canonicalAction: "zendesk-find-tickets",
  connectorId: "zendesk",
  tenantId: "client-a",
  projectKey: "project-a",
  connectionId: "conn-a",
  operation: "find-tickets",
  revision: 1,
  releaseId: "release-a",
  allowedIndex: "tickets",
  enabled: true
};
const execution = {
  mode: "live",
  connector: "@rc-connect/zendesk",
  tenantId: "client-a",
  projectKey: "project-a",
  bindingId: "binding-a",
  connectionId: "conn-a",
  action: "find-tickets",
  providerStatus: 200,
  bindingRevision: 1,
  releaseId: "release-a"
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    CONNECTION_HUB_ENABLED: "true",
    CONNECTION_HUB_CLIENT_ID: "client-a",
    CONNECTION_HUB_URL: "http://127.0.0.1:3100",
    CONNECTION_HUB_API_KEY: "synthetic-execution-key",
    CONNECTION_HUB_TENANT_ID: "",
    USE_CONNECTION_HUB_PROD: "false"
  }))
    vi.stubEnv(key, value);
  vi.mocked(assertProjectScope).mockResolvedValue(undefined);
  fetchMock.mockResolvedValueOnce(
    Response.json({ applicationId: "customersax", bindings: [binding] })
  );
  fetchMock.mockResolvedValueOnce(
    Response.json({
      execution,
      data: {
        success: true,
        tickets: [{ id: 42, subject: "Delivery", status: "open", priority: "high" }],
        total_count: 1
      }
    })
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("searches external Zendesk tickets while native ticketing remains selected", async () => {
  expect(await searchZendeskPlugin(identity, "status:open")).toEqual({
    results: [{ id: "42", subject: "Delivery", status: "open", priority: "high" }],
    count: 1,
    total: 1
  });
  expect(assertProjectScope).toHaveBeenCalledWith({
    clientId: "client-a",
    projectKey: "project-a"
  });
  expect(fetchMock.mock.calls[1][0]).toContain("/project-a/actions/zendesk-find-tickets");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    search_type: "custom",
    custom_query: "type:ticket status:open"
  });
});
it("requires authenticated identity and validates limits before network access", async () => {
  await expect(
    searchZendeskPlugin({ ...identity, userRole: "viewer" }, "open")
  ).rejects.toThrow("authenticated");
  await expect(
    searchZendeskPlugin({ ...identity, clientId: undefined }, "open")
  ).rejects.toThrow("authenticated");
  await expect(searchZendeskPlugin(identity, "open", 100)).rejects.toThrow("limit");
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([
  { ...binding, enabled: false },
  { ...binding, tenantId: "other" },
  { ...binding, projectKey: "other" },
  { ...binding, canonicalAction: "zendesk-read" }
])("rejects unavailable and incorrectly scoped bindings", async (invalid) => {
  fetchMock
    .mockReset()
    .mockResolvedValue(
      Response.json({ applicationId: "customersax", bindings: [invalid] })
    );
  await expect(searchZendeskPlugin(identity, "open")).rejects.toThrow(
    "Connect the Zendesk"
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each([
  { mode: "demo" },
  { connectionId: "other" },
  { tenantId: "other" },
  { bindingId: "other" },
  { projectKey: "other" },
  { action: "create-ticket" },
  { providerStatus: 403 }
])("rejects untrusted execution metadata", async (changes) => {
  fetchMock
    .mockReset()
    .mockResolvedValueOnce(
      Response.json({ applicationId: "customersax", bindings: [binding] })
    )
    .mockResolvedValueOnce(
      Response.json({
        execution: { ...execution, ...changes },
        data: { success: true, tickets: [] }
      })
    );
  await expect(searchZendeskPlugin(identity, "open")).rejects.toThrow(
    "Connect the Zendesk"
  );
});
it("does not contact Hub when project ownership cannot be verified", async () => {
  vi.mocked(assertProjectScope).mockRejectedValueOnce(new Error("not authorized"));
  await expect(searchZendeskPlugin(identity, "open")).rejects.toThrow("not authorized");
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["CSA Agent", "CSA Administrator", "CSA Super Administrator"])(
  "accepts the authenticated AI Assist role label %s",
  async (userRole) => {
    expect(
      await searchZendeskPlugin({ ...identity, userRole }, "status:open")
    ).toMatchObject({ count: 1 });
  }
);
