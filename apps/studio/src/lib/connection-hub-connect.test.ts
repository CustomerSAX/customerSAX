import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  catalog: vi.fn(),
  fetch: vi.fn(),
  log: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("./get-current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./connection-hub-catalog", () => ({
  connectionHubCatalog: { list: mocks.catalog }
}));
vi.mock("./request-logger", () => ({
  requestLogger: () => ({ requestId: "test", log: { error: mocks.log } })
}));

import { POST } from "../app/api/connection-hub/connectors/[connectorId]/route";

const scope = { clientId: "client-a", projectKey: "project-a" };
const connector = {
  id: "freshdesk",
  name: "Freshdesk",
  description: "Customer support",
  category: "customer-support",
  authenticationType: "SECRET_TEXT",
  actions: [
    { id: "get_tickets", name: "Get Tickets", readOnly: true },
    { id: "custom_api_call", name: "Custom API Call", readOnly: false }
  ]
};
type Binding = {
  id: string;
  tenantId: string;
  projectKey: string;
  connectorId: string;
  canonicalAction: string;
  operation: string;
  connectionId: string;
  releaseId: string;
  allowedIndex: string;
  revision: number;
  enabled: boolean;
};
let bindings: Binding[];

function connect(body: unknown, connectorId = "freshdesk") {
  return POST(
    new NextRequest(`http://studio.test/api/connection-hub/connectors/${connectorId}`, {
      method: "POST",
      headers: { origin: "http://studio.test", "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ connectorId }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    CONNECTION_HUB_ENABLED: "true",
    USE_CONNECTION_HUB_PROD: "false",
    CONNECTION_HUB_URL: "http://127.0.0.1:3100",
    CONNECTION_HUB_API_KEY: "synthetic-execution-key",
    CONNECTION_HUB_ADMIN_API_KEY: "synthetic-management-key",
    CONNECTION_HUB_CLIENT_ID: "client-a",
    CONNECTION_HUB_TENANT_ID: "hub-tenant",
    CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH: "false"
  }))
    vi.stubEnv(key, value);
  mocks.user.mockResolvedValue({
    role: "admin",
    activeClientId: "client-a",
    activeProjectKey: "project-a"
  });
  mocks.catalog.mockResolvedValue([connector]);
  bindings = [];
  mocks.fetch.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith("/admin/releases"))
      return Response.json({
        releases: [
          {
            id: "release-freshdesk",
            connectorId: "freshdesk",
            enabled: true,
            createdAt: "2026-10-29"
          }
        ]
      });
    if (url.endsWith("/admin/connections"))
      return Response.json({
        id: "connection-freshdesk",
        connectorId: "freshdesk",
        mode: "live",
        enabled: true
      });
    if (url.endsWith("/admin/bindings")) {
      const body = JSON.parse(String(options.body));
      bindings.push({
        ...body,
        id: `binding-${body.operation}`,
        tenantId: "hub-tenant",
        revision: 1
      });
      return Response.json(bindings.at(-1));
    }
    if (url.endsWith("/projects/project-a/bindings"))
      return Response.json({ applicationId: "connection-hub", bindings });
    throw new Error(`Unexpected Hub request: ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("connects a catalog connector and enables only the selected actions", async () => {
  const response = await connect({
    ...scope,
    account: "acme.freshdesk.com",
    credential: "private-api-key",
    resource: "tickets",
    actions: ["get_tickets"]
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    ...scope,
    connectorId: "freshdesk",
    connected: true,
    enabledActions: 1
  });
  const connection = mocks.fetch.mock.calls.find(([url]) =>
    url.endsWith("/admin/connections")
  );
  expect(JSON.parse(connection?.[1].body)).toEqual({
    connectorId: "freshdesk",
    name: "CSA Freshdesk: project-a",
    applicationId: "acme.freshdesk.com",
    apiKey: "private-api-key",
    indexName: "tickets"
  });
  expect(
    mocks.fetch.mock.calls
      .filter(([url]) => url.includes("/admin/"))
      .every(
        ([, options]) =>
          Object.assign({}, options.headers).authorization ===
          "Bearer synthetic-management-key"
      )
  ).toBe(true);
  expect(bindings).toEqual([
    expect.objectContaining({
      canonicalAction: "get_tickets",
      operation: "get_tickets",
      enabled: true
    })
  ]);
});

it("requires an approved release before storing credentials", async () => {
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/admin/releases")) return Response.json({ releases: [] });
    throw new Error("credentials must not be sent");
  });
  const response = await connect({
    ...scope,
    account: "acme.freshdesk.com",
    credential: "private-api-key",
    resource: "",
    actions: ["get_tickets"]
  });
  expect(response.status).toBe(409);
  expect(await response.text()).toContain("Approve a Freshdesk connector release");
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("rejects unknown actions, bespoke connectors and stale project scope", async () => {
  expect(
    (
      await connect({
        ...scope,
        account: "acme",
        credential: "secret",
        resource: "",
        actions: ["not_in_catalog"]
      })
    ).status
  ).toBe(400);
  expect(
    (
      await connect(
        {
          ...scope,
          account: "acme",
          credential: "secret",
          resource: "",
          actions: ["get_tickets"]
        },
        "zendesk"
      )
    ).status
  ).toBe(400);
  expect(
    (
      await connect({
        ...scope,
        projectKey: "other",
        account: "acme",
        credential: "secret",
        resource: "",
        actions: ["get_tickets"]
      })
    ).status
  ).toBe(409);
});
