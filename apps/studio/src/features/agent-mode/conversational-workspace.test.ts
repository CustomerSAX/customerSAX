import { describe, it, expect } from "vitest";
import {
  buildStartMyDayBriefing,
  getTimeAppropriateGreeting,
  isStartMyDayIntent,
  rankOperationalItems,
  resolveFollowUpReference,
} from "./api/start-my-day";
import { investigateTicket } from "./api/investigation-engine";
import type { AgentTask } from "./types";

describe("CustomerX Agent Mode - Minimal Conversational Workspace & Start My Day", () => {
  const sampleTasks: AgentTask[] = [
    {
      id: "t-normal-1",
      type: "ticket",
      referenceNumber: "CSA-101",
      title: "Question regarding product manual",
      customerName: "Alice Walker",
      customerEmail: "alice@example.com",
      status: "open",
      priority: "normal",
      urgencyReason: "Open Ticket",
      createdAt: "2026-10-23T06:00:00Z",
      rawRecord: {},
    },
    {
      id: "t-urgent-1",
      type: "ticket",
      referenceNumber: "CSA-102",
      title: "Broken item received on delivery",
      customerName: "Bob Miller",
      customerEmail: "bob@example.com",
      status: "open",
      priority: "urgent",
      urgencyReason: "Urgent Priority",
      orderNumber: "ORD-9981",
      createdAt: "2026-10-23T05:00:00Z",
      rawRecord: {},
    },
    {
      id: "o-delayed-1",
      type: "order",
      referenceNumber: "ORD-8812",
      title: "Order ORD-8812 (2 items)",
      customerName: "Charlie Brown",
      customerEmail: "charlie@example.com",
      status: "Delayed",
      priority: "urgent",
      urgencyReason: "Delayed in Transit",
      totalPrice: "$185.00",
      createdAt: "2026-10-22T14:00:00Z",
      rawRecord: {},
    },
    {
      id: "q-pending-1",
      type: "quote",
      referenceNumber: "Q-300",
      title: "Quote Q-300 • Wayne Enterprises",
      customerName: "Wayne Enterprises",
      customerEmail: "bruce@wayne.com",
      status: "Submitted",
      priority: "high",
      urgencyReason: "Pending Review",
      totalPrice: "$12,400.00",
      createdAt: "2026-10-23T04:30:00Z",
      rawRecord: {},
    },
  ];

  // ── 1. Greeting & Local Time ──────────────────────────────────────────────
  describe("1. Time-appropriate Greetings", () => {
    it("returns 'Good morning' for hours before 12:00", () => {
      const morningDate = new Date("2026-10-23T09:15:00");
      expect(getTimeAppropriateGreeting(morningDate)).toBe("Good morning");
    });

    it("returns 'Good afternoon' for hours between 12:00 and 17:00", () => {
      const afternoonDate = new Date("2026-10-23T14:30:00");
      expect(getTimeAppropriateGreeting(afternoonDate)).toBe("Good afternoon");
    });

    it("returns 'Good evening' for hours 17:00 and later", () => {
      const eveningDate = new Date("2026-10-23T19:45:00");
      expect(getTimeAppropriateGreeting(eveningDate)).toBe("Good evening");
    });
  });

  // ── 2. Start My Day Briefing ──────────────────────────────────────────────
  describe("2. Start My Day Briefing Generation", () => {
    it("produces a concise, grounded briefing with real counts from real records", () => {
      const morningDate = new Date("2026-10-23T08:30:00");
      const summary = buildStartMyDayBriefing(sampleTasks, "Sarah Connor", morningDate);

      // Real counts
      expect(summary.urgentTicketsCount).toBe(1);
      expect(summary.delayedOrdersCount).toBe(1);
      expect(summary.pendingFollowupsCount).toBe(1);
      expect(summary.totalAttentionCount).toBe(3);

      // Personalized greeting
      expect(summary.greeting).toBe("Good morning, Sarah!");

      // Text mentions real items and real references
      expect(summary.briefingText).toContain("1 urgent ticket");
      expect(summary.briefingText).toContain("1 order at risk of delayed delivery");
      expect(summary.briefingText).toContain("1 pending follow-up");
      expect(summary.briefingText).toContain("CSA-102");
      expect(summary.briefingText).toContain("ORD-8812");
      expect(summary.briefingText).toContain("Q-300");

      // Recommends starting with the urgent ticket
      expect(summary.recommendedTask?.referenceNumber).toBe("CSA-102");
      expect(summary.briefingText).toContain("I recommend starting with the urgent ticket **CSA-102**");
    });

    it("handles an empty queue cleanly without hallucinating tasks", () => {
      const summary = buildStartMyDayBriefing([], "Alex", new Date("2026-10-23T10:00:00"));

      expect(summary.urgentTicketsCount).toBe(0);
      expect(summary.delayedOrdersCount).toBe(0);
      expect(summary.pendingFollowupsCount).toBe(0);
      expect(summary.recommendedTask).toBeNull();
      expect(summary.briefingText).toContain("Your queue is currently clear");
      expect(summary.briefingText).not.toContain("ORD-");
      expect(summary.briefingText).not.toContain("CSA-");
    });
  });

  // ── 3. Operational Ranking Heuristics ─────────────────────────────────────
  describe("3. Operational Priority Ranking", () => {
    it("ranks urgent tickets first, delayed orders second, quotes third, normal tickets fourth", () => {
      const ranked = rankOperationalItems(sampleTasks);

      expect(ranked[0].referenceNumber).toBe("CSA-102"); // Urgent ticket
      expect(ranked[1].referenceNumber).toBe("ORD-8812"); // Urgent delayed order
      expect(ranked[2].referenceNumber).toBe("Q-300");    // High quote
      expect(ranked[3].referenceNumber).toBe("CSA-101");  // Normal ticket
    });
  });

  // ── 4. Conversational Reference Resolution ─────────────────────────────────
  describe("4. Conversational Follow-up Reference Resolution", () => {
    it("resolves direct ticket and order reference numbers", () => {
      const targetTicket = resolveFollowUpReference("Investigate ticket CSA-102 please", sampleTasks);
      expect(targetTicket?.id).toBe("t-urgent-1");

      const targetOrder = resolveFollowUpReference("Check the status of ORD-8812", sampleTasks);
      expect(targetOrder?.id).toBe("o-delayed-1");
    });

    it("resolves positional references ('first ticket', 'second order')", () => {
      const firstTicket = resolveFollowUpReference("Let's look into the first ticket", sampleTasks);
      expect(firstTicket?.referenceNumber).toBe("CSA-101");

      const firstOrder = resolveFollowUpReference("What about the first order?", sampleTasks);
      expect(firstOrder?.referenceNumber).toBe("ORD-8812");
    });

    it("resolves ordinal references ('investigate it', 'start with the first')", () => {
      const ranked = rankOperationalItems(sampleTasks);
      const topPick = resolveFollowUpReference("Yes please investigate it", ranked);
      expect(topPick?.referenceNumber).toBe("CSA-102");
    });

    it("resolves references by customer name", () => {
      const charlieOrder = resolveFollowUpReference("Open Charlie Brown's case", sampleTasks);
      expect(charlieOrder?.referenceNumber).toBe("ORD-8812");
    });
  });

  // ── 5. Contact Update Behavior (Section 7 Verification) ───────────────────
  describe("5. Contact Update Investigation Rules", () => {
    it("investigates Newmarket address and never asks for an order number", () => {
      const ticket = {
        id: "t-nm-1",
        ticketNumber: "CSA-401",
        subject: "Update the phone number for the customer's Newmarket address to 7448122377",
        customerName: "Jane Miller",
        customerEmail: "jane@example.com",
        customerId: "cust-99",
      };

      const customerData = {
        id: "cust-99",
        email: "jane@example.com",
        version: 3,
        targets: [
          { id: "addr-nm", label: "74 Newmarket Boulevard, Boston, US", phone: "5551112222" },
          { id: "addr-other", label: "12 Pine Street, Seattle, US", phone: "5553334444" },
        ],
      };

      const result = investigateTicket(ticket, customerData);

      expect(result.intent).toBe("contact_update");
      expect(result.entities.phone).toBe("7448122377");
      expect(result.matchedContactTarget?.id).toBe("addr-nm");
      expect(result.canResolveWithAvailableInfo).toBe(true);

      // Verifies phone update is prepared
      expect(result.proposedChanges[0].field).toBe("Address Phone Number");
      expect(result.proposedChanges[0].previousValue).toBe("5551112222");
      expect(result.proposedChanges[0].proposedValue).toBe("7448122377");

      // Strictly verifies that order confirmation number is NOT requested
      expect(result.customerDraft).not.toContain("order confirmation number");
      expect(result.customerDraft).not.toContain("order number");
      expect(result.requiredInfo).not.toContain("Order Confirmation Number");
    });
  });

  // ── 6. Start My Day Intent Recognition Across Conversation States ─────────
  describe("6. Start My Day Intent Detection", () => {
    it("recognizes natural language Start My Day prompts from any conversation state", () => {
      expect(isStartMyDayIntent("Start My Day")).toBe(true);
      expect(isStartMyDayIntent("start my day")).toBe(true);
      expect(isStartMyDayIntent("start day")).toBe(true);
      expect(isStartMyDayIntent("start my shift")).toBe(true);
      expect(isStartMyDayIntent("daily briefing")).toBe(true);
      expect(isStartMyDayIntent("Give me my daily briefing")).toBe(true);
      expect(isStartMyDayIntent("fetch today's briefing")).toBe(true);
      expect(isStartMyDayIntent("what should I do today")).toBe(true);
      expect(isStartMyDayIntent("what's on my plate")).toBe(true);
      expect(isStartMyDayIntent("what needs attention today")).toBe(true);
      expect(isStartMyDayIntent("refresh briefing")).toBe(true);
    });

    it("does not false-positive on unrelated commands", () => {
      expect(isStartMyDayIntent("Hello")).toBe(false);
      expect(isStartMyDayIntent("Investigate ticket CSA-102")).toBe(false);
      expect(isStartMyDayIntent("Show order ORD-8812")).toBe(false);
      expect(isStartMyDayIntent("Update phone number to 555-1234")).toBe(false);
      expect(isStartMyDayIntent("")).toBe(false);
    });
  });

  // ── 7. Priority and Urgent Follow-up Resolution ────────────────────────────
  describe("7. Priority and Urgent Follow-up Resolution", () => {
    it("resolves 'the most urgent ticket' to highest priority item", () => {
      const topTicket = resolveFollowUpReference("Let's work on the most urgent ticket", sampleTasks);
      expect(topTicket?.referenceNumber).toBe("CSA-102");
      expect(topTicket?.priority).toBe("urgent");
    });

    it("resolves 'top priority ticket' to highest priority item", () => {
      const topTicket = resolveFollowUpReference("Investigate the top priority ticket", sampleTasks);
      expect(topTicket?.referenceNumber).toBe("CSA-102");
    });

    it("resolves 'resolve the first ticket' correctly to the first positional ticket", () => {
      const resolved = resolveFollowUpReference("Let's resolve the first ticket", sampleTasks);
      expect(resolved?.referenceNumber).toBe("CSA-101");
    });
  });
});

