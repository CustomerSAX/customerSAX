import { beforeEach, expect, it, vi } from "vitest";
import { withNotifications } from "./provider.js";
import { publishTicketNotification } from "./store.js";
import type { TicketingProvider } from "../providers/types.js";
import type { Ticket } from "../tickets/types.js";
vi.mock("./store.js", () => ({ publishTicketNotification: vi.fn() }));
beforeEach(() => { vi.mocked(publishTicketNotification).mockReset(); });
const ticket: Ticket = { id: "1", ticketNumber: "T1", projectKey: "p", subject: "Help", status: "Open", priority: "normal", comments: [], attachments: [], history: [], assignee: "old@example.com" };
function provider(): TicketingProvider {
  return { createTicket: async () => ticket, getTicket: async () => ticket, listTickets: async () => ({ results: [], total: 0, count: 0, offset: 0 }), updateTicket: async (_id, patch) => ({ ...ticket, ...patch, priority: patch.priority ?? ticket.priority, status: patch.status ?? ticket.status, comments: [], attachments: [] }), addWorklog: async () => ticket, closeIfUnchanged: async () => null };
}
it("records successful writes and assignment changes, not failed conditional closure", async () => {
  const p = withNotifications(provider(), "client");
  await p.createTicket({ subject: "Help" });
  await p.updateTicket("1", { assignee: "new@example.com" });
  await p.closeIfUnchanged!("1", "old", "done");
  expect(publishTicketNotification).toHaveBeenCalledTimes(2);
  expect(publishTicketNotification).toHaveBeenLastCalledWith("client", expect.objectContaining({ assignee: "new@example.com" }), "Ticket assignment changed", "old@example.com");
});
it("does not turn notification storage failure into a failed ticket creation", async () => {
  vi.mocked(publishTicketNotification).mockRejectedValue(new Error("storage unavailable"));
  expect(await withNotifications(provider(), "client").createTicket({ subject: "Help" })).toBe(ticket);
});
