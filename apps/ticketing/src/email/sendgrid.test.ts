import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ticketingProvider } from "../providers/index.js";
import { localEmailConfig } from "./config.js";
import { resolvers } from "../schema.js";
import { resolveProjectTicketing } from "@csa/mongodb";

vi.mock("@csa/mongodb", async original => ({
  ...(await original<typeof import("@csa/mongodb")>()),
  resolveProjectTicketing: vi.fn(async () => ({ provider: "internal" })),
  nativeTicketLegacyAccess: vi.fn(async () => false)
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.mocked(resolveProjectTicketing).mockClear();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MONGO_URI", "");
  vi.stubEnv("TICKETING_PROVIDER", "internal");
  vi.stubEnv("TICKET_EMAIL_ENABLED", "true");
  vi.stubEnv("TICKET_EMAIL_AI_FOLLOWUP_ENABLED", "false");
  vi.stubEnv("TICKET_EMAIL_PROVIDER", "sendgrid");
  vi.stubEnv("SENDGRID_API_KEY", "test-key");
  vi.stubEnv("TICKET_EMAIL_FROM", "support@example.com");
  vi.stubEnv("TICKET_EMAIL_REPLY_TO", "agent@example.com");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("sends only after creating a native ticket, without disclosing internal notes", async () => {
  const provider = ticketingProvider("email-test");
  const ticket = await provider.createTicket({ subject: "Order help", customerEmail: "customer@example.com", message: "PRIVATE NOTE", worklog: "PRIVATE WORKLOG" });
  expect(await provider.getTicket(ticket.id)).toMatchObject({ id: ticket.id });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
  const body = JSON.parse(request.body);
  expect(body.personalizations[0].to[0].email).toBe("customer@example.com");
  expect(body.reply_to.email).toBe("agent@example.com");
  expect(body.subject).toContain(ticket.ticketNumber);
  expect(request.body).not.toContain("PRIVATE");
});

it("does not send when disabled or without a customer email", async () => {
  await ticketingProvider("email-test").createTicket({ subject: "No recipient" });
  vi.stubEnv("TICKET_EMAIL_ENABLED", "false");
  await ticketingProvider("email-test").createTicket({ subject: "Disabled", customerEmail: "customer@example.com" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects incomplete config and production use before sending", () => {
  expect(() => localEmailConfig("")).toThrow("active project");
  vi.stubEnv("SENDGRID_API_KEY", "");
  expect(() => localEmailConfig("email-test")).toThrow("SENDGRID_API_KEY");
  vi.stubEnv("NODE_ENV", "production");
  expect(() => localEmailConfig("email-test")).toThrow("production");
});

it("follows the active session project/client when switching projects, ignoring draft and old env values", async () => {
  vi.stubEnv("TICKET_EMAIL_PROJECT_KEY", "stale-project");
  vi.stubEnv("TICKET_EMAIL_CLIENT_ID", "stale-client");
  const firstContext = { projectKey: "dropdown-one", clientId: "client-one" };
  const secondContext = { projectKey: "dropdown-two", clientId: "client-two" };
  const draft = { subject: "Selected project", customerEmail: "customer@example.com", projectKey: "untrusted-draft" };
  const first = await resolvers.Mutation.createTicket(null, { draft }, firstContext);
  const second = await resolvers.Mutation.createTicket(null, { draft }, secondContext);
  expect(first.projectKey).toBe("dropdown-one");
  expect(second.projectKey).toBe("dropdown-two");
  expect(resolveProjectTicketing).toHaveBeenCalledWith("client-one", "dropdown-one");
  expect(resolveProjectTicketing).toHaveBeenCalledWith("client-two", "dropdown-two");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(await resolvers.Query.ticket(null, { id: first.id }, secondContext)).toBeNull();
  expect(await resolvers.Query.ticket(null, { id: first.id }, { ...firstContext, clientId: "client-two" })).toBeNull();
});

it("rejects unsupported providers rather than silently using SendGrid", () => {
  vi.stubEnv("TICKET_EMAIL_PROVIDER", "another-provider");
  expect(() => localEmailConfig("email-test")).toThrow("Unsupported email provider");
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["rejection", "timeout"])("preserves the saved ticket on %s without retrying the send", async (failure) => {
  if (failure === "rejection") fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
  else fetchMock.mockRejectedValue(new Error("timeout"));
  const provider = ticketingProvider("email-test");
  const ticket = await provider.createTicket({ subject: "Retained", customerEmail: "customer@example.com" });
  expect(await provider.getTicket(ticket.id)).toMatchObject({ subject: "Retained" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
