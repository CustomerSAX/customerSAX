import { afterEach, expect, it, vi } from "vitest";
import { loadAIStatus } from "./loader.js";
import type { Ticket } from "../tickets/types.js";
const ticket = (id: string) => ({ id, status: "Open" }) as Ticket;
const context = () => ({ clientId: "client-a", projectKey: "project-a", userEmail: "agent@example.com", userRole: "agent" });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("batches row requests with trusted identity and never triggers analysis", async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ statuses: [{ id: "1", status: "not_analyzed" }, { id: "2", status: "awaiting_approval" }] }));
  vi.stubGlobal("fetch", request);
  const identity = context();
  expect(await Promise.all([loadAIStatus(ticket("1"), identity), loadAIStatus(ticket("2"), identity)])).toEqual(["not_analyzed", "awaiting_approval"]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toContain("/ticket-review/statuses");
  expect(request.mock.calls[0][1].headers).toMatchObject({ "x-csa-client-id": "client-a", "x-csa-project-key": "project-a" });
});
it("isolates request contexts and reports service failure honestly", async () => {
  const request = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", request);
  expect(await Promise.all([loadAIStatus(ticket("1"), context()), loadAIStatus(ticket("2"), { ...context(), clientId: "client-b" })])).toEqual(["unavailable", "unavailable"]);
  expect(request).toHaveBeenCalledTimes(2);
});
it("does not query unsupported providers or missing identity", async () => {
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  expect(await loadAIStatus(ticket("zendesk:account:1"), context())).toBe("not_supported");
  expect(await loadAIStatus(ticket("1"), {})).toBe("unavailable");
  expect(request).not.toHaveBeenCalled();
});
