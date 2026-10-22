import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { investigateTicket } from "./api/investigation-engine";
import {
  createTicket,
  updateTicket,
  closeIfUnchanged,
} from "../../../../ticketing/src/tickets/repository";

describe("Phase 3: AI-Driven Ticket Investigation & Resolution Workflow", () => {
  beforeEach(() => {
    vi.stubEnv("MONGO_URI", ""); // Safe in-memory store, zero mutation of production databases
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── 1. Contact update with all required information available ─────────────
  it("Case 1: Contact update with all required information available", () => {
    const ticket = {
      id: "ticket-contact-1",
      ticketNumber: "CSA-301",
      subject: "Hi can you please update my contact details for Newmarket address to 7448122377",
      message: "Please update my phone number to 7448122377 for my Newmarket residence.",
      customerName: "Diana Prince",
      customerEmail: "diana.prince@example.com",
      customerId: "cust-101",
    };

    const customerData = {
      id: "cust-101",
      email: "diana.prince@example.com",
      version: 4,
      targets: [
        { id: "addr-1", label: "12 Newmarket Road, Austin, US", phone: "1234567890" },
        { id: "addr-2", label: "45 Broadway Ave, New York, US", phone: "9876543210" },
      ],
    };

    const result = investigateTicket(ticket, customerData);

    expect(result.intent).toBe("contact_update");
    expect(result.intentLabel).toBe("Contact Detail Update");
    expect(result.entities.phone).toBe("7448122377");
    expect(result.entities.addressKeyword?.toLowerCase()).toContain("newmarket");
    expect(result.matchedContactTarget?.id).toBe("addr-1");
    expect(result.matchedContactTarget?.label).toBe("12 Newmarket Road, Austin, US");
    expect(result.canResolveWithAvailableInfo).toBe(true);
    expect(result.missingInfo.length).toBe(0);

    // Proposed field diff
    expect(result.proposedChanges.length).toBe(1);
    expect(result.proposedChanges[0].field).toBe("Address Phone Number");
    expect(result.proposedChanges[0].previousValue).toBe("1234567890");
    expect(result.proposedChanges[0].proposedValue).toBe("7448122377");

    // Grounded customer response
    expect(result.customerDraft).toContain("7448122377");
    expect(result.customerDraft).toContain("12 Newmarket Road, Austin, US");

    // CRITICAL: Must NEVER ask for an order number!
    expect(result.customerDraft).not.toContain("order confirmation number");
    expect(result.requiredInfo).not.toContain("Order Confirmation Number");
  });

  // ── 2. Contact update with an ambiguous address ───────────────────────────
  it("Case 2: Contact update with an ambiguous address (multiple matches)", () => {
    const ticket = {
      id: "ticket-contact-2",
      ticketNumber: "CSA-302",
      subject: "Update contact details for Newmarket address to 7448122377",
      customerName: "Bruce Wayne",
      customerEmail: "bruce@wayne-enterprises.com",
      customerId: "cust-102",
    };

    const customerData = {
      id: "cust-102",
      email: "bruce@wayne-enterprises.com",
      version: 2,
      targets: [
        { id: "addr-nm-1", label: "10 Newmarket Road, Manor, US", phone: "1112223333" },
        { id: "addr-nm-2", label: "25 Newmarket Crescent, Gotham, US", phone: "4445556666" },
      ],
    };

    const result = investigateTicket(ticket, customerData);

    expect(result.intent).toBe("contact_update");
    expect(result.canResolveWithAvailableInfo).toBe(false);
    expect(result.ambiguousContactTargets?.length).toBe(2);
    expect(result.missingInfo.some((m) => m.includes("Multiple addresses"))).toBe(true);
    expect(result.clarificationNeeded).toContain("addresses matching");
    expect(result.customerDraft).toContain("confirm which specific address should be updated");

    // Must NOT ask for an order number
    expect(result.customerDraft).not.toContain("order confirmation number");
  });

  // ── 3. WISMO ticket with a linked order ───────────────────────────────────
  it("Case 3: WISMO ticket with a linked order", () => {
    const ticket = {
      id: "ticket-wismo-1",
      ticketNumber: "CSA-303",
      subject: "Where is my order? Delivery delayed",
      customerName: "Barry Allen",
      customerEmail: "barry@centralcity.gov",
      orderNumber: "ORD-9981",
    };

    const orderData = {
      id: "ord-9981",
      orderNumber: "ORD-9981",
      shipmentState: "Delayed",
      shippingAddress: {
        city: "Central City",
        state: "MO",
        country: "US",
      },
    };

    const result = investigateTicket(ticket, null, orderData);

    expect(result.intent).toBe("order_tracking");
    expect(result.entities.orderNumber).toBe("ORD-9981");
    expect(result.canResolveWithAvailableInfo).toBe(true);
    expect(result.availableInfo.some((a) => a.includes("Delayed"))).toBe(true);
    expect(result.customerDraft).toContain("ORD-9981");
    expect(result.customerDraft).toContain("Delayed");
    expect(result.customerDraft).toContain("Central City");
  });

  // ── 4. WISMO ticket with no order number ──────────────────────────────────
  it("Case 4: WISMO ticket with no order number (honestly requests confirmation number)", () => {
    const ticket = {
      id: "ticket-wismo-2",
      ticketNumber: "CSA-304",
      subject: "Package has not arrived yet, where is it?",
      customerName: "Clark Kent",
      customerEmail: "clark@dailyplanet.com",
      orderNumber: undefined,
    };

    const result = investigateTicket(ticket, null, null);

    expect(result.intent).toBe("order_tracking");
    expect(result.canResolveWithAvailableInfo).toBe(false);
    expect(result.missingInfo.some((m) => m.includes("Order confirmation number missing"))).toBe(true);
    expect(result.clarificationNeeded).toContain("Order confirmation number is required");
    expect(result.customerDraft).toContain("could you please provide your order confirmation number");

    // Never fabricates an order number
    expect(result.customerDraft).not.toContain("ORD-");
  });

  // ── 5. Refund request requiring human approval ────────────────────────────
  it("Case 5: Refund request requiring supervisor/human approval (high-risk financial action)", () => {
    const ticket = {
      id: "ticket-refund-1",
      ticketNumber: "CSA-305",
      subject: "I want a full refund, item arrived broken",
      customerName: "Arthur Curry",
      customerEmail: "arthur@atlantis.org",
      orderNumber: "ORD-7711",
    };

    const result = investigateTicket(ticket, null, null);

    expect(result.intent).toBe("return_refund");
    expect(result.isHighRiskFinancial).toBe(true);
    expect(result.canResolveWithAvailableInfo).toBe(false);
    expect(result.missingInfo.some((m) => m.includes("Supervisor approval required"))).toBe(true);
    expect(result.summary).toContain("High-risk financial action requires human approval");

    // Autonomous write must be locked
    expect(result.internalWorklog).toContain("Autonomous write blocked");
  });

  // ── 6. General inquiry requiring no mutation ──────────────────────────────
  it("Case 6: General inquiry requiring no mutation (never asks for an order number)", () => {
    const ticket = {
      id: "ticket-general-1",
      ticketNumber: "CSA-306",
      subject: "Are your wireless chargers compatible with iPhone 16 Pro Max?",
      message: "Can I use the dual charging pad with the new phone case?",
      customerName: "Victor Stone",
      customerEmail: "vic@star-labs.org",
    };

    const result = investigateTicket(ticket, null, null);

    expect(result.intent).toBe("product_inquiry");
    expect(result.canResolveWithAvailableInfo).toBe(true);
    expect(result.missingInfo.length).toBe(0);
    expect(result.proposedStatus).toBe("Resolved");

    // CRITICAL: Must NEVER ask for an order number for a product compatibility question!
    expect(result.customerDraft).not.toContain("order confirmation number");
    expect(result.requiredInfo).not.toContain("Order Confirmation Number");
  });

  // ── 7. Missing customer record or unavailable integration ─────────────────
  it("Case 7: Missing customer record or unavailable integration handled gracefully", () => {
    const ticket = {
      id: "ticket-contact-3",
      ticketNumber: "CSA-307",
      subject: "Please update contact details for Newmarket address to 7448122377",
      customerName: "Unknown Guest",
      customerEmail: "guest-unregistered@example.com",
    };

    // Customer profile absent in commerce store
    const result = investigateTicket(ticket, null);

    expect(result.intent).toBe("contact_update");
    expect(result.canResolveWithAvailableInfo).toBe(false);
    expect(result.missingInfo.some((m) => m.includes("No addresses found"))).toBe(true);
    expect(result.clarificationNeeded).toContain("no recorded addresses");
  });

  // ── 8. Backend failure or stale record during execution ────────────────────
  it("Case 8: Backend failure and stale-record concurrency protection", async () => {
    const projectKey = "p3-val-project";
    const owner = { clientId: "p3-val-client", includeLegacy: false };

    const ticket = await createTicket(
      {
        projectKey,
        subject: "Dynamic Execution Concurrency",
        status: "Open",
      },
      owner
    );

    const initialTimestamp = ticket.lastModifiedAt!;

    // Concurrently mutate ticket in database
    await new Promise((r) => setTimeout(r, 10));
    await updateTicket(ticket.id, { projectKey, status: "In Progress" }, owner);

    // Stale timestamp rejection
    const staleResult = await closeIfUnchanged(
      ticket.id,
      initialTimestamp, // Outdated timestamp
      projectKey,
      owner,
      "Resolution"
    );

    expect(staleResult).toBeNull(); // Server-side concurrency guard rejects stale update!
  });
});
