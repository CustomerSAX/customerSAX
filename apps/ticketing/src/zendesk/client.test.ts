import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFile, writeFile, rename } from "node:fs/promises";
import { accessToken, zendeskConfig, zendeskRequest } from "./client.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn()
}));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TICKETING_PROJECT_KEY", "test");
  vi.stubEnv("ZENDESK_SUBDOMAIN", "acme");
  vi.stubEnv("ZENDESK_ACCESS_TOKEN", "");
  vi.stubEnv("ZENDESK_CLIENT_ID", "client");
  vi.stubEnv("ZENDESK_CLIENT_SECRET", "secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("only accepts Zendesk subdomains", () => {
  vi.stubEnv("ZENDESK_SUBDOMAIN", "https://Acme.zendesk.com/");
  expect(zendeskConfig().subdomain).toBe("acme");
  for (const host of [
    "https://evil.example",
    "acme.zendesk.com@evil.example",
    "acme/path",
    "acme:443"
  ]) {
    vi.stubEnv("ZENDESK_SUBDOMAIN", host);
    expect(() => zendeskConfig()).toThrow("ZENDESK_SUBDOMAIN");
  }
});
it("never follows redirects with credentials and sanitizes vendor errors", async () => {
  fetchMock.mockResolvedValueOnce(new Response("sensitive vendor body", { status: 422 }));
  await expect(zendeskRequest("/api/v2/tickets.json")).rejects.toThrow("HTTP 422");
  expect(fetchMock).toHaveBeenCalledWith(
    "https://acme.zendesk.com/api/v2/tickets.json",
    expect.objectContaining({ redirect: "error" })
  );
});
it("returns an explicit token without reading local credentials", async () => {
  vi.stubEnv("ZENDESK_ACCESS_TOKEN", "manual-token");
  expect(await accessToken()).toBe("manual-token");
  expect(readFile).not.toHaveBeenCalled();
});
it("rejects tokens belonging to another account", async () => {
  vi.mocked(readFile).mockResolvedValue(
    JSON.stringify({ subdomain: "other", clientId: "client" })
  );
  await expect(accessToken()).rejects.toThrow("another Zendesk account");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("refreshes once for concurrent requests and persists rotated tokens with private permissions", async () => {
  vi.mocked(readFile).mockResolvedValue(
    JSON.stringify({
      subdomain: "acme",
      clientId: "client",
      access_token: "old",
      refresh_token: "old-refresh",
      expiresAt: 0
    })
  );
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        access_token: "new",
        refresh_token: "new-refresh",
        expires_in: 1800
      }),
      { status: 200 }
    )
  );
  expect(await Promise.all([accessToken(), accessToken()])).toEqual(["new", "new"]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string).refresh_token
  ).toBeUndefined();
  expect(writeFile).toHaveBeenLastCalledWith(
    expect.stringContaining(".tmp"),
    expect.stringContaining("new-refresh"),
    { mode: 0o600 }
  );
  expect(rename).toHaveBeenCalledTimes(1);
});
