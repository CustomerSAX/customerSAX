import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getIdTokenClient(audience: string) {
      return { getRequestHeaders: () => mocks.identity(audience) };
    }
  }
}));

import { connectionHubTransport } from "./connection-hub-transport";

beforeEach(() => {
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "false");
  vi.stubEnv("CONNECTION_HUB_URL", "http://127.0.0.1:3100");
  vi.stubEnv("CONNECTION_HUB_API_KEY", "synthetic-local-execution-key");
  vi.stubEnv("CONNECTION_HUB_CLIENT_ID", "client-a");
  vi.stubEnv("CONNECTION_HUB_TENANT_ID", "");
  vi.stubEnv("CONNECTION_HUB_PROD_URL", "https://hub-test.us-central1.run.app");
  vi.stubEnv("CONNECTION_HUB_PROD_API_KEY", "synthetic-prod-execution-key");
  vi.stubEnv("CONNECTION_HUB_PROD_TENANT_ID", "production-hub-workspace");
  mocks.identity.mockReset();
  mocks.identity.mockResolvedValue(
    new Headers({ authorization: "Bearer synthetic-google-id-token" })
  );
});

afterEach(() => vi.unstubAllEnvs());

it("keeps local mode independent of Google credentials and production settings", async () => {
  const config = connectionHubTransport.getConfig();
  if (!config) throw new Error("Missing test configuration");
  expect(config).toMatchObject({
    url: "http://127.0.0.1:3100",
    tenantId: "client-a",
    useConnectionHubProd: false
  });
  expect(await connectionHubTransport.headers({ config })).toEqual({
    authorization: "Bearer synthetic-local-execution-key",
    "x-tenant-id": "client-a"
  });
  expect(mocks.identity).not.toHaveBeenCalled();
});

it("selects production credentials and keeps Google and Hub authorization separate", async () => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  const config = connectionHubTransport.getConfig();
  if (!config) throw new Error("Missing test configuration");
  const headers = await connectionHubTransport.headers({
    config,
    requestId: "request-1",
    json: true
  });
  expect(config).toMatchObject({
    url: "https://hub-test.us-central1.run.app",
    clientId: "client-a",
    tenantId: "production-hub-workspace"
  });
  expect(headers).toEqual({
    authorization: "Bearer synthetic-prod-execution-key",
    "X-Serverless-Authorization": "Bearer synthetic-google-id-token",
    "x-tenant-id": "production-hub-workspace",
    "content-type": "application/json",
    "x-request-id": "request-1"
  });
  expect(mocks.identity).toHaveBeenCalledWith(config.url);
});

it("does not fall back to local credentials when production configuration is missing", () => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  vi.stubEnv("CONNECTION_HUB_PROD_API_KEY", "");
  expect(() => connectionHubTransport.getConfig()).toThrow("HUB_CONFIGURATION_REQUIRED");
});

it.each([
  "http://127.0.0.1:3100",
  "https://user:secret@hub.run.app",
  "https://hub.run.app/mcp",
  "https://hub.run.app?token=secret"
])("rejects an invalid production origin: %s", (url) => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  vi.stubEnv("CONNECTION_HUB_PROD_URL", url);
  expect(() => connectionHubTransport.getConfig()).toThrow("HUB_URL_INVALID");
});

it("fails closed when Google cannot produce an identity token", async () => {
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "true");
  const config = connectionHubTransport.getConfig();
  if (!config) throw new Error("Missing test configuration");
  mocks.identity.mockResolvedValue(new Headers());
  await expect(connectionHubTransport.headers({ config })).rejects.toThrow(
    "HUB_GOOGLE_ID_TOKEN_REQUIRED"
  );
});

it("honors the integration kill switch and validates the production flag", () => {
  vi.stubEnv("CONNECTION_HUB_ENABLED", "false");
  expect(connectionHubTransport.getConfig()).toBeUndefined();
  vi.stubEnv("CONNECTION_HUB_ENABLED", "true");
  vi.stubEnv("USE_CONNECTION_HUB_PROD", "yes");
  expect(() => connectionHubTransport.getConfig()).toThrow("HUB_MODE_INVALID");
});
