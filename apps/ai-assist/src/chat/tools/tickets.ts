import { tool } from "ai";
import { z } from "zod";
import { bffQuery } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";

const TICKET_FIELDS = `
  id ticketNumber projectKey customerName customerEmail source status priority category subject assignee createdAt lastModifiedAt
`;

export const searchTicketsTool = tool({
  description: "Search support tickets by keyword, customer email, status, or priority. Use for finding existing tickets.",
  inputSchema: z.object({
    query: z.string().optional().describe("Keyword search within ticket subject or body"),
    customerEmail: z.string().optional().describe("Filter by customer email"),
    status: z.enum(["open", "in progress", "waiting", "resolved", "closed"]).optional().describe("Filter by ticket status"),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Filter by priority"),
    limit: z.number().optional().default(10)
  }),
  execute: async ({ query, customerEmail, status, priority, limit }) => {
    try {
      const data = await bffQuery<{ ticketPage: { results: unknown[]; total: number } }>(
        `query SearchTickets($search: String, $customerEmail: String, $status: String, $priority: String, $limit: Int) {
          ticketPage(search: $search, customerEmail: $customerEmail, status: $status, priority: $priority, limit: $limit) {
            results { ${TICKET_FIELDS} }
            total
          }
        }`,
        { search: query, customerEmail, status, priority, limit }
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

export const createTicketTool = tool({
  description: "Create a new support ticket for a customer. Always fill subject, customerEmail, and priority.",
  inputSchema: z.object({
    subject: z.string().describe("Short ticket subject line"),
    customerEmail: z.string().describe("Customer's email address"),
    customerName: z.string().optional().describe("Customer's display name"),
    category: z.enum(["request", "orderInquiry", "returns", "paymentMethod", "generalInfoChange", "passwordReset"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    status: z.enum(["open", "in progress", "waiting"]).default("open"),
    assignee: z.string().optional().describe("Agent assigned to this ticket"),
    source: z.enum(["email", "chat", "phone", "web", "csa_assistant"]).default("csa_assistant")
  }),
  execute: async (args) => {
    try {
      const ctx = getSystemPromptContext();
      if (!ctx.canCreateTickets) {
        return { error: "PERMISSION DENIED: You only have read access to tickets. Please reach out to the admin to perform write or update actions." };
      }
      const data = await bffQuery<{ createTicket: unknown }>(
        `mutation CreateTicket($draft: TicketDraftInput!) {
          createTicket(draft: $draft) { ${TICKET_FIELDS} }
        }`,
        { draft: args }
      );
      return data.createTicket;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

export const updateTicketTool = tool({
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
      return data.updateTicket;
    } catch (err) {
      return { error: String(err) };
    }
  }
});

export function buildTicketTools() {
  return {
    search_tickets: searchTicketsTool,
    get_ticket: getTicketTool,
    create_ticket: createTicketTool,
    update_ticket: updateTicketTool
  };
}
