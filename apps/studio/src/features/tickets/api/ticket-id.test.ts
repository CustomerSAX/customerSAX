import { expect, it } from "vitest";
import { ticketIdFromRoute } from "./ticket-id";

it("decodes Zendesk route IDs and leaves native and malformed IDs intact", () => {
  expect(ticketIdFromRoute("zendesk%3Aroyalcyber-6021%3A2")).toBe(
    "zendesk:royalcyber-6021:2"
  );
  expect(ticketIdFromRoute("zendesk:royalcyber-6021:2")).toBe(
    "zendesk:royalcyber-6021:2"
  );
  expect(ticketIdFromRoute("native-123")).toBe("native-123");
  expect(ticketIdFromRoute("bad%")).toBe("bad%");
});
