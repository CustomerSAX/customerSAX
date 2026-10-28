import { expect, it } from "vitest";
import { integrationStatus } from "./hub-status.js";
import type { HubProject } from "@csa/connection-hub";
const scope = (bindings: unknown[]) => ({ bindings } as HubProject);
it("uses Hub bindings for external status and never returns legacy credentials", () => {
  const status = integrationStatus(scope([
    { connectorId: "zendesk", canonicalAction: "zendesk-read", enabled: true, providerAccount: "acme" },
    { connectorId: "hubspot", canonicalAction: "hubspot-custom-api-call", enabled: true },
    { connectorId: "algolia", canonicalAction: "search-products", enabled: true, allowedIndex: "products" }
  ]));
  expect(status.ticketing).toMatchObject({ provider: "zendesk", subdomain: "acme", clientId: "", secretSet: false });
  expect(status.crm).toMatchObject({ provider: "hubspot", hubspotTokenSet: false });
  expect(status.products).toMatchObject({ provider: "algolia", indexName: "products", searchApiKeySet: false });
});
it("reports native/no CRM for removed connectors", () => {
  const status = integrationStatus(scope([{ connectorId: "zendesk", canonicalAction: "zendesk-read", enabled: false }, { connectorId: "zoho-crm", enabled: false }]));
  expect(status.ticketing.provider).toBe("internal"); expect(status.crm.provider).toBe("none"); expect(status.products.provider).toBe("commercetools");
});
