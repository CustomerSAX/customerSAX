import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { analyzeCreatedTicket } from "./analyze-created.js";
import type { Ticket } from "../tickets/types.js";
const request = vi.fn<typeof fetch>();
const ticket: Ticket = { id: "native-1", ticketNumber: "T1", projectKey: "selected-project", customerEmail: "customer@example.com", subject: "Help", status: "Open", priority: "normal", comments: [], attachments: [], history: [] };
const identity = { clientId: "client-a", userEmail: "agent@example.com", userRole: "agent" };
beforeEach(() => {
  vi.stubGlobal("fetch", request); request.mockReset();
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("TICKET_EMAIL_ENABLED", "true");
  vi.stubEnv("TICKET_EMAIL_AI_FOLLOWUP_ENABLED", "true"); vi.stubEnv("AI_ASSIST_URL", "http://localhost:8080");
  vi.stubEnv("SENDGRID_API_KEY", "test"); vi.stubEnv("TICKET_EMAIL_FROM", "support@example.com");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("runs analysis in the active scope and does not also send a generic confirmation", async () => {
  request.mockResolvedValue(Response.json({ review: { status: "blocked", informationRequest: { status: "accepted" } } }));
  await analyzeCreatedTicket(ticket, identity);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe("http://localhost:8080/ticket-review");
  const options = request.mock.calls[0][1]!;
  expect(options.headers).toMatchObject({ "x-csa-project-key": "selected-project", "x-csa-client-id": "client-a", "x-csa-user-email": "agent@example.com" });
  expect(JSON.parse(options.body as string)).toEqual({ operation: "analyze", ticketId: "native-1" });
});
it("sends confirmation when analysis completes with no missing details", async () => {
  request.mockResolvedValueOnce(Response.json({ review: { status: "pending" } })).mockResolvedValueOnce(new Response(null, { status: 202 }));
  await analyzeCreatedTicket(ticket, identity);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][0]).toBe("https://api.sendgrid.com/v3/mail/send");
});
it("does not duplicate mail after uncertain analysis or without authorized context", async () => {
  request.mockRejectedValue(new Error("timeout"));
  await expect(analyzeCreatedTicket(ticket, identity)).resolves.toBeUndefined();
  expect(request).toHaveBeenCalledTimes(1);
  await analyzeCreatedTicket(ticket, {});
  await analyzeCreatedTicket({ ...ticket, id: "zendesk:account:1" }, identity);
  expect(request).toHaveBeenCalledTimes(1);
});
