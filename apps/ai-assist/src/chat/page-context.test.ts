import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  type SystemPromptContext,
  type StructuredPageContext,
} from "./system-prompt.js";

describe("Customer CX AI Lite - Page Context and Resolution", () => {
  const baseContext: SystemPromptContext = {
    userEmail: "agent@csa.local",
    userRole: "Support Agent",
    projectKey: "csa-test-project",
    canViewOrders: true,
    canViewCustomers: true,
    canViewTickets: true,
    canViewProducts: true,
    canViewCarts: true,
    canCreateTickets: true,
    canUpdateTickets: true,
  };

  it("handles empty pageContext (dashboard/general view)", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      pageContext: null,
    });

    expect(prompt).toContain("Dashboard / list page — no specific record is focused.");
  });

  it("formats order details page context with auto-binding instructions", () => {
    const orderContext: StructuredPageContext = {
      route: "/orders/ord-999",
      pageType: "order_details",
      entityType: "order",
      entityId: "ord-999",
      type: "order",
      id: "ord-999",
      recordSummary: {
        orderNumber: "ORD-999",
        orderState: "Open",
        paymentState: "Paid",
        customerName: "Jane Doe",
        customerId: "cust-123",
        grandTotal: 15000,
        itemCount: 2,
      },
    };

    const prompt = buildSystemPrompt({
      ...baseContext,
      pageContext: orderContext,
    });

    expect(prompt).toContain("Customer CX AI");
    expect(prompt).toContain("The agent is viewing an **order** record");
    expect(prompt).toContain("Order ID: `ord-999`");
    expect(prompt).toContain("ORD-999");
    expect(prompt).toContain("If the user asks \"What's the status of this order?\", \"Create a ticket for this issue\"");
    expect(prompt).toContain("automatically use this order");
  });

  it("formats customer details page context and prompts for order/ticket lookup", () => {
    const customerContext: StructuredPageContext = {
      route: "/customers/cust-456",
      pageType: "customer_details",
      entityType: "customer",
      entityId: "cust-456",
      type: "customer",
      id: "cust-456",
      recordSummary: {
        customerId: "cust-456",
        name: "Rahul Sharma",
        email: "rahul@example.com",
        customerNumber: "CUST-00456",
      },
    };

    const prompt = buildSystemPrompt({
      ...baseContext,
      pageContext: customerContext,
    });

    expect(prompt).toContain("The agent is viewing a **customer** record (Rahul Sharma) [rahul@example.com]");
    expect(prompt).toContain("Customer ID: `cust-456`");
    expect(prompt).toContain("If the user asks about \"their orders\", \"their tickets\", or \"this customer\", resolve immediately to this customer");
  });

  it("formats customer list with visible records and resolution rules (single match vs multiple matches)", () => {
    const listContext: StructuredPageContext = {
      route: "/customers",
      pageType: "customer_list",
      activeFilters: {
        search: "Rahul",
      },
      visibleRecords: [
        {
          id: "cust-rahul-1",
          name: "Rahul Sharma",
          email: "rahul.sharma@example.com",
          identifier: "CUST-1001",
        },
      ],
    };

    const prompt = buildSystemPrompt({
      ...baseContext,
      pageContext: listContext,
    });

    expect(prompt).toContain("customer_list");
    expect(prompt).toContain('**Active search query:** "Rahul"');
    expect(prompt).toContain("Visible records on current page (1 records):");
    expect(prompt).toContain("Name: Rahul Sharma");
    expect(prompt).toContain("rahul.sharma@example.com");
    expect(prompt).toContain("If there is ONE unambiguous match (e.g. one Rahul), use that record's ID");
    expect(prompt).toContain("If multiple records match (e.g. two Rahuls), ask a concise targeted clarification");
  });

  it("enforces context resolution priority in system prompt", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      pageContext: {
        route: "/orders/ord-111",
        pageType: "order_details",
        entityType: "order",
        entityId: "ord-111",
      },
    });

    expect(prompt).toContain("Context Resolution Priority:");
    expect(prompt).toContain("1. **Explicitly referenced record:**");
    expect(prompt).toContain("2. **Current detail-page record:**");
    expect(prompt).toContain("3. **Visible list records:**");
    expect(prompt).toContain("4. **Freshness & Integrity:**");
  });

  it("preserves backward compatibility with simple legacy { type, id } context", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      pageContext: {
        type: "order",
        id: "ord-legacy-555",
      },
    });

    expect(prompt).toContain("The agent is viewing an **order** record");
    expect(prompt).toContain("Order ID: `ord-legacy-555`");
  });
});
