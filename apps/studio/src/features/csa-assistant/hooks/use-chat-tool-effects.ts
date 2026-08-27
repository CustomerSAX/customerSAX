"use client";

import { useEffect } from "react";
import type { UIMessage } from "ai";
import type {
  InsightInfo,
  OrderWorkflowSnapshot,
  ResolutionInfo,
  ReturnWorkflowSnapshot,
  TicketWorkflowSnapshot,
} from "../store/conversation-store";
import { useConversationStore } from "../store/conversation-store";
import { useCartStore } from "../store/cart-store";

type JsonRecord = Record<string, unknown>;
type McpContentNode = { type?: string; text?: string };
type McpWrappedResult = { content?: McpContentNode[] };
type CustomerToolResult = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  customers?: CustomerToolResult[];
};
type CartSummaryToolArgs = {
  customer?: { name?: string };
  cartId?: string;
  items?: Array<{
    sku?: string;
    name?: string;
    lineTotal?: string;
    price?: string;
    quantity?: number;
    qty?: number;
  }>;
  itemCount?: number;
  total?: string;
};
type ActionApprovalToolArgs = { title?: string; description?: string };
type OrderConfirmationToolArgs = { orderId?: string; orderNumber?: string; total?: string };
type TicketCreatedToolResult = { ticketNumber?: string; id?: string; _id?: string };
type ReturnEligibilityToolResult = {
  eligible?: boolean;
  reason?: string;
  reasons?: string[];
  order?: {
    id?: string;
    orderNumber?: string;
    totalPrice?: string;
    lineItems?: Array<{ lineItemId?: string; name?: string; quantity?: number; price?: string }>;
  };
};
type StartReturnToolResult = { success?: boolean; returnTrackingId?: string };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function unwrapMcpResult(raw: unknown): unknown {
  if (!raw) return null;
  if (isRecord(raw) && Array.isArray((raw as McpWrappedResult).content)) {
    const textNode = (raw as McpWrappedResult).content?.find((c) => c.type === "text" || c.type === "json");
    if (textNode?.text) {
      try {
        return JSON.parse(textNode.text);
      } catch {
        return textNode.text;
      }
    }
  }
  return raw;
}

function workflowStageLabel(raw: unknown): string {
  const rawStage = String(raw).toLowerCase();
  const stageMap: Record<string, string> = {
    greeting: "GREETING",
    identifying_customer: "IDENTIFYING CUSTOMER",
    reading_order: "READING ORDER",
    reading_ticket: "READING TICKET",
    reading_cart: "READING CART",
    reading_product: "READING PRODUCT",
    composing_action: "COMPOSING",
    awaiting_approval: "AWAITING APPROVAL",
    executing_action: "EXECUTING",
    summarizing: "SUMMARIZING",
    drafting_email: "DRAFTING EMAIL",
    knowledge_lookup: "KNOWLEDGE LOOKUP",
    closing: "CLOSING",
  };

  return stageMap[rawStage] || String(raw).toUpperCase().replace(/_/g, " ");
}

export function useChatToolEffects(messages: UIMessage[], isLoading: boolean) {
  const setInsights = useConversationStore((s) => s.setInsights);
  const setResolution = useConversationStore((s) => s.setResolution);
  const setMachineState = useConversationStore((s) => s.setMachineState);

  useEffect(() => {
    let newMachineState: string | undefined;
    let newInsights: InsightInfo | undefined;
    let newResolution: ResolutionInfo | undefined;

    // Customer identified this turn. This is the only thing that populates
    // orderWorkflow.customer.id, which the order stepper uses to advance.
    let newCustomerId: string | undefined;
    let newCustomerEmail: string | undefined;
    let orderCustomerName: string | undefined;
    let orderCartValue: OrderWorkflowSnapshot["cart"] | undefined;
    let orderPendingApproval: OrderWorkflowSnapshot["pendingApproval"] | undefined;
    let orderPlaced: OrderWorkflowSnapshot["placedOrder"] | undefined;
    let sawAnyOrderSignal = false;

    let ticketPendingApproval: TicketWorkflowSnapshot["pendingApproval"] | undefined;
    let ticketCreated: TicketWorkflowSnapshot["createdTicket"] | undefined;
    let sawAnyTicketSignal = false;

    let returnOrder: ReturnWorkflowSnapshot["order"] | undefined;
    let returnCompleted: ReturnWorkflowSnapshot["completed"] | undefined;
    let returnEligibility: ReturnWorkflowSnapshot["eligibility"] | undefined;
    let returnPendingApproval: ReturnWorkflowSnapshot["pendingApproval"] | undefined;
    let sawAnyReturnSignal = false;

    for (const msg of messages) {
      if (!msg.parts) continue;
      for (const part of msg.parts) {
        const p = part as { type: string; toolName?: string; input?: unknown; output?: unknown };
        const isStatic = p.type.startsWith("tool-") && p.type !== "tool-invocation";
        const isDynamic = p.type === "dynamic-tool";
        if (!isStatic && !isDynamic) continue;

        const toolName = isDynamic ? (p.toolName ?? "") : p.type.slice(5);

        if (toolName === "update_ui_state" && p.input) {
          const args = p.input as Record<string, unknown>;
          if (args.machineState || args.workflowStage) {
            newMachineState = workflowStageLabel(args.machineState || args.workflowStage);
          }
          if (args.confidence !== undefined || args.intent || args.sentiment) {
            newInsights = {
              intent: args.intent ? String(args.intent) : undefined,
              sentiment: args.sentiment ? String(args.sentiment) : undefined,
              confidence: typeof args.confidence === "number" ? args.confidence : 0,
            };
          }
          if (args.strategy || args.nextSteps) {
            newResolution = {
              strategy: args.strategy ? String(args.strategy) : undefined,
              nextSteps: Array.isArray(args.nextSteps) ? (args.nextSteps as string[]) : undefined,
            };
          }
          if (typeof args.customerId === "string" && args.customerId.trim()) {
            newCustomerId = args.customerId.trim();
          }
        }

        if (toolName === "find_customer" && p.output) {
          const result = unwrapMcpResult(p.output) as CustomerToolResult | null;
          const first = result?.customers?.[0] ?? (result?.id ? result : null);
          if (first?.id) {
            newCustomerId = String(first.id);
            orderCustomerName = [first.firstName, first.lastName].filter(Boolean).join(" ") || first.email || undefined;
            if (first.email) newCustomerEmail = String(first.email);
          }
        }

        if (toolName === "cart_summary" && p.input) {
          const args = p.input as CartSummaryToolArgs;
          sawAnyOrderSignal = true;
          orderCustomerName = args.customer?.name || orderCustomerName;
          orderCartValue = {
            cartId: args.cartId,
            items: (args.items || []).map((it) => ({
              sku: it.sku,
              name: it.name ?? "Item",
              price: it.lineTotal ?? it.price,
              quantity: it.quantity ?? it.qty ?? 1,
            })),
            itemCount: args.itemCount,
            total: args.total,
          };
          orderPendingApproval = undefined;
        }

        if (toolName === "action_approval" && p.input) {
          const args = p.input as ActionApprovalToolArgs;
          sawAnyOrderSignal = true;
          orderPendingApproval = { action: args.title, summary: args.description };
          sawAnyTicketSignal = true;
          ticketPendingApproval = { action: args.title, summary: args.description };
          sawAnyReturnSignal = true;
          returnPendingApproval = { action: args.title, summary: args.description };
        }

        if (toolName === "order_confirmation" && p.input) {
          const args = p.input as OrderConfirmationToolArgs;
          sawAnyOrderSignal = true;
          orderPlaced = { orderId: args.orderId, orderNumber: args.orderNumber, total: args.total };
          orderPendingApproval = undefined;
        }

        if (toolName === "create_ticket" && p.output) {
          const result = unwrapMcpResult(p.output) as TicketCreatedToolResult | null;
          if (result && (result.ticketNumber || result.id || result._id)) {
            sawAnyTicketSignal = true;
            ticketCreated = { ticketNumber: result.ticketNumber, id: result.id || result._id };
            ticketPendingApproval = undefined;
          }
        }

        if (toolName === "check_return_eligibility" && p.output) {
          const result = unwrapMcpResult(p.output) as ReturnEligibilityToolResult | null;
          if (result && typeof result.eligible === "boolean") {
            sawAnyReturnSignal = true;
            returnEligibility = {
              eligible: result.eligible,
              reason: result.eligible
                ? undefined
                : result.reason ?? (Array.isArray(result.reasons) ? result.reasons.join(" ") : undefined),
            };
            if (result.order) {
              returnOrder = {
                id: result.order.id,
                orderNumber: result.order.orderNumber,
                total: result.order.totalPrice,
                lineItems: Array.isArray(result.order.lineItems)
                  ? result.order.lineItems.map((li) => ({
                      lineItemId: li.lineItemId,
                      name: li.name,
                      quantity: li.quantity ?? 1,
                      price: li.price,
                    }))
                  : [],
              };
            }
          }
        }

        if (toolName === "start_return" && p.output) {
          const result = unwrapMcpResult(p.output) as StartReturnToolResult | null;
          if (result?.success) {
            sawAnyReturnSignal = true;
            returnCompleted = {
              type: "return",
              orderNumber: returnOrder?.orderNumber,
              summary: result.returnTrackingId ? `Return tracking ID: ${result.returnTrackingId}` : undefined,
            };
            returnPendingApproval = undefined;
          }
        }
      }
    }

    if (newInsights) setInsights(newInsights);
    if (newResolution) setResolution(newResolution);
    if (newMachineState) setMachineState(newMachineState);

    const store = useConversationStore.getState();

    if (sawAnyOrderSignal || newCustomerId) {
      const prevCustomer = store.orderWorkflow?.customer ?? null;
      store.setOrderWorkflow({
        customer: newCustomerId
          ? { ...prevCustomer, id: newCustomerId, name: orderCustomerName || prevCustomer?.name }
          : orderCustomerName
            ? { ...prevCustomer, name: orderCustomerName }
            : prevCustomer,
        cart: orderCartValue ?? store.orderWorkflow?.cart ?? null,
        pendingApproval: orderPendingApproval ?? null,
        placedOrder: orderPlaced ?? store.orderWorkflow?.placedOrder ?? null,
      });

      if (orderPlaced && !store.orderWorkflow?.placedOrder) {
        useCartStore.getState().clear();
      }
    }

    if (sawAnyTicketSignal) {
      store.setTicketWorkflow({
        pendingApproval: ticketPendingApproval ?? null,
        createdTicket: ticketCreated ?? store.ticketWorkflow?.createdTicket ?? null,
      });
    }

    if (sawAnyReturnSignal) {
      store.setReturnWorkflow({
        order: returnOrder ?? store.returnWorkflow?.order ?? null,
        eligibility: returnEligibility ?? store.returnWorkflow?.eligibility ?? null,
        pendingApproval: returnPendingApproval ?? null,
        completed: returnCompleted ?? store.returnWorkflow?.completed ?? null,
      });
    }

    if (newCustomerId && newCustomerId !== store.customer?.id) {
      const interimName = orderCustomerName || newCustomerEmail || "Customer";
      store.setContextHydrated("Customer", {
        id: newCustomerId,
        name: interimName,
        email: newCustomerEmail,
        status: "Active",
      });

      fetch(`/api/context/resolve?customerId=${encodeURIComponent(newCustomerId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const resolved = data?.customer;
          if (!resolved) return;
          if (useConversationStore.getState().customer?.id !== newCustomerId) return;
          store.setContextHydrated("Customer", {
            id: resolved.id ?? newCustomerId,
            name: resolved.name || interimName,
            email: resolved.email || newCustomerEmail,
            status: resolved.tier || "Active",
            createdAt: resolved.createdAt ?? undefined,
            orderCount: resolved.orderCount ?? undefined,
            lifetimeValue: resolved.lifetimeValue ?? undefined,
          });
        })
        .catch((e) => console.error("Failed to resolve customer context:", e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isLoading]);
}
