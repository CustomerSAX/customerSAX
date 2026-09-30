import { afterEach, expect, it, vi } from "vitest";
import { prepareTicketing, ticketingSettingsView } from "./ticketing.js";
import {
  freshdeskClient,
  normalizeFreshdeskDomain,
  projectFreshdeskCredentials
} from "./freshdesk.js";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("normalizes Freshdesk domains and rejects other credential destinations", () => {
  expect(normalizeFreshdeskDomain("https://royalcyber-help.freshdesk.com/")).toBe(
    "royalcyber-help.freshdesk.com"
  );
  for (const domain of [
    "evil.com",
    "acme.freshdesk.com@evil.com",
    "acme/path",
    "acme.freshdesk.com:443",
    "http://acme.freshdesk.com"
  ])
    expect(() => normalizeFreshdeskDomain(domain)).toThrow("Freshdesk domain");
});
it("encrypts API keys, preserves separate provider secrets and requires a new key for account changes", () => {
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
  const zendesk = prepareTicketing({
    provider: "zendesk",
    subdomain: "acme",
    clientId: "oauth",
    clientSecret: "zendesk-secret"
  });
  const settings = prepareTicketing(
    { provider: "freshdesk", freshdeskDomain: "acme", freshdeskApiKey: "api-key" },
    zendesk
  );
  expect(settings.secretEncrypted).toBe(zendesk.secretEncrypted);
  expect(settings.freshdeskApiKeyEncrypted).not.toContain("api-key");
  expect(projectFreshdeskCredentials(settings)).toEqual({
    domain: "acme.freshdesk.com",
    apiKey: "api-key"
  });
  expect(JSON.stringify(ticketingSettingsView(settings))).not.toContain("api-key");
  expect(ticketingSettingsView(settings)).toMatchObject({ freshdeskApiKeySet: true });
  expect(
    prepareTicketing(
      { provider: "freshdesk", freshdeskDomain: "acme", freshdeskApiKey: "" },
      settings
    ).freshdeskApiKeyEncrypted
  ).toBe(settings.freshdeskApiKeyEncrypted);
  expect(() =>
    prepareTicketing({ provider: "freshdesk", freshdeskDomain: "other" }, settings)
  ).toThrow("changing");
});
it("uses Basic API key auth with redirects disabled and sanitized errors", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("[]", { status: 200 }))
    .mockResolvedValueOnce(new Response("secret customer content", { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  const api = freshdeskClient({ domain: "acme.freshdesk.com", apiKey: "test-key" });
  await api("tickets");
  expect(fetcher).toHaveBeenCalledWith(
    "https://acme.freshdesk.com/api/v2/tickets",
    expect.objectContaining({
      redirect: "error",
      headers: expect.objectContaining({
        authorization: `Basic ${Buffer.from("test-key:X").toString("base64")}`
      })
    })
  );
  await expect(api("ticket_fields")).rejects.toThrow("HTTP 403");
  await expect(api("../other")).rejects.toThrow("Invalid Freshdesk API path");
});
