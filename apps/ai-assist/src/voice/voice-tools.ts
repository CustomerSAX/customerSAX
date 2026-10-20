/**
 * The public voice agent's tool set.
 *
 * Callers are anonymous members of the public, so this is a SEPARATE, minimal
 * allowlist — never `buildChatTools()`, whose commerce writes have no
 * server-side approval or ACL check. Every rule a caller could try to talk the
 * model out of is enforced here, in code:
 *
 *  - Order data is only returned after `verify_caller` matched an order's own
 *    email, and every read re-checks that the order belongs to that email.
 *  - Not-found and not-yours are indistinguishable to the caller.
 *  - Verification is capped at MAX_VERIFY_ATTEMPTS per session.
 *  - Output is reduced to customer-safe fields (no internal ids, no billing
 *    address, no other customers' data).
 *  - The only write is creating one handoff ticket per session.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { formatMoney } from "../commerce/graphql-client.js";
import { evaluateReturnEligibility, listOrdersByEmail, lookupOrder } from "../chat/tools/commerce.js";
import type { CtOrderForReturn } from "../chat/tools/commerce.js";
import { createTicketFromDraft, searchKnowledgeBase } from "../chat/tools/tickets.js";
import { instrumentTools } from "../chat/tools/instrument.js";
import type { VoiceTenant } from "./tenants.js";
import type { VoiceSession } from "./voice-session.js";

const log = createLogger("ai-assist").child({ module: "voice/tools" });

export const MAX_VERIFY_ATTEMPTS = 3;

/** Status changes the widget shows live (sent as SSE `status` events). */
export type VoiceStatusEvent =
  | { type: "verified" }
  | { type: "ticket"; ticketNumber: string | null }
  | { type: "ended" };

const NOT_FOUND =
  "I couldn't find an order matching those details. Please double-check the order number and the email address used to place it.";
const NEEDS_VERIFICATION = "The caller has not been verified yet. Ask for their order number and the email address on the order, then call verify_caller.";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Speech recognition renders "ORD-RC-633505" as "ORD RC 633505" or
 * "ord rc 633 505". Try the value as given, then hyphen- and space-collapsed
 * variants, so a correctly spoken number still resolves.
 */
function orderNumberCandidates(spoken: string): string[] {
  const trimmed = spoken.trim();
  const upper = trimmed.toUpperCase();
  const tokens = upper.split(/[\s-]+/).filter(Boolean);
  // Re-join letter groups with hyphens and glue consecutive digit groups together.
  const hyphenated = tokens
    .reduce<string[]>((acc, token) => {
      const prev = acc[acc.length - 1];
      if (prev !== undefined && /^\d+$/.test(prev) && /^\d+$/.test(token)) acc[acc.length - 1] = prev + token;
      else acc.push(token);
      return acc;
    }, [])
    .join("-");
  return [...new Set([trimmed, upper, hyphenated, tokens.join("")].filter(Boolean))];
}

async function findOrder(spoken: string): Promise<Record<string, unknown> | null> {
  for (const candidate of orderNumberCandidates(spoken)) {
    const order = await lookupOrder({ orderNumber: candidate });
    // Defense in depth: the order number is half of the caller's proof of
    // ownership, so accept only an exact match — never a fuzzy/partial hit,
    // should the lookup ever start matching loosely.
    const number = typeof order?.orderNumber === "string" ? order.orderNumber.toUpperCase() : null;
    if (order && (number === candidate.toUpperCase() || order.id === candidate)) return order;
  }
  return null;
}

/**
 * Spoken "praveen dot m g" can't be told apart from "praveen m g", so dots in
 * the local part are ignored when comparing. Everything else — every other
 * character of the local part and the whole domain — must still match exactly.
 */
function spokenEmailKey(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? email : email.slice(0, at).replace(/\./g, "") + email.slice(at);
}

function belongsTo(order: Record<string, unknown>, email: string): boolean {
  const orderEmail = typeof order.customerEmail === "string" ? normalizeEmail(order.customerEmail) : "";
  return orderEmail !== "" && spokenEmailKey(orderEmail) === spokenEmailKey(email);
}

type Money = { centAmount?: number; currencyCode?: string; fractionDigits?: number } | null | undefined;

/** Customer-safe projection of an order. Missing upstream values stay null — never invented. */
function toCallerOrder(order: Record<string, unknown>) {
  const shipping = order.shippingAddress as { city?: string | null; country?: string | null } | null | undefined;
  const lineItems = (order.lineItems as Array<{ name?: string; quantity?: number }> | undefined) ?? [];
  const createdAt = typeof order.createdAt === "string" ? order.createdAt : null;
  return {
    orderNumber: (order.orderNumber as string | null | undefined) ?? null,
    placedOn: createdAt ? createdAt.slice(0, 10) : null,
    orderStatus: (order.orderState as string | null | undefined) ?? (order.state as string | null | undefined) ?? null,
    shipmentStatus: (order.shipmentState as string | null | undefined) ?? null,
    paymentStatus: (order.paymentState as string | null | undefined) ?? null,
    total: order.totalPrice ? formatMoney(order.totalPrice as Money) : null,
    items: lineItems.map((li) => ({ name: li.name ?? null, quantity: li.quantity ?? null })),
    shipTo: shipping ? { city: shipping.city ?? null, country: shipping.country ?? null } : null
  };
}

function formatTranscript(session: VoiceSession): string {
  const lines = session.transcript.map((t) => `${t.role === "user" ? "Caller" : "Voice agent"}: ${t.text}`);
  return `Voice conversation transcript (session started ${session.createdAt}):\n\n${lines.join("\n")}`;
}

/**
 * Builds the tools for one turn. They read and mutate `session` directly; the
 * route saves it after the turn. `emit` pushes live status to the widget.
 */
export function buildVoiceTools(session: VoiceSession, tenant: VoiceTenant, emit: (event: VoiceStatusEvent) => void) {
  const record = (name: string, ok: boolean) => session.toolEvents.push({ tool: name, ok, at: new Date().toISOString() });

  const verifyCaller = tool({
    description:
      "Verify the caller owns an order before discussing ANY order details. Requires the order number and the email address used on the order. " +
      "Convert spoken emails to written form first (e.g. 'jane dot doe at gmail dot com' → 'jane.doe@gmail.com').",
    inputSchema: z.object({
      orderNumber: z.string().min(1).describe("Order number as the caller said it"),
      email: z.string().min(3).describe("Email address on the order, in written form")
    }),
    execute: async ({ orderNumber, email }) => {
      if (session.verified) {
        return { verified: true, alreadyVerified: true, email: session.verified.email };
      }
      if (session.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
        record("verify_caller", false);
        return {
          verified: false,
          locked: true,
          instruction: "Too many failed attempts. Do not try again — offer to have a support agent follow up (request_human_handoff)."
        };
      }
      session.verifyAttempts += 1;
      const remainingAttempts = MAX_VERIFY_ATTEMPTS - session.verifyAttempts;
      try {
        const order = await findOrder(orderNumber);
        const callerEmail = normalizeEmail(email);
        if (!order || !belongsTo(order, callerEmail)) {
          record("verify_caller", false);
          return { verified: false, message: NOT_FOUND, remainingAttempts };
        }
        session.verified = {
          // The order's own address, not the caller's transcription of it.
          email: normalizeEmail(order.customerEmail as string),
          customerId: (order.customerId as string | null | undefined) ?? null,
          orderNumber: (order.orderNumber as string | null | undefined) ?? null
        };
        record("verify_caller", true);
        emit({ type: "verified" });
        return { verified: true, order: toCallerOrder(order) };
      } catch (err) {
        // Backend failure: give the attempt back — the caller did nothing wrong.
        session.verifyAttempts -= 1;
        record("verify_caller", false);
        log.warn("verify_caller backend failure", { reason: String(err) });
        return { error: "The order system is not reachable right now.", backendUnavailable: true };
      }
    }
  });

  const listMyOrders = tool({
    description: "List the verified caller's most recent orders (newest first).",
    inputSchema: z.object({ limit: z.number().int().min(1).max(5).default(3) }),
    execute: async ({ limit }) => {
      if (!session.verified) return { error: NEEDS_VERIFICATION };
      try {
        const orders = (await listOrdersByEmail(session.verified.email, limit)).filter((o) => belongsTo(o, session.verified!.email));
        record("list_my_orders", true);
        return { orders: orders.map(toCallerOrder), count: orders.length };
      } catch (err) {
        record("list_my_orders", false);
        return { error: "The order system is not reachable right now.", backendUnavailable: true, detail: String(err) };
      }
    }
  });

  const getOrderStatus = tool({
    description: "Get the current status, items and total of one of the verified caller's orders.",
    inputSchema: z.object({ orderNumber: z.string().min(1).describe("Order number as the caller said it") }),
    execute: async ({ orderNumber }) => {
      if (!session.verified) return { error: NEEDS_VERIFICATION };
      try {
        const order = await findOrder(orderNumber);
        if (!order || !belongsTo(order, session.verified.email)) {
          record("get_order_status", false);
          return { found: false, message: NOT_FOUND };
        }
        record("get_order_status", true);
        return { found: true, order: toCallerOrder(order) };
      } catch (err) {
        record("get_order_status", false);
        return { error: "The order system is not reachable right now.", backendUnavailable: true, detail: String(err) };
      }
    }
  });

  const checkReturnEligibility = tool({
    description:
      "Check whether one of the verified caller's orders can be returned (paid, shipped, within the return window). " +
      "You cannot start the return yourself — if eligible and the caller wants to return it, use request_human_handoff.",
    inputSchema: z.object({ orderNumber: z.string().min(1) }),
    execute: async ({ orderNumber }) => {
      if (!session.verified) return { error: NEEDS_VERIFICATION };
      try {
        const order = await findOrder(orderNumber);
        if (!order || !belongsTo(order, session.verified.email)) {
          record("check_return_eligibility", false);
          return { found: false, message: NOT_FOUND };
        }
        const result = evaluateReturnEligibility(order as unknown as CtOrderForReturn);
        record("check_return_eligibility", true);
        return {
          found: true,
          orderNumber: (order.orderNumber as string | null | undefined) ?? null,
          eligible: result.eligible,
          reason: result.reason ?? null,
          daysRemaining: result.daysRemaining ?? null,
          returnWindowDays: result.returnWindowDays ?? null
        };
      } catch (err) {
        record("check_return_eligibility", false);
        return { error: "The order system is not reachable right now.", backendUnavailable: true, detail: String(err) };
      }
    }
  });

  const requestHumanHandoff = tool({
    description:
      "Create a support ticket so a human agent follows up. Use for anything you cannot do yourself (returns, refunds, cancellations, " +
      "address changes, complaints), when the caller asks for a person, or after verification is locked. Only one ticket per conversation.",
    inputSchema: z.object({
      reason: z.string().min(3).max(120).describe("Short subject, e.g. 'Return request for order ORD-123'"),
      summary: z.string().min(10).describe("What the caller needs, in plain sentences, for the human agent"),
      category: z.enum(["request", "orderInquiry", "returns", "paymentMethod", "generalInfoChange", "passwordReset"]).default("request"),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      contactEmail: z.string().optional().describe("Caller's email for follow-up — required only when the caller is NOT verified"),
      contactName: z.string().optional(),
      orderNumber: z.string().optional().describe("Related order number, if any")
    }),
    execute: async ({ reason, summary, category, priority, contactEmail, contactName, orderNumber }) => {
      if (session.ticket) {
        return { created: true, alreadyCreated: true, ticketNumber: session.ticket.ticketNumber };
      }

      const verified = session.verified;
      const email = verified?.email ?? (contactEmail ? normalizeEmail(contactEmail) : "");
      if (!z.string().email().safeParse(email).success) {
        return { created: false, error: "Ask the caller for an email address so the support team can reply, then try again." };
      }

      // Only link an order the verified caller actually owns.
      let linkedOrder: string | undefined;
      if (verified) {
        if (orderNumber) {
          const order = await findOrder(orderNumber).catch(() => null);
          if (order && belongsTo(order, verified.email)) linkedOrder = (order.orderNumber as string | undefined) ?? undefined;
        } else {
          linkedOrder = verified.orderNumber ?? undefined;
        }
      }

      const message = verified
        ? summary
        : `${summary}\n\nNote: the caller was NOT verified as an order owner — confirm identity before sharing order details or taking action.`;

      try {
        const created = await createTicketFromDraft(
          {
            subject: `[Voice] ${reason}`.slice(0, 140),
            customerEmail: email,
            customerName: contactName,
            customerId: verified?.customerId ?? undefined,
            orderNumber: linkedOrder,
            contactType: "phone",
            source: "web",
            category,
            priority,
            status: "open",
            message,
            worklog: formatTranscript(session)
          },
          tenant.serviceEmail
        );
        if (!created) {
          record("request_human_handoff", false);
          return { created: false, error: "The ticket system did not confirm the ticket." };
        }
        session.ticket = { id: created.id ?? null, ticketNumber: created.ticketNumber ?? null };
        session.outcome = "handoff";
        record("request_human_handoff", true);
        emit({ type: "ticket", ticketNumber: session.ticket.ticketNumber });
        return { created: true, ticketNumber: session.ticket.ticketNumber };
      } catch (err) {
        record("request_human_handoff", false);
        log.warn("handoff ticket creation failed", { reason: String(err) });
        return { created: false, error: "The ticket system is not reachable right now.", backendUnavailable: true };
      }
    }
  });

  const endCall = tool({
    description: "End the conversation after saying goodbye, when the caller is done.",
    inputSchema: z.object({}),
    execute: async () => {
      session.ended = true;
      if (session.outcome === "in_progress") session.outcome = "resolved";
      record("end_call", true);
      emit({ type: "ended" });
      return { ended: true };
    }
  });

  const tools = {
    verify_caller: verifyCaller,
    list_my_orders: listMyOrders,
    get_order_status: getOrderStatus,
    check_return_eligibility: checkReturnEligibility,
    request_human_handoff: requestHumanHandoff,
    end_call: endCall,
    ...(tenant.knowledgeBase
      ? {
          search_help_articles: tool({
            description: "Search help articles for store policies (shipping, returns, payments). Answer only from what is returned.",
            inputSchema: z.object({ query: z.string().min(2) }),
            execute: async ({ query }) => {
              const result = await searchKnowledgeBase(query, 3);
              record("search_help_articles", result !== null && !("error" in result && result.error));
              return result ?? { results: [], total: 0, note: "No help articles are available." };
            }
          })
        }
      : {})
  };

  return instrumentTools(tools, log);
}
