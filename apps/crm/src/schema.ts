import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import { resolveCrm } from "./providers/index.js";
import type { CrmActivityDraft, CrmContactSearchArgs, CrmContactUpdate } from "./crm/types.js";

type CrmContext = { clientId?: string; projectKey?: string; userRole?: string };

function selectedProject(context: unknown) {
  const projectKey = (context as CrmContext | undefined)?.projectKey?.trim() || process.env.CRM_PROJECT_KEY?.trim();
  if (!projectKey) throw new Error("An active project is required for CRM operations");
  return projectKey;
}

function resolveSelected(context: unknown) {
  return resolveCrm(selectedProject(context), (context as CrmContext | undefined)?.clientId);
}

async function selectedProvider(context: unknown) {
  const { provider } = await resolveSelected(context);
  if (!provider)
    throw new GraphQLError(
      "No CRM is connected for this project. A superadmin can connect one in Client Organisations → Projects → CRM.",
      { extensions: { code: "CRM_NOT_CONFIGURED" } }
    );
  return provider;
}

// Header-derived like every CSA subgraph (see docs/architecture/SECURITY-TENANCY.md):
// fails closed without a writer role, but is not a substitute for signed identity.
const WRITER_ROLES = new Set(["agent", "admin", "superadmin"]);
function assertCanWrite(context: unknown) {
  const role = (context as CrmContext | undefined)?.userRole;
  if (!role || !WRITER_ROLES.has(role))
    throw new GraphQLError("You do not have permission to change CRM records", { extensions: { code: "FORBIDDEN" } });
}

export const typeDefs = gql`
  type CrmAddress { street: String, city: String, state: String, postalCode: String, country: String }

  type CrmAccount {
    id: ID!
    provider: String!
    externalUrl: String
    name: String!
    industry: String
    type: String
    website: String
    phone: String
    billingAddress: CrmAddress
    ownerName: String
    createdAt: String
    lastModifiedAt: String
  }

  type CrmContact {
    id: ID!
    provider: String!
    externalUrl: String
    firstName: String
    lastName: String
    fullName: String
    email: String
    phone: String
    mobilePhone: String
    title: String
    accountId: ID
    accountName: String
    mailingAddress: CrmAddress
    ownerName: String
    createdAt: String
    lastModifiedAt: String
  }

  enum CrmActivityType { CALL EMAIL TASK MEETING OTHER }

  type CrmActivity {
    id: ID!
    provider: String!
    type: CrmActivityType!
    subject: String
    description: String
    status: String
    activityDate: String
    contactId: ID
    accountId: ID
    ownerName: String
    createdAt: String
  }

  type CrmContactPage {
    results: [CrmContact!]!
    total: Int
    limit: Int!
    offset: Int!
  }

  input CrmContactUpdateInput { firstName: String, lastName: String, email: String, phone: String, mobilePhone: String, title: String }
  input CrmActivityInput { contactId: ID!, type: CrmActivityType!, subject: String!, description: String, status: String, activityDate: String }

  extend type Query {
    crmProvider: String!
    crmContact(id: ID!): CrmContact
    crmContactByEmail(email: String!): CrmContact
    searchCrmContacts(text: String!, limit: Int = 20, offset: Int = 0): CrmContactPage!
    crmAccount(id: ID!): CrmAccount
    crmContactActivities(contactId: ID!, limit: Int = 20): [CrmActivity!]!
  }

  extend type Mutation {
    updateCrmContact(id: ID!, input: CrmContactUpdateInput!): CrmContact
    logCrmActivity(input: CrmActivityInput!): CrmActivity!
  }
`;

export const resolvers = {
  Mutation: {
    updateCrmContact: async (_parent: unknown, args: { id: string; input: CrmContactUpdate }, context: unknown) => {
      assertCanWrite(context);
      return (await selectedProvider(context)).updateContact(args.id.trim(), args.input);
    },
    logCrmActivity: async (_parent: unknown, args: { input: CrmActivityDraft }, context: unknown) => {
      assertCanWrite(context);
      return (await selectedProvider(context)).logActivity(args.input);
    }
  },
  Query: {
    crmProvider: async (_parent: unknown, _args: unknown, context: unknown) => (await resolveSelected(context)).name,
    crmContact: async (_parent: unknown, args: { id: string }, context: unknown) =>
      (await selectedProvider(context)).getContact(args.id.trim()),
    crmContactByEmail: async (_parent: unknown, args: { email: string }, context: unknown) =>
      (await selectedProvider(context)).findContactByEmail(args.email),
    searchCrmContacts: async (_parent: unknown, args: CrmContactSearchArgs, context: unknown) =>
      (await selectedProvider(context)).searchContacts(args),
    crmAccount: async (_parent: unknown, args: { id: string }, context: unknown) =>
      (await selectedProvider(context)).getAccount(args.id.trim()),
    crmContactActivities: async (_parent: unknown, args: { contactId: string; limit?: number }, context: unknown) =>
      (await selectedProvider(context)).listContactActivities(args.contactId.trim(), args.limit)
  }
};
