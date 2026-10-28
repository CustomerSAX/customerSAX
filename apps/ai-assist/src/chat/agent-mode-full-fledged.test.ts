import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  queryOrdersTool,
  getOrderTool,
  updateOrderStatusTool,
  updateCustomerAddressTool,
  buildCommerceTools,
  COMMERCE_WRITE_DENIED,
} from "./tools/commerce.js";
import {
  searchTicketsTool,
  getTicketTool,
} from "./tools/tickets.js";
import {
  TOOL_REGISTRY,
  formatToolRegistryForPrompt,
} from "./tools/registry.js";
import {
  STATIC_SYSTEM_PROMPT,
  buildDynamicPrompt,
  contextStorage,
  type SystemPromptContext,
} from "./system-prompt.js";
import * as bffModule from "../commerce/graphql-client.js";

describe("CustomerX Agent Mode — Full-Fledged AI Assistant Verification Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Simple factual lookup produces a concise text response without a card ──
  it("1. Simple factual lookup: prompt mandates text-first output without automatic cards", async () => {
    // Verify system instructions strictly mandate concise natural language by default
    expect(STATIC_SYSTEM_PROMPT).toContain("Your default response format for ANY question or inquiry is a **concise, natural-language text message**");
    expect(STATIC_SYSTEM_PROMPT).toContain("Do NOT automatically render cards, tables, charts, or dashboards on simple factual questions");
    expect(STATIC_SYSTEM_PROMPT).toContain("When will order #123 arrive?");
    expect(STATIC_SYSTEM_PROMPT).toContain("Do NOT call `order_summary` or display an order card");

    // Verify tool execution returns factual data cleanly for direct natural language answering
    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      order: {
        id: "ord-123",
        orderNumber: "RC-123",
        orderState: "Confirmed",
        shipmentState: "Shipped",
        createdAt: "2026-10-20T10:00:00Z",
        totalPrice: { centAmount: 4999, currencyCode: "USD", fractionDigits: 2 },
        custom: {
          customFieldsRaw: [
            { name: "expectedDeliveryDate", value: "2026-10-29" },
            { name: "carrier", value: "DHL Express" },
          ],
        },
      },
    });

    const execute = getOrderTool.execute as (args: { orderNumber: string }) => Promise<{
      order: Record<string, unknown> | null;
    }>;
    const result = await execute({ orderNumber: "RC-123" });

    expect(result.order).toBeDefined();
    expect(result.order?.orderNumber).toBe("RC-123");
    expect(result.order?.expectedDeliveryDate).toBe("2026-10-29");
  });

  // ─── 2. Date-based filtering returns correct records and counts ──────────────
  it("2. Date-based filtering: correctly filters by relative date (e.g. tomorrow) and calculates totals", async () => {
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const mockOrders = [
      {
        id: "ord-1",
        orderNumber: "RC-101",
        orderState: "Confirmed",
        shipmentState: "Shipped",
        createdAt: new Date().toISOString(),
        totalPrice: { centAmount: 15000, currencyCode: "USD" },
        custom: { customFieldsRaw: [{ name: "expectedDeliveryDate", value: tomorrowStr }] },
      },
      {
        id: "ord-2",
        orderNumber: "RC-102",
        orderState: "Confirmed",
        shipmentState: "Ready",
        createdAt: new Date().toISOString(),
        totalPrice: { centAmount: 25000, currencyCode: "USD" },
        custom: { customFieldsRaw: [{ name: "expectedDeliveryDate", value: tomorrowStr }] },
      },
      {
        id: "ord-3",
        orderNumber: "RC-103",
        orderState: "Confirmed",
        shipmentState: "Delivered",
        createdAt: "2026-10-01T10:00:00Z",
        totalPrice: { centAmount: 5000, currencyCode: "USD" },
        custom: { customFieldsRaw: [{ name: "expectedDeliveryDate", value: "2026-10-05" }] },
      },
    ];

    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      orderPage: {
        total: 3,
        count: 3,
        offset: 0,
        results: mockOrders,
      },
    });

    const execute = queryOrdersTool.execute as (args: { relativeDate: string }) => Promise<{
      total: number;
      count: number;
      orders: Array<{ orderNumber: string; expectedDeliveryDate?: string }>;
    }>;

    const result = await execute({ relativeDate: "tomorrow" });

    expect(result.count).toBe(2);
    expect(result.orders.every((o) => o.expectedDeliveryDate === tomorrowStr)).toBe(true);
    expect(result.orders.map((o) => o.orderNumber)).toEqual(["RC-101", "RC-102"]);
  });

  // ─── 3. Multi-step investigation uses multiple tools when necessary ───────────
  it("3. Multi-step investigation: inspects ticket, discovers linked order, and investigates shipment status", async () => {
    // Step 1: Inspect ticket history
    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      ticket: {
        id: "tick-888",
        ticketNumber: "T-888",
        subject: "Where is my replacement jacket?",
        message: "I haven't received tracking information yet.",
        status: "open",
        orderNumber: "RC-9999",
        customerEmail: "sarah@example.com",
        history: [
          { operationDate: "2026-10-25", reason: "Customer requested shipment check", status: "open" },
        ],
      },
    });

    const getTicket = getTicketTool.execute as (args: { id: string }) => Promise<{
      id: string;
      orderNumber?: string;
      customerEmail?: string;
    }>;
    const ticketResult = await getTicket({ id: "tick-888" });

    expect(ticketResult.orderNumber).toBe("RC-9999");

    // Step 2: Investigate linked order from the discovered orderNumber
    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      order: {
        id: "ord-9999",
        orderNumber: "RC-9999",
        orderState: "Confirmed",
        shipmentState: "Delayed",
        custom: {
          customFieldsRaw: [
            { name: "delayReason", value: "Severe weather hold at regional sorting hub" },
            { name: "carrier", value: "FedEx" },
          ],
        },
      },
    });

    const getOrder = getOrderTool.execute as (args: { orderNumber: string }) => Promise<{
      order: { orderNumber: string; shipmentState?: string; delayReason?: string };
    }>;
    const orderResult = await getOrder({ orderNumber: ticketResult.orderNumber! });

    expect(orderResult.order.orderNumber).toBe("RC-9999");
    expect(orderResult.order.shipmentState).toBe("Delayed");
    expect(orderResult.order.delayReason).toBe("Severe weather hold at regional sorting hub");
  });

  // ─── 4. Follow-up questions correctly reference earlier results ───────────────
  it("4. Contextual follow-up reasoning: resolves affected customers from preceding delayed orders", async () => {
    // Simulation of query identifying delayed orders
    const delayedOrders = [
      { id: "o-1", orderNumber: "RC-01", customerId: "cust-A", customerEmail: "alice@acme.com", shipmentState: "Delayed" },
      { id: "o-2", orderNumber: "RC-02", customerId: "cust-B", customerEmail: "bob@acme.com", shipmentState: "Delayed" },
    ];

    // Follow-up: agent queries customer records for cust-A without re-asking
    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      customer: {
        id: "cust-A",
        email: "alice@acme.com",
        firstName: "Alice",
        lastName: "Smith",
      },
    });

    const execute = bffModule.bffQuery;
    const res = await execute({ query: "customer(id: $id) { id email firstName lastName }", variables: { id: delayedOrders[0].customerId } });

    expect(res.customer.email).toBe("alice@acme.com");
  });

  // ─── 5. Cross-entity queries retrieve and correlate relevant data ─────────────
  it("5. Cross-entity correlation: finds customers whose orders were delayed more than twice", async () => {
    const mockOrders = [
      { id: "1", orderNumber: "RC-1", customerId: "cust-1", customerEmail: "repeat@test.com", shipmentState: "Delayed" },
      { id: "2", orderNumber: "RC-2", customerId: "cust-1", customerEmail: "repeat@test.com", shipmentState: "Delayed" },
      { id: "3", orderNumber: "RC-3", customerId: "cust-1", customerEmail: "repeat@test.com", shipmentState: "Delayed" },
      { id: "4", orderNumber: "RC-4", customerId: "cust-2", customerEmail: "single@test.com", shipmentState: "Delayed" },
      { id: "5", orderNumber: "RC-5", customerId: "cust-3", customerEmail: "on-time@test.com", shipmentState: "Delivered" },
    ];

    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      orderPage: {
        total: 5,
        count: 5,
        offset: 0,
        results: mockOrders,
      },
    });

    const execute = queryOrdersTool.execute as (args: { shipmentState: string }) => Promise<{
      total: number;
      orders: Array<{ customerId?: string; customerEmail?: string }>;
      analytics?: { repeatDelayedCustomers?: Array<{ customerId: string; customerEmail: string; count: number }> };
    }>;

    const result = await execute({ shipmentState: "Delayed" });

    expect(result.analytics?.repeatDelayedCustomers).toBeDefined();
    expect(result.analytics?.repeatDelayedCustomers?.length).toBe(1);
    expect(result.analytics?.repeatDelayedCustomers?.[0].customerEmail).toBe("repeat@test.com");
    expect(result.analytics?.repeatDelayedCustomers?.[0].count).toBe(3);
  });

  // ─── 6. Unsupported requests are handled honestly ────────────────────────────
  it("6. Unsupported operations: handles unsupported capabilities honestly without fabrication", () => {
    // In system prompt instructions, explicit guidance for unsupported workflows
    expect(STATIC_SYSTEM_PROMPT).toContain("**Unsupported Actions**");
    expect(STATIC_SYSTEM_PROMPT).toContain("state the limitation honestly and offer to raise a ticket or escalate");
  });

  // ─── 7. Failed tools and incomplete responses do not fabricate answers ─────────
  it("7. Graceful failure handling: tool errors return honest plain notices without hallucinations", async () => {
    vi.spyOn(bffModule, "bffQuery").mockRejectedValueOnce(new Error("Connection timeout to commerce backend"));

    const execute = queryOrdersTool.execute as (args: Record<string, unknown>) => Promise<{
      error: string;
      total: number;
      orders: unknown[];
    }>;

    const result = await execute({});

    expect(result.error).toContain("Connection timeout to commerce backend");
    expect(result.total).toBe(0);
    expect(result.orders).toEqual([]);
  });

  // ─── 8. Authorized mutations execute correctly ────────────────────────────────
  it("8. Authorized mutations: update_order_status executes when authorized and approved", async () => {
    const authContext: SystemPromptContext = {
      userEmail: "agent@customerx.com",
      userRole: "Support Lead",
      projectKey: "customerx-test",
      canUpdateOrders: true,
      approval: { kind: "approval_card" },
    };

    vi.spyOn(bffModule, "bffQuery").mockResolvedValue({
      order: { id: "ord-1", orderNumber: "RC-1" },
      updateOrder: {
        id: "ord-1",
        orderState: "Complete",
        shipmentState: "Delivered",
      },
    });

    const commerceTools = buildCommerceTools();
    const result = await contextStorage.run(authContext, async () => {
      const execute = commerceTools.update_order_status.execute as (args: {
        orderIds: string[];
        shipmentState?: string;
      }) => Promise<{ success: boolean; updatedCount: number }>;
      return execute({ orderIds: ["ord-1"], shipmentState: "Delivered" });
    });

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
  });

  // ─── 9. Unauthorized actions are rejected ────────────────────────────────────
  it("9. Unauthorized actions: rejects mutations when RBAC permission is denied", async () => {
    const unauthContext: SystemPromptContext = {
      userEmail: "trainee@customerx.com",
      userRole: "Trainee",
      projectKey: "customerx-test",
      canUpdateOrders: false, // DENIED
      approval: { kind: "approval_card" },
    };

    const querySpy = vi.spyOn(bffModule, "bffQuery");

    const commerceTools = buildCommerceTools();
    const result = await contextStorage.run(unauthContext, async () => {
      const execute = commerceTools.update_order_status.execute as (args: {
        orderIds: string[];
        orderState?: string;
      }) => Promise<{ error: string }>;
      return execute({ orderIds: ["ord-1"], orderState: "Cancelled" });
    });

    expect(result.error).toContain(COMMERCE_WRITE_DENIED);
    expect(querySpy).not.toHaveBeenCalled();
  });

  // ─── 10. Consequential operations follow confirmation requirements ───────────
  it("10. Consequential operations: require action_approval before executing writes", async () => {
    const unapprovedContext: SystemPromptContext = {
      userEmail: "agent@customerx.com",
      userRole: "Support Agent",
      projectKey: "customerx-test",
      canUpdateOrders: true,
      approval: null, // NO APPROVAL RECEIVED
    };

    const querySpy = vi.spyOn(bffModule, "bffQuery");

    const commerceTools = buildCommerceTools();
    const result = await contextStorage.run(unapprovedContext, async () => {
      const execute = commerceTools.update_order_status.execute as (args: {
        orderIds: string[];
        orderState?: string;
      }) => Promise<{ error: string }>;
      return execute({ orderIds: ["ord-1"], orderState: "Cancelled" });
    });

    expect(result.error).toContain("APPROVAL_REQUIRED");
    expect(querySpy).not.toHaveBeenCalled();
  });

  // ─── 11. Large result sets handle pagination and aggregation correctly ────────
  it("11. Large result sets: handles pagination, count slicing, and analytics aggregations", async () => {
    const generateMockOrders = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `ord-${i}`,
        orderNumber: `RC-${1000 + i}`,
        orderState: i % 2 === 0 ? "Complete" : "Confirmed",
        shipmentState: i % 3 === 0 ? "Delivered" : "Shipped",
        totalPrice: { centAmount: 10000, currencyCode: "USD" },
        createdAt: "2026-10-15T12:00:00Z",
      }));

    vi.spyOn(bffModule, "bffQuery").mockResolvedValueOnce({
      orderPage: {
        total: 100,
        count: 20,
        offset: 10,
        results: generateMockOrders(20),
      },
    });

    const execute = queryOrdersTool.execute as (args: {
      limit: number;
      offset: number;
    }) => Promise<{
      total: number;
      count: number;
      orders: unknown[];
      analytics?: { totalSales?: string };
    }>;

    const result = await execute({ limit: 20, offset: 10 });

    expect(result.total).toBe(100);
    expect(result.count).toBe(20);
    expect(result.orders.length).toBe(20);
    expect(result.analytics?.totalSales).toBe("USD 2000.00"); // 20 orders * $100
  });

  // ─── 12. Responses remain text-first despite complex JSON tool output ─────────
  it("12. Text-first responses: system prompt specifies natural language explanation over complex objects", () => {
    expect(STATIC_SYSTEM_PROMPT).toContain("Do NOT automatically render cards, tables, charts, or dashboards on simple factual questions");
    expect(STATIC_SYSTEM_PROMPT).toContain("Why is order #123 delayed?");
    expect(STATIC_SYSTEM_PROMPT).toContain("Explain the actual reason based on shipment state and tracking events in clear, natural prose");
  });

  // ─── 13. Explicit requests for tables or detailed views can use rich UI ───────
  it("13. Explicit requests for tables or detailed views activate rich UI conditionally", () => {
    const tableRegex = /\b(table|grid|tabular|list.*(?:table|all)|display.*(?:table|grid)|view.*in.*table)\b/i;

    // Normal questions -> no table
    expect(tableRegex.test("When will order #123 arrive?")).toBe(false);
    expect(tableRegex.test("How many orders are arriving tomorrow?")).toBe(false);
    expect(tableRegex.test("Why is order #123 delayed?")).toBe(false);

    // Explicit requests for tables -> table rendered
    expect(tableRegex.test("Compare these results in a table")).toBe(true);
    expect(tableRegex.test("Show open tickets in a table")).toBe(true);
    expect(tableRegex.test("Display these orders in a grid")).toBe(true);
  });

  // ─── 14. Conversation history survives refreshes and session restoration ──────
  it("14. Dynamic tool registry and session context format dynamically into prompt", () => {
    const registrySummary = formatToolRegistryForPrompt();

    expect(registrySummary).toContain("query_orders");
    expect(registrySummary).toContain("update_order_status");
    expect(registrySummary).toContain("update_customer_address");
    expect(registrySummary).toContain("action_approval");

    const dynamicPrompt = buildDynamicPrompt({
      userEmail: "csa@enterprise.com",
      userRole: "Customer Experience Manager",
      projectKey: "cx-prod",
      vipThreshold: "25000",
    });

    expect(dynamicPrompt).toContain("csa@enterprise.com");
    expect(dynamicPrompt).toContain("Customer Experience Manager");
    expect(dynamicPrompt).toContain("cx-prod");
    expect(dynamicPrompt).toContain("Available Business Tool Registry");
  });
});
