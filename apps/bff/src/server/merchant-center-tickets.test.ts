import { describe, expect, it } from "vitest";
import {
  hasCsaTicketPermission,
  sanitizeTicketDetailPayload,
  sanitizeTicketQueryPayload
} from "./merchant-center-tickets.js";

describe("sanitizeTicketQueryPayload", () => {
  it("bounds pagination, trims search, and accepts supported sorting", () => {
    expect(
      sanitizeTicketQueryPayload({
        search: "  delayed order  ",
        limit: 500,
        offset: -12,
        sortKey: "ticketNumber",
        sortOrder: "asc"
      })
    ).toMatchObject({
      search: "delayed order",
      limit: 100,
      offset: 0,
      sortKey: "ticketNumber",
      sortOrder: "asc"
    });
  });

  it("rejects arbitrary sort fields and invalid pagination types", () => {
    expect(
      sanitizeTicketQueryPayload({
        limit: "100",
        offset: 1.5,
        sortKey: "$where",
        sortOrder: "sideways"
      })
    ).toMatchObject({
      limit: 20,
      offset: 0,
      sortKey: "lastModifiedAt",
      sortOrder: "desc"
    });
  });
});

describe("sanitizeTicketDetailPayload", () => {
  it("returns a trimmed ticket identifier", () => {
    expect(sanitizeTicketDetailPayload({ ticketId: "  native:ticket-123  " })).toBe(
      "native:ticket-123"
    );
  });

  it("rejects missing and non-string identifiers", () => {
    expect(sanitizeTicketDetailPayload({})).toBeUndefined();
    expect(sanitizeTicketDetailPayload({ ticketId: 123 })).toBeUndefined();
  });

  it("accepts an identifier from a forwarded payload envelope", () => {
    expect(
      sanitizeTicketDetailPayload({ payload: { ticketId: "ticket-123" } })
    ).toBe("ticket-123");
  });
});

describe("hasCsaTicketPermission", () => {
  it("accepts Merchant Center view or manage permission formats", () => {
    expect(hasCsaTicketPermission(["ViewCsa"])).toBe(true);
    expect(hasCsaTicketPermission(["canManageCsa"])).toBe(true);
  });

  it("does not grant ticket access from an unrelated permission", () => {
    expect(hasCsaTicketPermission(["ViewCsaCustomers"])).toBe(false);
    expect(hasCsaTicketPermission(undefined)).toBe(false);
  });
});
