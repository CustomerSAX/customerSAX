import { gql } from "graphql-tag";
import { changeSubscriptionStatus, createSubscription, deleteSubscriptionDraft, getSubscription, listSubscriptions, skipSubscriptionCycle, updateSubscription } from "./subscriptions/repository.js";
import type { SubscriptionDraft, SubscriptionListArgs, SubscriptionStatus, SubscriptionUpdate } from "./subscriptions/types.js";

type SubscriptionContext = { projectKey?: string; userEmail?: string };

function selectedProject(context: unknown) {
  const projectKey = (context as SubscriptionContext | undefined)?.projectKey?.trim() || process.env.SUBSCRIPTIONS_PROJECT_KEY?.trim();
  if (!projectKey) throw new Error("An active project is required for subscription operations");
  return projectKey;
}

function actor(context: unknown) {
  return (context as SubscriptionContext | undefined)?.userEmail?.trim() || "Current Agent";
}

export const typeDefs = gql`
  type Subscription @key(fields: "id") {
    id: ID!
    subscriptionNumber: String!
    ownerType: String!
    customerId: String
    customerName: String!
    customerEmail: String!
    createdBy: String!
    businessAccountName: String
    status: String!
    frequency: String!
    startDate: String!
    scheduleTime: String
    nextDeliveryDate: String!
    endDate: String
    shippingAddress: String!
    paymentMethod: String!
    currencyCode: String!
    discountLabel: String
    priceOverride: String
    cancellationReason: String
    lastOrderNumber: String
    linkedOrderNumbers: [String!]!
    lineItems: [SubscriptionLineItem!]!
    history: [SubscriptionHistoryEntry!]!
    createdAt: String!
    updatedAt: String!
  }

  type SubscriptionLineItem { id: String!, sku: String!, name: String!, quantity: Int!, unitPrice: Float! }
  type SubscriptionHistoryEntry { id: String!, action: String!, actor: String!, createdAt: String!, note: String }

  input SubscriptionLineItemInput { id: String!, sku: String!, name: String!, quantity: Int!, unitPrice: Float! }
  input SubscriptionDraftInput {
    ownerType: String!
    customerId: String
    customerName: String!
    customerEmail: String!
    businessAccountName: String
    status: String!
    frequency: String!
    startDate: String!
    scheduleTime: String
    nextDeliveryDate: String!
    endDate: String
    shippingAddress: String!
    paymentMethod: String!
    currencyCode: String!
    discountLabel: String
    priceOverride: String
    cancellationReason: String
    lastOrderNumber: String
    linkedOrderNumbers: [String!]
    lineItems: [SubscriptionLineItemInput!]!
  }
  input SubscriptionUpdateInput {
    ownerType: String
    customerId: String
    customerName: String
    customerEmail: String
    businessAccountName: String
    status: String
    frequency: String
    startDate: String
    scheduleTime: String
    nextDeliveryDate: String
    endDate: String
    shippingAddress: String
    paymentMethod: String
    currencyCode: String
    discountLabel: String
    priceOverride: String
    cancellationReason: String
    lastOrderNumber: String
    linkedOrderNumbers: [String!]
    lineItems: [SubscriptionLineItemInput!]
  }

  extend type Query {
    subscription(id: ID!): Subscription
    subscriptions(customerId: String, customerEmail: String, status: String, limit: Int = 100, offset: Int = 0): [Subscription!]!
  }

  extend type Mutation {
    createSubscription(draft: SubscriptionDraftInput!): Subscription!
    updateSubscription(id: ID!, patch: SubscriptionUpdateInput!): Subscription
    changeSubscriptionStatus(id: ID!, status: String!, note: String): Subscription
    skipSubscriptionCycle(id: ID!): Subscription
    deleteSubscriptionDraft(id: ID!): Boolean!
  }
`;

export const resolvers = {
  Query: {
    subscription: (_parent: unknown, args: { id: string }, context: unknown) => getSubscription(args.id, selectedProject(context)),
    subscriptions: (_parent: unknown, args: SubscriptionListArgs, context: unknown) => listSubscriptions({ ...args, projectKey: selectedProject(context) })
  },
  Mutation: {
    createSubscription: (_parent: unknown, args: { draft: SubscriptionDraft }, context: unknown) => createSubscription(args.draft, selectedProject(context), actor(context)),
    updateSubscription: (_parent: unknown, args: { id: string; patch: SubscriptionUpdate }, context: unknown) => updateSubscription(args.id, args.patch, selectedProject(context), actor(context)),
    changeSubscriptionStatus: (_parent: unknown, args: { id: string; status: SubscriptionStatus; note?: string | null }, context: unknown) => changeSubscriptionStatus(args.id, args.status, args.note, selectedProject(context), actor(context)),
    skipSubscriptionCycle: (_parent: unknown, args: { id: string }, context: unknown) => skipSubscriptionCycle(args.id, selectedProject(context), actor(context)),
    deleteSubscriptionDraft: (_parent: unknown, args: { id: string }, context: unknown) => deleteSubscriptionDraft(args.id, selectedProject(context))
  }
};
