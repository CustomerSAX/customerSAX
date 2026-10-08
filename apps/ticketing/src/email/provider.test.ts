import { expect, it, vi } from "vitest";
import { sendTicketCreated } from "./ticket-created.js";
import type { EmailMessage, EmailProvider } from "@csa/email";
import type { Ticket } from "../tickets/types.js";

const message: EmailMessage = {
  from: { email: "support@example.com" }, to: { email: "customer@example.com" },
  subject: "Ticket created", text: "Your ticket is open."
};
const ticket: Ticket = {
  id: "123", ticketNumber: "T-123", projectKey: "test", subject: "Help",
  customerEmail: "customer@example.com", status: "open", priority: "normal",
  comments: [], attachments: [], history: []
};

it("can replace SendGrid without changing the ticket notification workflow", async () => {
  const send = vi.fn<EmailProvider["send"]>().mockResolvedValue({ status: "accepted", messageId: "other-provider-id" });
  const result = await sendTicketCreated(ticket, { provider: { name: "replacement", send }, from: message.from });
  expect(result).toEqual({ status: "accepted", messageId: "other-provider-id" });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: message.to, subject: "[T-123] Help" }));
});

it("contains unexpected replacement-provider failures", async () => {
  const provider: EmailProvider = { name: "replacement", send: async () => { throw new Error("provider failure"); } };
  expect(await sendTicketCreated(ticket, { provider, from: message.from })).toEqual({ status: "unknown" });
});
