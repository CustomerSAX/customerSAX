import { gql } from "graphql-tag";
import { addWorklog, createTicket, getTicket, listTickets, updateTicket } from "./tickets/repository.js";
import type { TicketDraft, TicketListArgs, TicketUpdate, WorklogComment } from "./tickets/types.js";

type TicketingContext = { clientId?: string; projectKey?: string };

function selectedProject(context: unknown) {
  const projectKey = (context as TicketingContext | undefined)?.projectKey?.trim();
  if (!projectKey) throw new Error("An active project is required for ticket operations");
  return projectKey;
}

export const typeDefs = gql`
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
    addTicketWorklog(id: ID!, comment: WorklogCommentInput!, projectKey: String): Ticket
  }
`;

export const resolvers = {
  Mutation: {
    createTicket: (_parent: unknown, args: { draft: TicketDraft }, context: unknown) =>
      createTicket({ ...args.draft, projectKey: selectedProject(context) }),
    updateTicket: (_parent: unknown, args: { id: string; patch: TicketUpdate & { projectKey?: string | null } }, context: unknown) =>
      updateTicket(args.id, { ...args.patch, projectKey: selectedProject(context) }),
    addTicketWorklog: (_parent: unknown, args: { id: string; comment: WorklogComment }, context: unknown) =>
      addWorklog(args.id, args.comment, selectedProject(context))
  },
  Query: {
    ticket: (_parent: unknown, args: { id: string }, context: unknown) =>
      getTicket(args.id, selectedProject(context)),
    ticketPage: (_parent: unknown, args: TicketListArgs, context: unknown) =>
      listTickets({ ...args, projectKey: selectedProject(context) }),
    tickets: async (_parent: unknown, args: TicketListArgs, context: unknown) => {
      const page = await listTickets({ ...args, projectKey: selectedProject(context) });

      return page.results;
    }
  }
};
