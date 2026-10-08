import { gql } from "graphql-tag";
import { resolveTicketing } from "./providers/index.js";
import type { Ticket, TicketDraft, TicketListArgs, TicketUpdate, WorklogComment } from "./tickets/types.js";

type TicketingContext = { clientId?: string; projectKey?: string };

function selectedProject(context: unknown) {
  const projectKey = (context as TicketingContext | undefined)?.projectKey?.trim() || process.env.TICKETING_PROJECT_KEY?.trim();
  if (!projectKey) throw new Error("An active project is required for ticket operations");
  return projectKey;
}

async function selectedProvider(context: unknown) {
  return (await resolveTicketing(selectedProject(context), (context as TicketingContext | undefined)?.clientId)).provider;
}

export const typeDefs = gql`
  type TicketProviderField { id: ID!, label: String!, type: String!, value: String }
  type Ticket @key(fields: "id") {
    id: ID!
    ticketNumber: String!
    projectKey: String!
    customerName: String
    customerEmail: String
    source: String
    status: String!
    priority: String!
    category: String
    subject: String!
    assignee: String
    createdAt: String
    lastModifiedAt: String
    customerId: String
    contactType: String
    orderNumber: String
    createdBy: String
    message: String
    solution: String
    timeSpentOnTicket: String
    resolutionDate: String
    comments: [WorklogComment!]!
    attachments: [TicketAttachment!]!
    history: [TicketHistoryEntry!]!
  }

  type WorklogComment { id: ID!, comment: String!, createdAt: String!, status: String!, author: String }
  type TicketAttachment { name: String!, url: String!, size: String }
  type TicketHistoryEntry { id: ID!, ticketNumber: String!, operationDate: String!, reason: String!, solution: String, status: String!, priority: String!, assignedTo: String!, worklog: String, timeSpent: String }
  input WorklogCommentInput { id: ID!, comment: String!, createdAt: String!, status: String!, author: String }
  input TicketAttachmentInput { name: String!, url: String!, size: String }

  type TicketPage {
    results: [Ticket!]!
    total: Int!
    count: Int!
    offset: Int!
  }

  input TicketDraftInput {
    projectKey: String
    customerName: String
    customerEmail: String
    source: String
    status: String
    priority: String
    category: String
    subject: String!
    assignee: String
    customerId: String
    contactType: String
    orderNumber: String
    createdBy: String
    message: String
    solution: String
    timeSpentOnTicket: String
    comments: [WorklogCommentInput!]
    attachments: [TicketAttachmentInput!]
  }

  input TicketUpdateInput {
    projectKey: String
    customerName: String
    customerEmail: String
    source: String
    status: String
    priority: String
    category: String
    subject: String
    assignee: String
    customerId: String
    contactType: String
    orderNumber: String
    message: String
    solution: String
    timeSpentOnTicket: String
    comments: [WorklogCommentInput!]
    attachments: [TicketAttachmentInput!]
  }

  extend type Query {
    ticketingProvider: String!
    ticketProviderFields(id: ID!): [TicketProviderField!]!
    ticket(id: ID!, projectKey: String): Ticket
    ticketPage(
      projectKey: String
      search: String
      customerEmail: String
      customerId: String
      status: String
      priority: String
      category: String
      assignee: String
      limit: Int = 20
      offset: Int = 0
      sortKey: String
      sortOrder: String
    ): TicketPage!
    tickets(projectKey: String, limit: Int = 20, offset: Int = 0): [Ticket!]!
  }

  extend type Mutation {
    createTicket(draft: TicketDraftInput!): Ticket!
    updateTicket(id: ID!, patch: TicketUpdateInput!): Ticket
    closeTicketIfUnchanged(id: ID!, expectedLastModifiedAt: String!, solution: String!): Ticket
    addTicketWorklog(id: ID!, comment: WorklogCommentInput!, projectKey: String): Ticket
  }
`;

// Only load remote conversation data if requested; share the result between fields.
const remoteDetails = new WeakMap<Ticket, Promise<Ticket | null>>();
function detail(ticket: Ticket & { zendeskDetailsLoaded?: boolean }, context: unknown) {
  if (!ticket.id.startsWith("zendesk:") || ticket.zendeskDetailsLoaded) return Promise.resolve(ticket);
  let pending = remoteDetails.get(ticket);
  if (!pending) {
    pending = selectedProvider(context).then(provider => provider.getTicket(ticket.id));
    remoteDetails.set(ticket, pending);
  }
  return pending;
}

export const resolvers = {
  Ticket: {
    comments: async (ticket: Ticket, _args: unknown, context: unknown) => (await detail(ticket, context))?.comments || [],
    attachments: async (ticket: Ticket, _args: unknown, context: unknown) => (await detail(ticket, context))?.attachments || [],
  },
  Mutation: {
    closeTicketIfUnchanged: async (_parent: unknown, args: { id: string; expectedLastModifiedAt: string; solution: string }, context: unknown) => {
      const provider = await selectedProvider(context);
      if (!provider.closeIfUnchanged) throw new Error("Conditional closure is available only for native tickets");
      return provider.closeIfUnchanged(args.id, args.expectedLastModifiedAt, args.solution);
    },
    createTicket: async (_parent: unknown, args: { draft: TicketDraft }, context: unknown) =>
      (await selectedProvider(context)).createTicket(args.draft),
    updateTicket: async (_parent: unknown, args: { id: string; patch: TicketUpdate & { projectKey?: string | null } }, context: unknown) =>
      (await selectedProvider(context)).updateTicket(args.id, args.patch),
    addTicketWorklog: async (_parent: unknown, args: { id: string; comment: WorklogComment }, context: unknown) =>
      (await selectedProvider(context)).addWorklog(args.id, args.comment)
  },
  Query: {
    ticketingProvider: async (_parent: unknown, _args: unknown, context: unknown) =>
      (await resolveTicketing(selectedProject(context), (context as TicketingContext | undefined)?.clientId)).name,
    ticketProviderFields: async (_parent: unknown, args: { id: string }, context: unknown) =>
      (await selectedProvider(context)).getFields?.(args.id) ?? [],
    ticket: async (_parent: unknown, args: { id: string }, context: unknown) =>
      (await selectedProvider(context)).getTicket(args.id),
    ticketPage: async (_parent: unknown, args: TicketListArgs, context: unknown) =>
      (await selectedProvider(context)).listTickets(args),
    tickets: async (_parent: unknown, args: TicketListArgs, context: unknown) => {
      const page = await (await selectedProvider(context)).listTickets(args);

      return page.results;
    }
  }
};
