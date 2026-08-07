/**
 * Tickets tools — delegates to the deployed Tickets MCP server via HTTP.
 *
 * The MCP server is running on GCP Cloud Run (TICKETS_MCP_URL).
 * Authentication uses the x-mcp-secret header.
 * We implement the 6 ticket/knowledge-base tools as native Vercel AI SDK tools
 * whose execute functions call the MCP JSON-RPC endpoint directly — this avoids
 * adding the full @modelcontextprotocol/sdk dependency.
 */

import { tool } from "ai";
import { z } from "zod";

// ─── MCP HTTP caller ──────────────────────────────────────────────────────────

async function callMcp(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const url = process.env.TICKETS_MCP_URL;
  const secret = process.env.MCP_SECRET;

  if (!url) {
    throw new Error("TICKETS_MCP_URL is not configured");
  }

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: toolName, arguments: args },
    id: Date.now()
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(secret ? { "x-mcp-secret": secret } : {})
    },
    body
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Tickets MCP returned ${response.status}: ${text.slice(0, 200)}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  // Handle SSE streaming response (Streamable HTTP)
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6)) as { result?: unknown; error?: { message: string } };
          if (data.error) throw new Error(data.error.message);
          if (data.result !== undefined) return parseMcpResult(data.result);
        } catch {
          // skip non-JSON SSE lines
        }
      }
    }
    return null;
  }

  // Handle plain JSON response
  const json = (await response.json()) as {
    result?: unknown;
    error?: { message: string; code?: number };
  };
  if (json.error) throw new Error(json.error.message);
  return parseMcpResult(json.result);
}

function parseMcpResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const r = result as { content?: Array<{ type: string; text?: string }>; [key: string]: unknown };
  if (r.content && Array.isArray(r.content)) {
    const textItem = r.content.find((c) => c.type === "text");
    if (textItem?.text) {
      try {
        return JSON.parse(textItem.text);
      } catch {
        return textItem.text;
      }
    }
  }
  return result;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const searchTicketsTool = tool({
  description:
    "Search support tickets by keyword, customer email, status, or priority. Use for finding existing tickets.",
  inputSchema: z.object({
    query: z.string().optional().describe("Keyword search within ticket subject or body"),
    customerEmail: z.string().optional().describe("Filter by customer email"),
    status: z
      .enum(["open", "in progress", "waiting", "resolved", "closed"])
      .optional()
      .describe("Filter by ticket status"),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Filter by priority"),
    limit: z.number().optional().default(10)
  }),
  execute: async (args) => {
    try {
      return await callMcp("search_tickets", {
        ...args,
        projectKey: process.env.COMMERCETOOLS_PROJECT_KEY
      });
    } catch (err) {
      return { error: String(err) };
    }
  }
});

const getTicketTool = tool({
  description: "Retrieve a single ticket by its ID.",
  inputSchema: z.object({
    id: z.string().describe("Ticket ID"),
    projectKey: z.string().optional()
  }),
  execute: async ({ id, projectKey }) => {
    try {
      return await callMcp("get_ticket", {
        id,
        projectKey: projectKey ?? process.env.COMMERCETOOLS_PROJECT_KEY
      });
    } catch (err) {
      return { error: String(err) };
    }
  }
});

const createTicketTool = tool({
  description:
    "Create a new support ticket for a customer. Always fill subject, customerEmail, and priority.",
  inputSchema: z.object({
    subject: z.string().describe("Short ticket subject line"),
    customerEmail: z.string().describe("Customer's email address"),
    customerName: z.string().optional().describe("Customer's display name"),
    category: z
      .enum(["order", "shipping", "returns", "billing", "product", "account", "technical", "other"])
      .optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    status: z.enum(["open", "in progress", "waiting"]).default("open"),
    assignee: z.string().optional().describe("Agent assigned to this ticket"),
    source: z.enum(["email", "chat", "phone", "web", "csa_assistant"]).default("csa_assistant")
  }),
  execute: async (args) => {
    try {
      return await callMcp("create_ticket", {
        draft: {
          ...args,
          projectKey: process.env.COMMERCETOOLS_PROJECT_KEY
        }
      });
    } catch (err) {
      return { error: String(err) };
    }
  }
});

const updateTicketTool = tool({
  description:
    "Update a ticket's status, priority, assignee, category, or subject. ALWAYS require action_approval before status changes.",
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
      return await callMcp("update_ticket", { id, patch });
    } catch (err) {
      return { error: String(err) };
    }
  }
});

const searchKnowledgeBaseTool = tool({
  description:
    "Search the knowledge base for articles related to a customer issue. Use when the agent needs policy info or troubleshooting steps.",
  inputSchema: z.object({
    query: z.string().describe("Search term or question"),
    limit: z.number().optional().default(5)
  }),
  execute: async ({ query, limit }) => {
    try {
      return await callMcp("search_knowledge_base", {
        query,
        limit,
        projectKey: process.env.COMMERCETOOLS_PROJECT_KEY
      });
    } catch (err) {
      return { error: String(err) };
    }
  }
});

const getKnowledgeBaseArticleTool = tool({
  description: "Retrieve the full text of a specific knowledge base article by ID.",
  inputSchema: z.object({
    id: z.string().describe("Knowledge base article ID")
  }),
  execute: async ({ id }) => {
    try {
      return await callMcp("get_knowledge_base_article", { id });
    } catch (err) {
      return { error: String(err) };
    }
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

export function buildTicketTools() {
  const ticketsMcpUrl = process.env.TICKETS_MCP_URL;

  if (!ticketsMcpUrl) {
    console.warn("[tickets] TICKETS_MCP_URL not configured — ticket tools disabled");
    return {};
  }

  return {
    search_tickets: searchTicketsTool,
    get_ticket: getTicketTool,
    create_ticket: createTicketTool,
    update_ticket: updateTicketTool,
    search_knowledge_base: searchKnowledgeBaseTool,
    get_knowledge_base_article: getKnowledgeBaseArticleTool
  };
}
