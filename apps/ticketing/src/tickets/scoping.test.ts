import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createTicket, getTicket, listTickets, updateTicket, addWorklog, closeIfUnchanged } from "./repository.js";
beforeEach(() => vi.stubEnv("MONGO_URI", ""));
afterEach(() => vi.unstubAllEnvs());
it("closes only the approved unchanged ticket in the correct tenant", async () => {
  const projectKey = "closure-test";
  const owner = { clientId: "closure-a", includeLegacy: false };
  const ticket = await createTicket({ projectKey, subject: "Close after approval", status: "Open" }, owner);
  expect(await closeIfUnchanged(ticket.id, ticket.lastModifiedAt!, projectKey, { clientId: "closure-b", includeLegacy: false }, "Resolved contact request")).toBeNull();
  expect(await closeIfUnchanged(ticket.id, "2000-01-01T00:00:00.000Z", projectKey, owner, "Resolved contact request")).toBeNull();
  expect((await getTicket(ticket.id, projectKey, owner))?.status).toBe("Open");
  expect((await closeIfUnchanged(ticket.id, ticket.lastModifiedAt!, projectKey, owner, "Resolved contact request"))?.status).toBe("Closed");
  expect((await getTicket(ticket.id, projectKey, owner))?.solution).toBe("Resolved contact request");
});
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
it("matches status and priority filters in any casing or vocabulary", async () => {
  const projectKey = "filter-vocabulary";
  const owner = { clientId: "filter-client", includeLegacy: false };
  await createTicket({ projectKey, subject: "Studio ticket", status: "In Progress", priority: "Medium" }, owner);
  await createTicket({ projectKey, subject: "Waiting ticket", status: "Pending", priority: "High" }, owner);
  const subjects = async (args: Record<string, string>) => (await listTickets({ projectKey, ...args }, owner)).results.map(t => t.subject).sort();
  expect(await subjects({ status: "in progress" })).toEqual(["Studio ticket"]);
  expect(await subjects({ status: "in_progress" })).toEqual(["Studio ticket"]);
  expect(await subjects({ status: "waiting" })).toEqual(["Waiting ticket"]);
  expect(await subjects({ priority: "normal" })).toEqual(["Studio ticket"]);
  expect(await subjects({ priority: "high" })).toEqual(["Waiting ticket"]);
  expect(await subjects({ status: "open" })).toEqual([]);
});
