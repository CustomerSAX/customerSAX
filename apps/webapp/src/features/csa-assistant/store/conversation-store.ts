"use client";

import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  orderCount?: number;
  lifetimeValue?: string;
  status?: string;
}

export interface OrderInfo {
  id: string;
  orderNumber?: string;
  status?: string;
  total?: string;
  date?: string;
}

export interface TicketInfo {
  id: string;
  ticketNumber?: string;
  subject?: string;
  status?: string;
  description?: string;
  lastModifiedAt?: string;
  createdAt?: string;
}

export interface InsightInfo {
  intent?: string;
  sentiment?: string;
  confidence: number;
}

export interface ResolutionInfo {
  strategy?: string;
  nextSteps?: string[];
}

export interface OrderWorkflowSnapshot {
  customer: { id?: string; name?: string; email?: string } | null;
  cart: {
    cartId?: string;
    items: Array<{ sku?: string; name: string; price?: string; quantity: number }>;
    itemCount?: number;
    total?: string;
  } | null;
  pendingApproval: { action?: string; summary?: string } | null;
  placedOrder: { orderId?: string; orderNumber?: string; total?: string } | null;
}

export interface TicketWorkflowSnapshot {
  pendingApproval: { action?: string; summary?: string } | null;
  createdTicket: { ticketNumber?: string; id?: string } | null;
}

export interface ReturnWorkflowSnapshot {
  order: {
    id?: string;
    orderNumber?: string;
    customerName?: string;
    total?: string;
    lineItems: Array<{ name?: string; quantity: number; price?: string }>;
  } | null;
  eligibility: { eligible: boolean; reason?: string } | null;
  pendingApproval: { action?: string; summary?: string } | null;
  completed: { type: 'return' | 'refund'; orderNumber?: string; summary?: string } | null;
}

interface ConversationStoreState {
  // Active context
  activeTicketId: string | null;
  customer: CustomerInfo | null;
  context: {
    orders: OrderInfo[];
    tickets: TicketInfo[];
  };
  contextLoading: boolean;

  // AI analysis
  insights: InsightInfo;
  resolution: ResolutionInfo;
  machineState: string;

  // UI state
  rightPanelTab: "intelligence" | "chatHistory" | "memory";
  rightPanelOpen: boolean;
  activeStepper: "order" | "ticket" | "return" | null;
  /**
   * Bumped every time the agent clicks "New Conversation". ChatStream/index.tsx
   * watches this to clear the actual AI SDK message list — activeTicketId
   * alone isn't enough: it only clears messages when the effect keyed on it
   * sees a truthy id (switching TO a ticket). Clicking "New Conversation"
   * sets activeTicketId to null, which that effect's guard skips entirely, so
   * the old chat transcript stayed on screen even though the rest of the
   * panel (customer, AI Analysis) correctly reset.
   */
  newConversationNonce: number;

  // Workflows
  orderWorkflow: OrderWorkflowSnapshot | null;
  ticketWorkflow: TicketWorkflowSnapshot | null;
  returnWorkflow: ReturnWorkflowSnapshot | null;

  // Actions
  setActiveTicketId: (id: string | null) => void;
  setCustomer: (c: CustomerInfo | null) => void;
  setContextLoading: (loading: boolean) => void;
  setContextHydrated: (type: "Customer" | "Order" | "Ticket", data: Record<string, unknown>) => void;
  setInsights: (insights: InsightInfo) => void;
  setResolution: (resolution: ResolutionInfo) => void;
  setMachineState: (state: string) => void;
  setRightPanelTab: (tab: "intelligence" | "chatHistory" | "memory") => void;
  setRightPanelOpen: (open: boolean) => void;
  setActiveStepper: (stepper: "order" | "ticket" | "return" | null) => void;
  setOrderWorkflow: (workflow: OrderWorkflowSnapshot | null) => void;
  setTicketWorkflow: (workflow: TicketWorkflowSnapshot | null) => void;
  setReturnWorkflow: (workflow: ReturnWorkflowSnapshot | null) => void;
  resetTicketContext: () => void;
  /** Bumps newConversationNonce — see its doc comment. */
  startNewConversation: () => void;
}

const EMPTY_INSIGHTS: InsightInfo = { confidence: 0 };
const EMPTY_RESOLUTION: ResolutionInfo = {};

export const useConversationStore = create<ConversationStoreState>((set) => ({
  // Initial state
  activeTicketId: null,
  customer: null,
  context: { orders: [], tickets: [] },
  contextLoading: false,
  insights: EMPTY_INSIGHTS,
  resolution: EMPTY_RESOLUTION,
  machineState: "OPEN",
  rightPanelTab: "intelligence",
  rightPanelOpen: false,
  activeStepper: null,
  orderWorkflow: null,
  ticketWorkflow: null,
  returnWorkflow: null,
  newConversationNonce: 0,

  // Actions
  setActiveTicketId: (id) => set({ activeTicketId: id }),

  setCustomer: (c) => set({ customer: c }),

  setContextLoading: (loading) => set({ contextLoading: loading }),

  setContextHydrated: (type, data) => {
    if (type === "Customer") {
      set({
        customer: {
          id: String(data.id ?? ""),
          name: String(data.name ?? ""),
          email: data.email ? String(data.email) : undefined,
          phone: data.phone ? String(data.phone) : undefined,
          createdAt: data.createdAt ? String(data.createdAt) : undefined,
          orderCount: typeof data.orderCount === "number" ? data.orderCount : undefined,
          lifetimeValue: data.lifetimeValue ? String(data.lifetimeValue) : undefined,
          status: data.status ? String(data.status) : undefined,
        },
        contextLoading: false,
      });
    } else if (type === "Order") {
      set((s) => ({
        context: {
          ...s.context,
          orders: [
            {
              id: String(data.id ?? ""),
              orderNumber: data.orderNumber ? String(data.orderNumber) : undefined,
              status: data.status ? String(data.status) : undefined,
              total: data.total ? String(data.total) : undefined,
              date: data.date ? String(data.date) : undefined,
            },
          ],
        },
      }));
    } else if (type === "Ticket") {
      set((s) => ({
        context: {
          ...s.context,
          tickets: [
            {
              id: String(data.id ?? ""),
              ticketNumber: data.ticketNumber ? String(data.ticketNumber) : undefined,
              subject: data.subject ? String(data.subject) : undefined,
              status: data.status ? String(data.status) : undefined,
              description: data.description ? String(data.description) : undefined,
            },
          ],
        },
      }));
    }
  },

  setInsights: (insights) => set({ insights }),
  setResolution: (resolution) => set({ resolution }),
  setMachineState: (state) => set({ machineState: state }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setActiveStepper: (stepper) => set({ activeStepper: stepper }),
  setOrderWorkflow: (workflow) => set({ orderWorkflow: workflow }),
  setTicketWorkflow: (workflow) => set({ ticketWorkflow: workflow }),
  setReturnWorkflow: (workflow) => set({ returnWorkflow: workflow }),
  resetTicketContext: () => set({
    activeTicketId: null,
    customer: null,
    context: { orders: [], tickets: [] },
    insights: EMPTY_INSIGHTS,
    resolution: EMPTY_RESOLUTION,
    machineState: "OPEN",
    orderWorkflow: null,
    ticketWorkflow: null,
    returnWorkflow: null,
    activeStepper: null
  }),
  startNewConversation: () => set((s) => ({ newConversationNonce: s.newConversationNonce + 1 })),
}));
