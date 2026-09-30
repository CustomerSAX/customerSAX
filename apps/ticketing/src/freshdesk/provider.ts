import { freshdeskClient, type FreshdeskCredentials } from "@csa/mongodb";
import type { TicketingProvider } from "../providers/types.js";
import type { Ticket, TicketUpdate } from "../tickets/types.js";

type RemoteTicket = {
  id: number;
  subject: string;
  description_text?: string;
  status: number;
  priority: number;
  created_at: string;
  updated_at: string;
  source?: number;
  type?: string;
  tags?: string[];
  responder_id?: number | null;
  requester?: { name?: string; email?: string };
  custom_fields?: Record<string, unknown>;
  attachments?: Array<{ name: string; attachment_url: string; size: number }>;
};
type Conversation = {
  id: number;
  body_text: string;
  private: boolean;
  user_id: number;
  created_at: string;
  attachments?: RemoteTicket["attachments"];
};
const statuses: Record<number, string> = {
  2: "Open",
  3: "Pending",
  4: "Resolved",
  5: "Closed"
};
const priorities: Record<number, string> = {
  1: "low",
  2: "normal",
  3: "high",
  4: "urgent"
};
const html = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
export function freshdeskProvider(
  projectKey: string,
  credentials: FreshdeskCredentials
): TicketingProvider {
  const api = freshdeskClient(credentials);
  const prefix = `freshdesk:${credentials.domain}:`;
  function externalId(id: string) {
    const value = id.startsWith(prefix) ? id.slice(prefix.length) : id;
    if (!/^[1-9][0-9]{0,19}$/.test(value))
      throw new Error("Expected a ticket ID from the configured Freshdesk account");
    return value;
  }
  const attachments = (items: RemoteTicket["attachments"] = []) =>
    items.map((a) => ({ name: a.name, url: a.attachment_url, size: String(a.size) }));
  function map(t: RemoteTicket): Ticket {
    return {
      id: `${prefix}${t.id}`,
      ticketNumber: String(t.id),
      projectKey,
      subject: t.subject,
      status: statuses[t.status] || String(t.status),
      priority: priorities[t.priority] || String(t.priority),
      customerEmail: t.requester?.email,
      customerName: t.requester?.name,
      assignee: t.responder_id ? String(t.responder_id) : "Queue",
      message: t.description_text,
      createdAt: t.created_at,
      lastModifiedAt: t.updated_at,
      source:
        (
          { 1: "Email", 2: "Web", 3: "Phone", 7: "Chat", 9: "Social" } as Record<
            number,
            string
          >
        )[t.source || 0] || "Freshdesk",
      category: t.type,
      comments: [],
      attachments: attachments(t.attachments),
      history: []
    };
  }
  async function read(id: string) {
    try {
      return await api<RemoteTicket>(`tickets/${externalId(id)}?include=requester`);
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  }
  async function getTicket(id: string) {
    const raw = await read(id);
    if (!raw) return null;
    const ticket = map(raw);
    for (let page = 1; page <= 100; page++) {
      const notes = await api<Conversation[]>(
        `tickets/${externalId(id)}/conversations?per_page=100&page=${page}`
      );
      ticket.comments.push(
        ...notes.map((n) => ({
          id: String(n.id),
          comment: n.body_text,
          status: n.private ? "internal" : "public",
          author: String(n.user_id),
          createdAt: n.created_at
        }))
      );
      ticket.attachments.push(...notes.flatMap((n) => attachments(n.attachments)));
      if (notes.length < 100) return ticket;
    }
    throw new Error("Freshdesk conversation limit reached");
  }
  async function writable(input: TicketUpdate, creating = false) {
    if (input.attachments?.length)
      throw new Error("Freshdesk attachment upload is not supported yet");
    if (input.comments?.length || input.worklog)
      throw new Error(
        "Add Freshdesk notes using Add Internal Note after creating the ticket"
      );
    for (const key of [
      "customerId",
      "orderNumber",
      "solution",
      "timeSpentOnTicket"
    ] as const) {
      if (input[key]) throw new Error(`Freshdesk ${key} mapping is not configured`);
    }
    const body: Record<string, unknown> = {};
    if (input.subject != null) body.subject = input.subject;
    if (input.category) body.type = input.category;
    if (input.message !== undefined)
      body.description = html(input.message || input.subject || "Ticket");
    if (input.status) {
      const status = (
        {
          open: 2,
          "in progress": 2,
          pending: 3,
          waiting: 3,
          resolved: 4,
          closed: 5
        } as Record<string, number>
      )[input.status.toLowerCase().replace(/[_-]/g, " ")];
      if (!status) throw new Error("Unsupported Freshdesk status");
      body.status = status;
    } else if (creating) body.status = 2;
    if (input.priority) {
      const priority = (
        { low: 1, normal: 2, medium: 2, high: 3, urgent: 4 } as Record<string, number>
      )[input.priority.toLowerCase()];
      if (!priority) throw new Error("Unsupported Freshdesk priority");
      body.priority = priority;
    } else if (creating) body.priority = 2;
    if (input.customerEmail) body.email = input.customerEmail;
    if (input.customerName) body.name = input.customerName;
    if (input.assignee !== undefined) {
      if (!input.assignee || input.assignee === "Queue") body.responder_id = null;
      else if (/^[1-9][0-9]*$/.test(input.assignee))
        body.responder_id = Number(input.assignee);
      else {
        const agents = await api<Array<{ id: number; contact: { email: string } }>>(
          `agents?email=${encodeURIComponent(input.assignee)}`
        );
        const agent = agents.find(
          (a) => a.contact.email.toLowerCase() === input.assignee!.toLowerCase()
        );
        if (!agent) throw new Error("Assignee must be an agent in the Freshdesk account");
        body.responder_id = agent.id;
      }
    }
    return body;
  }
  return {
    getTicket,
    // A bounded snapshot supplies accurate totals and sorting for the existing UI.
    // Never silently truncate larger accounts or return a fabricated total.
    listTickets: async (args) => {
      const rows: RemoteTicket[] = [];
      for (let page = 1; ; page++) {
        const batch = await api<RemoteTicket[]>(
          `tickets?updated_since=1970-01-01T00%3A00%3A00Z&include=requester&per_page=100&page=${page}`
        );
        rows.push(...batch);
        if (rows.length > 1000)
          throw new Error(
            "Freshdesk initial adapter supports up to 1,000 tickets; larger accounts require server-side search integration"
          );
        if (batch.length < 100) break;
      }
      let tickets = rows.map(map);
      for (const [key, value] of Object.entries({
        status: args.status,
        priority: args.priority,
        customerEmail: args.customerEmail,
        assignee: args.assignee,
        category: args.category
      })) {
        if (value)
          tickets = tickets.filter(
            (t) =>
              String(t[key as keyof Ticket] ?? "").toLowerCase() === value.toLowerCase()
          );
      }
      if (args.customerId)
        throw new Error("Freshdesk customer ID mapping is not configured");
      if (args.search) {
        const q = args.search.toLowerCase();
        tickets = tickets.filter((t) =>
          [t.subject, t.ticketNumber, t.customerEmail].some((v) =>
            v?.toLowerCase().includes(q)
          )
        );
      }
      const sorts = [
        "lastModifiedAt",
        "createdAt",
        "ticketNumber",
        "subject",
        "status",
        "priority"
      ];
      const key = args.sortKey || "lastModifiedAt";
      if (!sorts.includes(key)) throw new Error("Unsupported Freshdesk sort field");
      tickets.sort(
        (a, b) =>
          String(a[key as keyof Ticket] ?? "").localeCompare(
            String(b[key as keyof Ticket] ?? ""),
            undefined,
            { numeric: true }
          ) * (args.sortOrder === "asc" ? 1 : -1)
      );
      const offset = Math.max(0, args.offset ?? 0),
        limit = Math.min(100, Math.max(1, args.limit ?? 20));
      const results = tickets.slice(offset, offset + limit);
      return { results, total: tickets.length, count: results.length, offset };
    },
    createTicket: async (draft) => {
      if (!draft.subject.trim() || !draft.customerEmail)
        throw new Error("Subject and customer email are required");
      const body = await writable(draft, true);
      body.description ||= html(draft.subject);
      return map(await api<RemoteTicket>("tickets", "POST", body));
    },
    updateTicket: async (id, patch) => {
      const number = externalId(id);
      try {
        return map(
          await api<RemoteTicket>(`tickets/${number}`, "PUT", await writable(patch))
        );
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
    addWorklog: async (id, comment) => {
      if (!comment.comment.trim()) throw new Error("Note cannot be empty");
      await api(`tickets/${externalId(id)}/notes`, "POST", {
        body: html(comment.comment),
        private: true
      });
      return getTicket(id);
    },
    getFields: async (id) => {
      const ticket = await read(id);
      if (!ticket) throw new Error("Freshdesk ticket not found");
      const fields =
        await api<
          Array<{ name: string; label: string; type: string; choices?: unknown }>
        >("ticket_fields");
      return fields
        .filter((f) => Object.hasOwn(ticket.custom_fields ?? {}, f.name))
        .map((f) => {
          const v = ticket.custom_fields?.[f.name];
          return {
            id: f.name,
            label: f.label,
            type: f.type,
            value:
              v == null
                ? null
                : typeof v === "boolean"
                  ? v
                    ? "Yes"
                    : "No"
                  : typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v)
          };
        });
    }
  };
}
