import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ project: vi.fn(), execute: vi.fn(), api: vi.fn() }));
vi.mock("@csa/connection-hub", async (original) => ({
  ...(await original<typeof import("@csa/connection-hub")>()),
  hubRuntime: mocks
}));
import { connectionHubZendesk } from "./connection-hub.js";
const binding = {
  connectorId: "zendesk",
  canonicalAction: "zendesk-read",
  enabled: true,
  connectionId: "account-a",
  providerAccount: "acme"
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.project.mockResolvedValue({ bindings: [binding] });
});
afterEach(() => vi.restoreAllMocks());
const lookup = () =>
  connectionHubZendesk.forProject({ clientId: "client-a", projectKey: "project-a" });
it("uses the enabled Hub read action", async () => {
  mocks.execute.mockResolvedValue({ status: 200, data: { results: [] } });
  const connection = await lookup();
  expect(connection?.subdomain).toBe("acme");
  expect(await connection?.api("search.json")).toEqual({ results: [] });
  expect(mocks.execute).toHaveBeenCalledWith(expect.anything(), binding, {
    path: "search.json"
  });
});
it("uses native tickets when the Hub binding is removed or disabled", async () => {
  mocks.project.mockResolvedValue({ bindings: [{ ...binding, enabled: false }] });
  expect(await lookup()).toBeUndefined();
});
it("requires an enabled Hub action for writes, never direct credentials", async () => {
  const connection = await lookup();
  await expect(connection?.api("tickets.json", "POST", {})).rejects.toMatchObject({
    extensions: { code: "UNSUPPORTED_OPERATION" }
  });
  expect(mocks.api).not.toHaveBeenCalled();
});
it("routes enabled writes through Hub using the same account", async () => {
  const custom = { ...binding, canonicalAction: "zendesk-custom-api-call" };
  mocks.project.mockResolvedValue({ bindings: [binding, custom] });
  mocks.api.mockResolvedValue({ ticket: { id: 42 } });
  const connection = await lookup();
  expect(
    await connection?.api("tickets/42.json", "PUT", { ticket: { status: "solved" } })
  ).toEqual({ ticket: { id: 42 } });
  expect(mocks.api).toHaveBeenCalledWith(
    expect.anything(),
    custom,
    "tickets/42.json",
    "PUT",
    { ticket: { status: "solved" } }
  );
});
it("rejects mixed Hub accounts and upstream outages", async () => {
  mocks.project.mockResolvedValue({
    bindings: [
      binding,
      { ...binding, canonicalAction: "zendesk-custom-api-call", connectionId: "other" }
    ]
  });
  await expect(lookup()).rejects.toThrow("different accounts");
  mocks.project.mockRejectedValue(new Error("Hub unavailable"));
  await expect(lookup()).rejects.toThrow("Hub unavailable");
});
it("maps a missing Zendesk ticket to NOT_FOUND", async () => {
  mocks.execute.mockResolvedValue({ status: 404, data: {} });
  const connection = await lookup();
  await expect(connection?.api("tickets/42.json")).rejects.toMatchObject({
    extensions: { code: "NOT_FOUND" }
  });
});
