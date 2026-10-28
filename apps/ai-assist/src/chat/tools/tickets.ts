import { randomUUID } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { instrumentTools } from "./instrument.js";
import { guardWriteTools } from "./write-guard.js";

const log = createLogger("ai-assist").child({ module: "tools/tickets" });

// sla: null = this ticket system provides no SLA data. state/focus are resolved
// against the current time by the ticketing service (see TicketSla in its schema).
const TICKET_FIELDS = `
  id ticketNumber projectKey customerName customerEmail customerId source status priority category subject assignee
  contactType orderNumber message createdAt lastModifiedAt
  sla { state nextDueAt focus { key label state dueAt } metrics { key label stage state dueAt completedAt } }
`;

type SlaFocus = { dueAt?: string | null; minutesFromNow?: number };
/** Adds `sla.focus.minutesFromNow` (negative = overdue) so the model never does time arithmetic itself. */
export function withSlaTiming<T>(ticket: T, now = Date.now()): T {
  const focus = (ticket as { sla?: { focus?: SlaFocus | null } | null } | null)?.sla?.focus;
  const due = focus?.dueAt ? Date.parse(focus.dueAt) : Number.NaN;
  if (focus && !Number.isNaN(due)) focus.minutesFromNow = Math.round((due - now) / 60_000);
  return ticket;
}

// ─── Read tools (no approval gate needed) ────────────────────────────────────

export const searchZendeskPluginTool = tool({
  description: "Search tickets in the project's connected Zendesk plugin. Use when the user explicitly asks about Zendesk, including projects using CSA Native Ticketing. This is a separate read-only plugin: it does not change or update native tickets. If not connected, ask an administrator to connect Zendesk in the assistant's Plugins menu. Report ticket numbers and subjects as text; these are external Zendesk records, not native ticket links.",
  inputSchema: z.object({ query: z.string().trim().min(1).max(300).describe("Zendesk search terms, e.g. status:open or a customer's email"), limit: z.number().int().min(1).max(20).default(10) }),
  execute: async ({ query, limit }) => {
    const ctx = getSystemPromptContext();
    if (!ctx.clientId || !ctx.canViewTickets) return { error: "Ticket access and an active project are required." };
    try {
      const data = await bffQuery<{ zendeskPluginTickets: unknown }>(`query ZendeskPluginTickets($query: String!, $limit: Int) { zendeskPluginTickets(query: $query, limit: $limit) { results { id subject status priority } count total } }`, { query, limit });
      return data.zendeskPluginTickets;
    } catch {
      return { error: "Zendesk search failed. Ask an administrator to check the Zendesk plugin connection for this project. Do not fall back to native tickets for this Zendesk request." };
    }
  }
});

export const searchTicketsTool = tool({
  description:
    "Search support tickets by keyword, customer email, customer ID, status, priority, or assignee, optionally ordered by SLA deadline. " +
    "Each ticket includes its real SLA status (`sla`). Use for finding existing tickets and for 'what should I work on next'.",
  inputSchema: z.object({
    query: z.string().optional().describe("Keyword search within ticket subject or body"),
    customerEmail: z.string().optional().describe("Filter by customer email"),
    customerId: z.string().optional().describe("Filter by commercetools customer UUID — use when you have the customer ID from a find_customer result"),
    status: z
      .enum(["any", "open", "in progress", "waiting", "resolved", "closed"])
      .optional()
      .describe("Filter by ticket status; 'any' (no filter) unless the rep asked for a status"),
    priority: z
      .enum(["any", "low", "normal", "high", "urgent"])
      .optional()
      .describe("Filter by priority; 'any' (no filter) unless the rep explicitly asked for a priority"),
    assignee: z
      .string()
      .optional()
      .describe("'me' = the logged-in rep, 'unassigned' = the queue, or an agent's email; omit for everyone"),
    sortBy: z
      .enum(["recent", "sla"])
      .optional()
      .describe("'sla' = soonest SLA deadline first (breached, then at risk); default 'recent' = last updated first"),
    limit: z.number().optional().default(10)
  }),
  execute: async (args) => {
    // The model tends to fill every optional field; an empty string or "any"
    // must mean "no filter", or a request like "open tickets" silently drops
    // every ticket that isn't also e.g. priority "normal".
    const opt = (v?: string) => (v && v.trim() && v !== "any" ? v.trim() : undefined);
    const query = opt(args.query);
    const customerEmail = opt(args.customerEmail);
    const customerId = opt(args.customerId);
    const status = opt(args.status);
    const priority = opt(args.priority);
    const requested = opt(args.assignee);
    const me = getSystemPromptContext().userEmail;
    if (requested?.toLowerCase() === "me" && (!me.includes("@") || me === "unknown@csa.local"))
      return { error: "The logged-in rep's email isn't known in this session, so tickets assigned to them can't be found." };
    const assignee = requested?.toLowerCase() === "me" ? me : requested?.toLowerCase() === "unassigned" ? "Queue" : requested;
    const sort = args.sortBy === "sla" ? { sortKey: "slaDueAt", sortOrder: "asc" } : {};
    const limit = args.limit;
    try {
      const data = await bffQuery<{ ticketPage: { results: unknown[]; total: number } }>(
        `query SearchTickets($search: String, $customerEmail: String, $customerId: String, $status: String, $priority: String, $assignee: String, $sortKey: String, $sortOrder: String, $limit: Int) {
          ticketPage(search: $search, customerEmail: $customerEmail, customerId: $customerId, status: $status, priority: $priority, assignee: $assignee, sortKey: $sortKey, sortOrder: $sortOrder, limit: $limit) {
            results { ${TICKET_FIELDS} }
            total
          }
        }`,
        { search: query, customerEmail, customerId, status, priority, assignee, ...sort, limit }
      );
      data.ticketPage?.results?.forEach((ticket) => withSlaTiming(ticket));
      // The studio renders these results itself as a ticket table with
      // per-row actions, straight from this output.
      return data.ticketPage?.results?.length
        ? {
            ...data.ticketPage,
            displayed:
              "These tickets are now shown to the rep as a table (number, subject, status, priority, SLA, assignee, last update) with an Actions button on every row. " +
              "Do NOT list them as text or bullets and do not restate their fields. Reply with ONE short line, e.g. '5 open tickets — 2 are urgent.'"
          }
        : data.ticketPage;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

export const getTicketTool = tool({
  description:
    "Retrieve a single ticket by its internal ID or by its plain ticket number. When the rep says 'ticket 3' or '#3', call this with id \"3\" (digits only, no '#') — do not search for it.",
  inputSchema: z.object({
    id: z.string().describe("Ticket internal ID, or the ticket number without '#'")
  }),
  execute: async ({ id }) => {
    try {
      const data = await bffQuery<{ ticket: unknown }>(
        `query GetTicket($id: ID!) {
          ticket(id: $id) { ${TICKET_FIELDS} }
        }`,
        { id }
      );
      return data.ticket ? withSlaTiming(data.ticket) : { error: "Ticket not found" };
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
    const result = await searchKnowledgeBase(query, limit);
    return result === null
      ? {
          results: [],
          total: 0,
          note: "Knowledge base is not configured in this deployment. Advise the rep to check the internal wiki or escalate to a senior agent."
        }
      : result;
  }
});

/**
 * Queries the knowledge-base service. Returns null when no KB is configured,
 * `{ error, results: [], total: 0 }` on a backend failure, otherwise the
 * service's own response.
 */
export async function searchKnowledgeBase(query: string, limit: number): Promise<Record<string, unknown> | null> {
  const kbUrl = process.env.KNOWLEDGE_BASE_URL?.trim();
  if (!kbUrl) return null;

  try {
    const res = await fetch(`${kbUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { "x-api-key": process.env.KNOWLEDGE_BASE_API_KEY ?? "" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { error: `KB service returned ${res.status}`, results: [], total: 0 };
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    return { error: String(err), results: [], total: 0 };
  }
}

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
  "You must NOT call any write tool (create_ticket, update_ticket, add_ticket_note) until the agent explicitly clicks " +
  "Approve in the UI. Stop your response now and wait for the next user message.";

/**
 * Creates a ticket through the BFF. Callers own their own permission/approval
 * checks — this only maps the draft and runs the mutation.
 *
 * `worklog` is an ai-assist-level concept (internal notes). It is added AFTER
 * the ticket exists, via `addTicketWorklog`, rather than as `comments` on the
 * draft: providers differ — Freshdesk rejects comments on create ("Add
 * Freshdesk notes using Add Internal Note after creating the ticket") — and the
 * two-step path works for every provider. If the note fails, the ticket still
 * exists, so it is returned with `noteError` instead of being reported as a
 * failed create.
 */
export async function createTicketFromDraft(
  args: Record<string, unknown> & { worklog?: string },
  author: string
): Promise<{ id?: string; ticketNumber?: string; noteError?: string } | null> {
  const { worklog, ...draft } = args;

  const create = (d: Record<string, unknown>) =>
    bffQuery<{ createTicket: { id?: string; ticketNumber?: string } | null }>(
      `mutation CreateTicket($draft: TicketDraftInput!) {
        createTicket(draft: $draft) { ${TICKET_FIELDS} }
      }`,
      { draft: d }
    );

  let data: Awaited<ReturnType<typeof create>>;
  try {
    data = await create(draft);
  } catch (err) {
    // Some providers (Freshdesk) have no field for the order/customer link and
    // reject the whole ticket. Keep the ticket, and keep the link visible to
    // the rep by writing it into the description instead of dropping it.
    if (!/(orderNumber|customerId) mapping is not configured/.test(String(err))) throw err;
    const { orderNumber, customerId, ...rest } = draft;
    const links = [
      orderNumber ? `Order number: ${String(orderNumber)}` : null,
      customerId ? `Customer ID: ${String(customerId)}` : null
    ].filter(Boolean);
    const message = [typeof rest.message === "string" ? rest.message : "", links.join("\n")].filter(Boolean).join("\n\n");
    data = await create({ ...rest, message });
  }
  const created = data.createTicket;
  if (!created?.id || !worklog) return created;

  try {
    await addTicketNote(created.id, worklog, author);
    return created;
  } catch (err) {
    log.warn("ticket created but internal note failed", { targetId: created.id, reason: String(err) });
    return { ...created, noteError: "The ticket was created, but its internal note could not be added." };
  }
}

/** Applies a patch (status, priority, assignee, …) to a ticket. Callers own permission/approval checks. */
export async function updateTicketFields(
  id: string,
  patch: Record<string, unknown>
): Promise<{ id?: string; ticketNumber?: string; status?: string } | null> {
  const data = await bffQuery<{ updateTicket: { id?: string; ticketNumber?: string; status?: string } | null }>(
    `mutation UpdateTicket($id: ID!, $patch: TicketUpdateInput!) {
      updateTicket(id: $id, patch: $patch) { ${TICKET_FIELDS} }
    }`,
    { id, patch }
  );
  return data.updateTicket;
}

/** Adds an internal (rep-only) note to a ticket. Returns null when the ticket doesn't exist. */
export async function addTicketNote(
  id: string,
  note: string,
  author: string
): Promise<{ id?: string; ticketNumber?: string } | null> {
  const data = await bffQuery<{ addTicketWorklog: { id?: string; ticketNumber?: string } | null }>(
    `mutation AddTicketNote($id: ID!, $comment: WorklogCommentInput!) {
      addTicketWorklog(id: $id, comment: $comment) { ${TICKET_FIELDS} }
    }`,
    { id, comment: { id: randomUUID(), comment: note, createdAt: new Date().toISOString(), status: "internal", author } }
  );
  return data.addTicketWorklog;
}

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

        const created = await createTicketFromDraft(args, ctx.userEmail ?? "csa_assistant");
        log.info("write:create_ticket", {
          targetId: created?.id ?? created?.ticketNumber,
          ok: created != null
        });
        return created;
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
        const updated = await updateTicketFields(id, patch);
        log.info("write:update_ticket", { targetId: id, ok: updated != null });
        return updated;
      } catch (err) {
        log.info("write:update_ticket", { targetId: id, ok: false });
        return { error: String(err) };
      }
    }
  });

  // Internal note (worklog) on an existing ticket — never visible to the customer.
  const addTicketNoteTool = tool({
    description: "Add an internal note to an existing ticket (agents only; the customer never sees it). ALWAYS require action_approval first.",
    inputSchema: z.object({
      id: z.string().describe("Ticket ID"),
      note: z.string().min(1).describe("Note text, exactly as approved by the rep")
    }),
    execute: async ({ id, note }) => {
      if (approvalGate?.pending) {
        return { error: APPROVAL_GATE_ERROR };
      }

      try {
        const ctx = getSystemPromptContext();
        if (!ctx.canUpdateTickets) {
          return { error: "PERMISSION DENIED: You only have read access to tickets. Please reach out to the admin to perform write or update actions." };
        }
        const noted = await addTicketNote(id, note, ctx.userEmail ?? "csa_assistant");
        log.info("write:add_ticket_note", { targetId: id, ok: noted != null });
        return noted ?? { error: "Ticket not found" };
      } catch (err) {
        log.info("write:add_ticket_note", { targetId: id, ok: false });
        return { error: String(err) };
      }
    }
  });

  return instrumentTools(guardWriteTools({
    search_zendesk_tickets: searchZendeskPluginTool,
    search_tickets: searchTicketsTool,
    get_ticket: getTicketTool,
    create_ticket: createTicketTool,
    update_ticket: updateTicketTool,
    add_ticket_note: addTicketNoteTool,
    list_assignees: listAssigneesTool,
    search_knowledge_base: searchKnowledgeBaseTool,
    get_knowledge_base_article: getKnowledgeBaseArticleTool
  }, approvalGate), log);
}
