import { GraphQLError } from "graphql";
import type { TicketingProvider } from "../providers/types.js";
import type { Ticket, TicketUpdate } from "../tickets/types.js";
import { api as localApi, error, zendeskConfig } from "./client.js";
import { ticketFields } from "./fields.js";

type User = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  suspended?: boolean;
};
type RemoteTicket = {
  id: number;
  subject: string;
  description?: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  requester_id?: number;
  assignee_id?: number;
  via?: { channel?: string };
  custom_fields?: Array<{ id: number; value: unknown }>;
};
type RemoteComment = {
  id: number;
  body: string;
  created_at: string;
  author_id: number;
  public: boolean;
  attachments?: Array<{ file_name: string; content_url: string; size: number }>;
};
const customNames = [
  "category",
  "customerId",
  "orderNumber",
  "solution",
  "timeSpentOnTicket",
  "contactType",
  "source"
] as const;
type Mappings = Partial<Record<(typeof customNames)[number], number>>;

export function fieldMappings(): Mappings {
  let fields: Mappings;
  try {
    fields = JSON.parse(process.env.ZENDESK_FIELD_MAPPINGS || "{}");
  } catch {
    error("ZENDESK_FIELD_MAPPINGS must be a JSON object");
  }
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    error("ZENDESK_FIELD_MAPPINGS must be a JSON object");
  for (const [key, value] of Object.entries(fields)) {
    if (
      !customNames.includes(key as (typeof customNames)[number]) ||
      !Number.isSafeInteger(value) ||
      value <= 0
    )
      error(
        "Zendesk mappings must use supported field names and positive numeric field IDs"
      );
  }
  return fields;
}

export function statusToZendesk(value: string) {
  const status = (
    {
      open: "open",
      "in progress": "open",
      waiting: "pending",
      pending: "pending",
      resolved: "solved",
      closed: "closed"
    } as Record<string, string>
  )[value.trim().toLowerCase().replace(/[_-]/g, " ")];
  if (!status) error("Unsupported ticket status");
  return status;
}
function priority(value: string) {
  const key = value.trim().toLowerCase();
  if (!["low", "normal", "medium", "high", "urgent"].includes(key))
    error("Unsupported priority");
  return key === "medium" ? "normal" : key;
}
const literal = (value: string) => `"${value.replace(/[\\"\r\n]/g, " ")}"`;

export function zendeskProvider(projectKey: string, connection?: { subdomain: string; api: typeof localApi }): TicketingProvider {
  const config = connection ?? zendeskConfig();
  const api = connection?.api ?? localApi;
  if (!projectKey.trim()) error("An active project is required for ticket operations");
  const fields = connection ? {} as Mappings : fieldMappings();
  const prefix = `zendesk:${config.subdomain}:`;
  function externalId(id: string) {
    const value = id.startsWith(prefix) ? id.slice(prefix.length) : id;
    if (!/^[1-9][0-9]{0,19}$/.test(value))
      error("Expected a ticket ID from the configured Zendesk account");
    return value;
  }
  function map(ticket: RemoteTicket, users: User[] = []): Ticket {
    const field = (key: (typeof customNames)[number]) => {
      const value = ticket.custom_fields?.find((f) => f.id === fields[key])?.value;
      return value == null ? null : String(value);
    };
    return {
      id: `${prefix}${ticket.id}`,
      ticketNumber: String(ticket.id),
      projectKey,
      subject: ticket.subject,
      message: ticket.description,
      status:
        (
          {
            new: "Open",
            open: "In Progress",
            pending: "Pending",
            hold: "Pending",
            solved: "Resolved",
            closed: "Closed"
          } as Record<string, string>
        )[ticket.status] || ticket.status,
      priority: ticket.priority || "normal",
      createdAt: ticket.created_at,
      lastModifiedAt: ticket.updated_at,
      customerEmail: users.find((u) => u.id === ticket.requester_id)?.email,
      customerName: users.find((u) => u.id === ticket.requester_id)?.name,
      assignee:
        users.find((u) => u.id === ticket.assignee_id)?.email ||
        (ticket.assignee_id ? String(ticket.assignee_id) : "Queue"),
      category: field("category"),
      customerId: field("customerId"),
      orderNumber: field("orderNumber"),
      solution: field("solution"),
      timeSpentOnTicket: field("timeSpentOnTicket"),
      contactType: field("contactType") || ticket.via?.channel,
      source: field("source") || ticket.via?.channel || "Zendesk",
      comments: [],
      attachments: [],
      history: []
    };
  }
  async function read(id: string) {
    try {
      return await api<{ ticket: RemoteTicket; users?: User[] }>(
        `tickets/${externalId(id)}.json?include=users`
      );
    } catch (e) {
      if (e instanceof GraphQLError && e.extensions.code === "NOT_FOUND") return null;
      throw e;
    }
  }
  async function getTicket(id: string) {
    const data = await read(id);
    if (!data) return null;
    const ticket = map(data.ticket, data.users);
    for (let page = 1; ; page++) {
      const comments = await api<{
        comments: RemoteComment[];
        users?: User[];
        next_page?: string | null;
      }>(
        `tickets/${externalId(id)}/comments.json?include=users&per_page=100&page=${page}`
      );
      for (const c of comments.comments) {
        ticket.comments.push({
          id: String(c.id),
          comment: c.body,
          createdAt: c.created_at,
          status: c.public ? "public" : "internal",
          author:
            comments.users?.find((u) => u.id === c.author_id)?.email ||
            String(c.author_id)
        });
        ticket.attachments.push(
          ...(c.attachments || []).map((a) => ({
            name: a.file_name,
            url: a.content_url,
            size: String(a.size)
          }))
        );
      }
      if (!comments.next_page) break;
      if (page >= 100)
        error("Too many comments for this initial adapter", "PAGINATION_LIMIT");
    }
    return Object.assign(ticket, { zendeskDetailsLoaded: true });
  }
  async function assignee(value: string | null) {
    if (!value || value === "Queue") return null;
    const users = /^[1-9][0-9]*$/.test(value)
      ? [(await api<{ user: User }>(`users/${value}.json`)).user]
      : (
          await api<{ users: User[] }>(
            `users/search.json?query=${encodeURIComponent(value)}`
          )
        ).users.filter((u) => u.email?.toLowerCase() === value.toLowerCase());
    const user = users.find(
      (u) => ["agent", "admin"].includes(u.role || "") && !u.suspended
    );
    if (!user) error("Assignee must be an agent in the configured Zendesk account");
    return user.id;
  }
  async function writable(input: TicketUpdate, creating = false) {
    if (input.attachments?.length)
      error("Attachment upload is not included in this step", "UNSUPPORTED_OPERATION");
    if (!creating && input.comments != null)
      error("Use addTicketWorklog to append comments", "UNSUPPORTED_OPERATION");
    if (!creating && input.message !== undefined)
      error(
        "Zendesk descriptions cannot be replaced; add a worklog",
        "UNSUPPORTED_OPERATION"
      );
    const body: Record<string, unknown> = {};
    if (input.subject != null) body.subject = input.subject;
    if (input.status) {
      body.status = statusToZendesk(input.status);
      if (body.status === "closed")
        error(
          "Resolve Zendesk tickets; Zendesk manages closing them",
          "UNSUPPORTED_OPERATION"
        );
    }
    if (input.priority) body.priority = priority(input.priority);
    if (input.customerEmail)
      body.requester = {
        email: input.customerEmail,
        name: input.customerName || input.customerEmail
      };
    if (input.assignee !== undefined) body.assignee_id = await assignee(input.assignee);
    const custom: Array<{ id: number; value: string | null }> = [];
    for (const key of customNames) {
      if (input[key] === undefined) continue;
      if (fields[key]) custom.push({ id: fields[key]!, value: input[key] ?? null });
      else if (input[key] && key !== "source" && key !== "contactType")
        error(`Set ZENDESK_FIELD_MAPPINGS for ${key} before sending this field`);
    }
    if (custom.length) body.custom_fields = custom;
    return body;
  }
  async function update(id: string, body: Record<string, unknown>) {
    const existing = await read(id);
    if (!existing) return null;
    if (existing.ticket.status === "closed")
      error("Closed Zendesk tickets are read-only", "UNSUPPORTED_OPERATION");
    const data = await api<{ ticket: RemoteTicket }>(
      `tickets/${externalId(id)}.json`,
      "PUT",
      {
        ticket: { ...body, safe_update: true, updated_stamp: existing.ticket.updated_at }
      }
    );
    return map(data.ticket, existing.users);
  }
  return {
    getFields: async id => {
      const data = await read(id);
      if (!data) error("Zendesk ticket not found", "NOT_FOUND");
      return ticketFields(data.ticket, api);
    },
    getTicket,
    listTickets: async (args) => {
      const limit = Math.min(100, Math.max(1, Math.floor(args.limit ?? 20)));
      const offset = Math.max(0, Math.floor(args.offset ?? 0));
      if (offset + limit > 1000)
        error(
          "Zendesk search is limited to 1,000 retrievable results; narrow the filters",
          "PAGINATION_LIMIT"
        );
      const terms = ["type:ticket"];
      if (args.search) terms.push(literal(args.search));
      if (args.status) terms.push(`status:${statusToZendesk(args.status)}`);
      if (args.priority) terms.push(`priority:${priority(args.priority)}`);
      if (args.customerEmail) terms.push(`requester:${literal(args.customerEmail)}`);
      if (args.assignee)
        terms.push(
          `assignee:${args.assignee === "Queue" ? "none" : literal(args.assignee)}`
        );
      for (const key of ["category", "customerId"] as const) {
        if (!args[key]) continue;
        if (!fields[key]) error(`Set ZENDESK_FIELD_MAPPINGS for ${key} before filtering`);
        terms.push(`custom_field_${fields[key]}:${literal(args[key]!)}`);
      }
      const sorts: Record<string, string> = {
        lastModifiedAt: "updated_at",
        createdAt: "created_at",
        priority: "priority",
        status: "status",
        ticketNumber: "id"
      };
      if (args.sortKey && !sorts[args.sortKey]) error("Unsupported Zendesk sort field");
      const params = new URLSearchParams({
        query: terms.join(" "),
        per_page: "100",
        page: String(Math.floor(offset / 100) + 1),
        sort_by: sorts[args.sortKey || "lastModifiedAt"],
        sort_order: args.sortOrder === "asc" ? "asc" : "desc",
        include: "tickets(users)"
      });
      type Page = { results: RemoteTicket[]; count: number; users?: User[] };
      const first = await api<Page>(`search.json?${params}`);
      let rows = first.results;
      let users = first.users || [];
      if (
        (offset % 100) + limit > 100 &&
        Math.floor(offset / 100) * 100 + rows.length < first.count
      ) {
        params.set("page", String(Math.floor(offset / 100) + 2));
        const next = await api<Page>(`search.json?${params}`);
        rows = rows.concat(next.results);
        users = users.concat(next.users || []);
      }
      const results = rows
        .slice(offset % 100, (offset % 100) + limit)
        .map((t) => map(t, users));
      return { results, total: first.count, count: results.length, offset };
    },
    createTicket: async (draft) => {
      if (!draft.subject.trim() || !draft.customerEmail)
        error("Subject and customerEmail are required for Zendesk tickets");
      const body = await writable(draft, true);
      body.comment = {
        body: [
          draft.message || draft.subject,
          draft.worklog,
          ...(draft.comments || []).map((c) => c.comment)
        ]
          .filter(Boolean)
          .join("\n\n"),
        public: false
      };
      const { ticket } = await api<{ ticket: RemoteTicket }>("tickets.json", "POST", {
        ticket: body
      });
      return map(ticket, [
        {
          id: ticket.requester_id!,
          email: draft.customerEmail,
          name: draft.customerName || draft.customerEmail
        }
      ]);
    },
    updateTicket: async (id, patch) => update(id, await writable(patch)),
    addWorklog: async (id, comment) => {
      if (!comment.comment.trim()) error("Worklog cannot be empty");
      return update(id, { comment: { body: comment.comment, public: false } });
    }
  };
}
