import { randomUUID } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";

const log = createLogger("ai-assist").child({ module: "tools/tickets" });

const TICKET_FIELDS = `
  id ticketNumber projectKey customerName customerEmail customerId source status priority category subject assignee
  contactType orderNumber message createdAt lastModifiedAt
`;

// ─── Read tools (no approval gate needed) ────────────────────────────────────

export const searchTicketsTool = tool({
  description: "Search support tickets by keyword, customer email, customer ID, status, or priority. Use for finding existing tickets.",
  inputSchema: z.object({
    query: z.string().optional().describe("Keyword search within ticket subject or body"),
    customerEmail: z.string().optional().describe("Filter by customer email"),
    customerId: z.string().optional().describe("Filter by commercetools customer UUID — use when you have the customer ID from a find_customer result"),
    status: z.enum(["open", "in progress", "waiting", "resolved", "closed"]).optional().describe("Filter by ticket status"),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Filter by priority"),
    limit: z.number().optional().default(10)
  }),
  execute: async ({ query, customerEmail, customerId, status, priority, limit }) => {
    try {
      const data = await bffQuery<{ ticketPage: { results: unknown[]; total: number } }>(
        `query SearchTickets($search: String, $customerEmail: String, $customerId: String, $status: String, $priority: String, $limit: Int) {
          ticketPage(search: $search, customerEmail: $customerEmail, customerId: $customerId, status: $status, priority: $priority, limit: $limit) {
            results { ${TICKET_FIELDS} }
            total
          }
        }`,
        { search: query, customerEmail, customerId, status, priority, limit }
      );
      return data.ticketPage;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

export const getTicketTool = tool({
  description: "Retrieve a single ticket by its ID.",
  inputSchema: z.object({
    id: z.string().describe("Ticket ID")
  }),
  execute: async ({ id }) => {
    try {
      const data = await bffQuery<{ ticket: unknown }>(
        `query GetTicket($id: ID!) {
          ticket(id: $id) { ${TICKET_FIELDS} }
        }`,
        { id }
      );
      return data.ticket ?? { error: "Ticket not found" };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Assignee list — CT custom objects via BFF (architecture rule) ─────────
//
// Agents are stored in CommerceTools custom objects (container: "mc-user-info"),
// NOT in MongoDB. This must flow through the BFF GraphQL layer, same as every
// other CT-owned resource:  ai-assist → BFF (4000) → CT subgraph (4310) → CT API.

export const listAssigneesTool = tool({
  description: "List agents who can be assigned to a ticket. Use when the rep mentions an assignee by name to resolve their email. Returns name + email pairs.",
  inputSchema: z.object({
    name: z.string().optional().describe("Partial name/email to filter by (case-insensitive). Omit to get all agents."),
  }),
  execute: async ({ name }) => {
    try {
      const data = await bffQuery<{
        agentList: { results: { id: string; key: string; email: string }[]; total: number };
      }>(
        `query GetAgentList($container: String!) {
          agentList(container: $container) {
            total
            results { id key email }
          }
        }`,
        { container: "mc-user-info" }
      );

      const all = data.agentList?.results ?? [];
      const needle = name?.trim().toLowerCase();
      const filtered = needle
        ? all.filter((a) => a.email.toLowerCase().includes(needle))
        : all;

      const assignees = filtered.map((a) => ({
        name: a.email,   // CT custom objects store only email; use as display name
        email: a.email,
        role: "agent",
      }));
      return { assignees, total: assignees.length };
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Knowledge base tools (no approval gate needed) ───────────────────────────

export const searchKnowledgeBaseTool = tool({
  description: "Search the internal knowledge base for policy articles, FAQs, return policies, and procedures. Use when the rep asks about company policies or procedures.",
  inputSchema: z.object({
    query: z.string().describe("Search query — e.g. 'return policy', 'shipping SLA', 'password reset'"),
    limit: z.number().optional().default(5)
  }),
  execute: async ({ query, limit }) => {
    const kbUrl = process.env.KNOWLEDGE_BASE_URL?.trim();
    if (!kbUrl) {
      return {
        results: [],
        total: 0,
        note: "Knowledge base is not configured in this deployment. Advise the rep to check the internal wiki or escalate to a senior agent."
      };
    }

    try {
      const res = await fetch(`${kbUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: { "x-api-key": process.env.KNOWLEDGE_BASE_API_KEY ?? "" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { error: `KB service returned ${res.status}`, results: [], total: 0 };
      return await res.json();
    } catch (err) {
      return { error: String(err), results: [], total: 0 };
    }
  }
});

export const getKnowledgeBaseArticleTool = tool({
  description: "Fetch the full text of a specific knowledge base article by its ID or slug.",
  inputSchema: z.object({
    id: z.string().describe("Article ID or slug to fetch")
  }),
  execute: async ({ id }) => {
    const kbUrl = process.env.KNOWLEDGE_BASE_URL?.trim();
    if (!kbUrl) {
      return { error: "Knowledge base is not configured in this deployment." };
    }

    try {
      const res = await fetch(`${kbUrl}/articles/${encodeURIComponent(id)}`, {
        headers: { "x-api-key": process.env.KNOWLEDGE_BASE_API_KEY ?? "" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { error: `KB service returned ${res.status}` };
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Write-tool builder ───────────────────────────────────────────────────────
//
// createTicketTool and updateTicketTool are defined INSIDE buildTicketTools()
// so they can close over approvalGate.  When action_approval.execute fires
// earlier in the same step (same model response), it sets approvalGate.pending
// to true — the gate check here prevents the write from executing in the same
// turn, forcing the agent to wait for the real Approve click.

const APPROVAL_GATE_ERROR =
  "APPROVAL_GATE_BLOCKED: An action_approval confirmation card was shown earlier in this turn. " +
  "You must NOT call any write tool (create_ticket, update_ticket) until the agent explicitly clicks " +
  "Approve in the UI. Stop your response now and wait for the next user message.";

export function buildTicketTools(approvalGate?: { pending: boolean }) {
  const createTicketTool = tool({
    description: "Create a new support ticket for a customer. Always fill subject, customerEmail, and priority. Pass customerId and orderNumber when available so the ticket is linked to the customer record and order.",
    inputSchema: z.object({
      subject: z.string().describe("Short ticket subject line"),
      customerEmail: z.string().describe("Customer's email address"),
      customerName: z.string().optional().describe("Customer's display name"),
      customerId: z.string().optional().describe("Commercetools customer UUID — always pass when available from find_customer or update_ui_state"),
      orderNumber: z.string().optional().describe("Order number this ticket relates to, if applicable"),
      contactType: z.enum(["email", "chat", "phone", "web", "csa_assistant"]).optional().describe("How the customer contacted support"),
      message: z.string().optional().describe("Full ticket body / description of the issue. Always populate this with a clear description of what the customer reported."),
      worklog: z.string().optional().describe("Internal agent notes to attach to the ticket"),
      category: z.enum(["request", "orderInquiry", "returns", "paymentMethod", "generalInfoChange", "passwordReset"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      status: z.enum(["open", "in progress", "waiting"]).default("open"),
      assignee: z.string().optional().describe("Agent assigned to this ticket"),
      source: z.enum(["email", "chat", "phone", "web", "csa_assistant"]).default("csa_assistant")
    }),
    execute: async (args) => {
      // ── Approval gate ──────────────────────────────────────────────────────
      // If action_approval ran earlier in this same agentic step, block the
      // write until the agent clicks Approve (which sends a fresh user message).
      if (approvalGate?.pending) {
        return { error: APPROVAL_GATE_ERROR };
      }

      try {
        const ctx = getSystemPromptContext();
        if (!ctx.canCreateTickets) {
          return { error: "PERMISSION DENIED: You only have read access to tickets. Please reach out to the admin to perform write or update actions." };
        }

        // `worklog` is an ai-assist-level concept (internal notes). TicketDraftInput
        // has no `worklog` field — it only accepts `comments: [WorklogCommentInput!]`.
        // Passing `worklog` directly causes a GraphQL "unexpected field" rejection.
        // Convert it to a WorklogCommentInput and include it in comments instead.
        const { worklog, ...draftFields } = args;
        const comments = worklog
          ? [
              {
                id: randomUUID(),
                comment: worklog,
                createdAt: new Date().toISOString(),
                status: "internal",
                author: ctx.userEmail ?? "csa_assistant",
              },
            ]
          : undefined;

        const draft = { ...draftFields, ...(comments ? { comments } : {}) };

        const data = await bffQuery<{ createTicket: { id?: string; ticketNumber?: string } | null }>(
          `mutation CreateTicket($draft: TicketDraftInput!) {
            createTicket(draft: $draft) { ${TICKET_FIELDS} }
          }`,
          { draft }
        );
        log.info("write:create_ticket", {
          targetId: data.createTicket?.id ?? data.createTicket?.ticketNumber,
          ok: data.createTicket != null
        });
        return data.createTicket;
      } catch (err) {
        log.info("write:create_ticket", { ok: false });
        return { error: String(err) };
      }
    }
  });

  const updateTicketTool = tool({
    description: "Update a ticket's status, priority, assignee, category, or subject. ALWAYS require action_approval before status changes.",
    inputSchema: z.object({
      id: z.string().describe("Ticket ID"),
      status: z.enum(["open", "in progress", "waiting", "resolved", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      assignee: z.string().optional(),
      category: z.string().optional(),
      subject: z.string().optional()
    }),
    execute: async ({ id, ...patch }) => {
      // ── Approval gate ──────────────────────────────────────────────────────
      if (approvalGate?.pending) {
        return { error: APPROVAL_GATE_ERROR };
      }

      try {
        const ctx = getSystemPromptContext();
        if (!ctx.canUpdateTickets) {
          return { error: "PERMISSION DENIED: You only have read access to tickets. Please reach out to the admin to perform write or update actions." };
        }
        const data = await bffQuery<{ updateTicket: unknown }>(
          `mutation UpdateTicket($id: ID!, $patch: TicketUpdateInput!) {
            updateTicket(id: $id, patch: $patch) { ${TICKET_FIELDS} }
          }`,
          { id, patch }
        );
        log.info("write:update_ticket", { targetId: id, ok: data.updateTicket != null });
        return data.updateTicket;
      } catch (err) {
        log.info("write:update_ticket", { targetId: id, ok: false });
        return { error: String(err) };
      }
    }
  });

  return instrumentTools({
    search_tickets: searchTicketsTool,
    get_ticket: getTicketTool,
    create_ticket: createTicketTool,
    update_ticket: updateTicketTool,
    list_assignees: listAssigneesTool,
    search_knowledge_base: searchKnowledgeBaseTool,
    get_knowledge_base_article: getKnowledgeBaseArticleTool
  }, log);
}
