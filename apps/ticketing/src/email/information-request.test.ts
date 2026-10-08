import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { createTicket, getTicket, updateTicket } from "../tickets/repository.js";
import { requestTicketInformation } from "./information-request.js";
const scope = { clientId: "customer-a", includeLegacy: false };
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("MONGO_URI", ""); vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TICKET_EMAIL_ENABLED", "true"); vi.stubEnv("TICKET_EMAIL_AI_FOLLOWUP_ENABLED", "true");
  vi.stubEnv("TICKET_EMAIL_PROVIDER", "sendgrid"); vi.stubEnv("SENDGRID_API_KEY", "test-key");
  vi.stubEnv("TICKET_EMAIL_FROM", "support@example.com");
  request.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function ticket() {
  return createTicket({ projectKey: "test", subject: "Update phone", customerEmail: "customer@example.com", message: "INTERNAL ONLY" }, scope);
}
it("claims once under concurrent calls and saves the exact email on the ticket", async () => {
  const t = await ticket();
  await Promise.all([1, 2].map(() => requestTicketInformation(t.id, t.lastModifiedAt!, ["new_phone_number"], "test", scope)));
  expect(request).toHaveBeenCalledTimes(1);
  const updated = (await getTicket(t.id, "test", scope))!;
  expect(updated.status).toBe("Pending");
  expect(updated.informationRequest?.status).toBe("accepted");
  expect(updated.comments[0].comment).toContain("new phone number");
  expect(request.mock.calls[0][1]?.body).not.toContain("INTERNAL ONLY");
  await requestTicketInformation(t.id, updated.lastModifiedAt!, ["clarify_request"], "test", scope);
  expect(request).toHaveBeenCalledTimes(1);
});
it("does not resend rejected or uncertain requests and does not mark them Pending", async () => {
  for (const outcome of ["rejected", "unknown"]) {
    request.mockReset();
    if (outcome === "rejected") request.mockResolvedValue(new Response(null, { status: 403 }));
    else request.mockRejectedValue(new Error("timeout"));
    const t = await ticket();
    const result = await requestTicketInformation(t.id, t.lastModifiedAt!, ["new_phone_number"], "test", scope);
    expect(result?.status).toBe(outcome);
    const updated = (await getTicket(t.id, "test", scope))!;
    expect(updated.status).not.toBe("Pending");
    await requestTicketInformation(t.id, updated.lastModifiedAt!, ["new_phone_number"], "test", scope);
    expect(request).toHaveBeenCalledTimes(1);
  }
});
it("rejects cross-client access, stale tickets, and arbitrary model text", async () => {
  const t = await ticket();
  await expect(requestTicketInformation(t.id, t.lastModifiedAt!, ["new_phone_number"], "test", { ...scope, clientId: "other" })).rejects.toThrow("not found");
  await expect(requestTicketInformation(t.id, "2000-01-01", ["new_phone_number"], "test", scope)).rejects.toThrow("changed");
  await expect(requestTicketInformation(t.id, t.lastModifiedAt!, ["Send your password"], "test", scope)).rejects.toThrow("Unsupported");
  expect(request).not.toHaveBeenCalled();
});
it("never overwrites closure during a send", async () => {
  const t = await ticket();
  request.mockImplementation(async () => {
    await updateTicket(t.id, { projectKey: "test", status: "Closed" }, scope);
    return new Response(null, { status: 202 });
  });
  await requestTicketInformation(t.id, t.lastModifiedAt!, ["new_phone_number"], "test", scope);
  expect((await getTicket(t.id, "test", scope))?.status).toBe("Closed");
});
it("skips closed tickets and disabled automation", async () => {
  const t = await ticket();
  await updateTicket(t.id, { projectKey: "test", status: "Closed" }, scope);
  expect(await requestTicketInformation(t.id, t.lastModifiedAt!, ["new_phone_number"], "test", scope)).toBeNull();
  vi.stubEnv("TICKET_EMAIL_AI_FOLLOWUP_ENABLED", "false");
  expect(await requestTicketInformation(t.id, t.lastModifiedAt!, ["new_phone_number"], "test", scope)).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
