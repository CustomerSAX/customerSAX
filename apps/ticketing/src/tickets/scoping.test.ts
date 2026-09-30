import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createTicket, getTicket, listTickets, updateTicket, addWorklog } from "./repository.js";
beforeEach(() => vi.stubEnv("MONGO_URI", ""));
afterEach(() => vi.unstubAllEnvs());
it("isolates native reads, writes and worklogs for clients sharing a project key", async () => {
  const projectKey = "shared-scope-test";
  const a = { clientId: "client-a", includeLegacy: false };
  const b = { clientId: "client-b", includeLegacy: false };
  const ticket = await createTicket({ projectKey, subject: "Owned by A" }, a);
  await createTicket({ projectKey, subject: "Owned by B" }, b);
  expect((await listTickets({ projectKey }, a)).results.map(t => t.subject)).toEqual(["Owned by A"]);
  expect(await getTicket(ticket.id, projectKey, b)).toBeNull();
  expect(await updateTicket(ticket.id, { projectKey, subject: "Unauthorized" }, b)).toBeNull();
  expect(await addWorklog(ticket.id, { id: "note", comment: "Unauthorized", status: "internal", createdAt: "now" }, projectKey, b)).toBeNull();
  expect((await getTicket(ticket.id, projectKey, a))?.subject).toBe("Owned by A");
  expect(await getTicket(ticket.id, projectKey)).toBeNull();
});
it("only exposes unowned legacy tickets when ownership is unambiguous", async () => {
  const projectKey = "legacy-scope-test";
  const ticket = await createTicket({ projectKey, subject: "Legacy" });
  expect(await getTicket(ticket.id, projectKey, { clientId: "a", includeLegacy: false })).toBeNull();
  expect((await getTicket(ticket.id, projectKey, { clientId: "a", includeLegacy: true }))?.subject).toBe("Legacy");
});
