import { gql } from "graphql-tag";
import { createTicket, getTicket, listTickets, updateTicket } from "./tickets/repository.js";
import type { TicketDraft, TicketListArgs, TicketUpdate } from "./tickets/types.js";

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
  }

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
  }

  extend type Query {
    ticket(id: ID!, projectKey: String): Ticket
    ticketPage(
      projectKey: String
      search: String
      customerEmail: String
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
  }
`;

export const resolvers = {
  Mutation: {
    createTicket: (_parent: unknown, args: { draft: TicketDraft }) =>
      createTicket(args.draft),
    updateTicket: (_parent: unknown, args: { id: string; patch: TicketUpdate & { projectKey?: string | null } }) =>
      updateTicket(args.id, args.patch)
  },
  Query: {
    ticket: (_parent: unknown, args: { id: string; projectKey?: string | null }) =>
      getTicket(args.id, args.projectKey),
    ticketPage: (_parent: unknown, args: TicketListArgs) => listTickets(args),
    tickets: async (_parent: unknown, args: TicketListArgs) => {
      const page = await listTickets(args);

      return page.results;
    }
  }
};
