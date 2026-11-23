import { projectHubSettings } from "./products/hub-status.js";
import { gql } from "graphql-tag";
import {
  projectConnectionHubProducts,
  connectionHubProductRecord
} from "./products/connection-hub.js";
import { projectProductsConfiguration } from "./products/configuration.js";

import {
  clientsRepo,
  parseClientSsoConfigInput,
  projectsRepo,
  normalizeExclusiveProjectShellFlags,
  testProjectConnection,
  testCredentials,
  smtpRepo,
  testSmtpProfile,
  usersRepo,
  getProjectTicketingSla,
  saveProjectTicketingSla
} from "@csa/mongodb";
import type { ClientSsoConfigStored, CsaUser, SlaTargetInput } from "@csa/mongodb";
import { del as cacheDel, ctProjectConfig } from "@csa/cache";
import { createLogger } from "@csa/logger";
import * as rolesRepo from "./roles/repository.js";
import * as aiSettingsRepo from "./ai-settings/repository.js";

const log = createLogger("admin").child({ module: "schema" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(d: Date | string | undefined | null): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function clientUserView(user: CsaUser, clientId: string) {
  const { _id, passwordHash: _hash, ...rest } = user;
  void _hash;
  return {
    ...rest,
    id: _id.toHexString(),
    isOrgAdmin: Boolean(user.isOrgAdmin),
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
    clientProjects: usersRepo.clientProjectsForUser(user, clientId)
  };
}

function projectViewIso(doc: Parameters<typeof projectsRepo.projectView>[0]) {
  const v = projectsRepo.projectView(doc);
  return { ...v, createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt) };
}

function smtpViewIso(doc: Parameters<typeof smtpRepo.smtpProfileView>[0]) {
  const v = smtpRepo.smtpProfileView(doc);
  return { ...v, createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt) };
}

function clientViewIso(doc: Parameters<typeof clientsRepo.clientView>[0]) {
  const v = clientsRepo.clientView(doc);
  return { ...v, createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt) };
}

/**
 * Per-request admin identity, populated upstream from `x-csa-*` headers (see
 * the header-trust boundary note in `index.ts`). `superadmin` crosses clients;
 * a client-scoped `admin` is bound to a single `clientId`.
 */
type ResolverContext = {
  clientId?: string;
  projectKey?: string;
  userRole?: string;
  userEmail?: string;
  userIsOrgAdmin?: boolean;
};

/**
 * Look up a project for an admin resolver with correct tenant scope. A
 * superadmin legitimately reads across clients (unscoped variant); an Org Admin
 * is constrained to their own organisation's projects; a regular Admin is
 * constrained to their explicitly assigned projects.
 */
async function findProjectScoped(context: unknown, id: string) {
  const ctx = (context ?? {}) as ResolverContext;
  const doc =
    ctx.userRole === "superadmin"
      ? await projectsRepo.findProjectByIdAnyClient(id)
      : await projectsRepo.findProjectById(id, ctx.clientId ?? "");
  if (!doc) return null;
  if (ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
    const userDoc = ctx.userEmail ? await usersRepo.findUserByEmail(ctx.userEmail) : null;
    const assignedKeys = new Set((userDoc?.projects || []).map((p) => p.projectKey));
    if (!assignedKeys.has(doc.projectKey)) {
      return null;
    }
  }
  return doc;
}

/** Tenant-scoped project delete, requiring Organization Admin or Superadmin. */
async function deleteProjectScoped(context: unknown, id: string) {
  const ctx = (context ?? {}) as ResolverContext;
  if (ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
    throw new Error("Organization Administrator access is required");
  }
  return ctx.userRole === "superadmin"
    ? projectsRepo.deleteProjectAnyClient(id)
    : projectsRepo.deleteProject(id, ctx.clientId ?? "");
}

async function requireClient(id: string) {
  const client = await clientsRepo.findClientById(id);
  if (!client) throw new Error("Client not found");
  return client;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const typeDefs = gql`
  type AdminClient @key(fields: "id") {
    id: ID!
    name: String!
    slug: String!
    contactEmail: String!
    status: String!
    ssoConfig: AdminSsoConfig!
    uiTheme: String
    createdBy: String!
    createdAt: String
    updatedAt: String
    projectCount: Int!
    userCount: Int!
  }

  type AdminSsoConfig {
    provider: String!
    issuer: String
    clientId: String
    providerDisplayName: String
    extraScopes: String
    authorizeConnection: String
    oidcClientSecretSet: Boolean
    entryPointUrl: String
    idpCertSet: Boolean
  }

  input AdminSsoConfigInput {
    provider: String!
    issuer: String
    clientId: String
    oidcClientSecret: String
    providerDisplayName: String
    extraScopes: String
    authorizeConnection: String
    entryPointUrl: String
    idpCertPem: String
  }

  type AdminProject @key(fields: "id") {
    id: ID!
    clientId: String!
    platform: String!
    ticketingProvider: String!
    crmProvider: String!
    productsProvider: String
    projectKey: String!
    displayName: String!
    ctApiUrl: String!
    ctAuthUrl: String!
    ctClientId: String!
    ctClientSecretMasked: String!
    scopes: String
    smtpProfileId: String
    standaloneB2cEnabled: Boolean
    standaloneB2bEnabled: Boolean
    isConfigured: Boolean
    status: String
    shopifyStoreDomain: String
    shopifyApiVersion: String
    bigcommerceStoreHash: String
    bigcommerceClientId: String
    createdBy: String!
    createdAt: String
    updatedAt: String
  }

  input AdminProjectInput {
    platform: String
    projectKey: String!
    displayName: String!
    ctApiUrl: String
    ctAuthUrl: String
    ctClientId: String
    ctClientSecret: String
    scopes: String
    shopifyStoreDomain: String
    shopifyAdminAccessToken: String
    shopifyApiVersion: String
    bigcommerceStoreHash: String
    bigcommerceClientId: String
    bigcommerceAccessToken: String
    standaloneB2cEnabled: Boolean
    standaloneB2bEnabled: Boolean
  }

  input AdminProjectUpdateInput {
    displayName: String
    ctApiUrl: String
    ctAuthUrl: String
    ctClientId: String
    ctClientSecret: String
    scopes: String
    smtpProfileId: String
    standaloneB2cEnabled: Boolean
    standaloneB2bEnabled: Boolean
    shopifyStoreDomain: String
    shopifyAdminAccessToken: String
    shopifyApiVersion: String
    bigcommerceStoreHash: String
    bigcommerceClientId: String
    bigcommerceAccessToken: String
  }

  type AdminConnectionTestResult {
    ok: Boolean!
    message: String!
    scopes: String
    expiresIn: Int
  }

  input AdminTestCredentialsInput {
    platform: String!
    projectKey: String
    ctAuthUrl: String
    ctClientId: String
    ctClientSecret: String
    scopes: String
    shopifyStoreDomain: String
    shopifyAdminAccessToken: String
    shopifyApiVersion: String
    bigcommerceStoreHash: String
    bigcommerceClientId: String
    bigcommerceAccessToken: String
  }

  type AdminSmtpProfile @key(fields: "id") {
    id: ID!
    clientId: String!
    name: String!
    smtpHost: String!
    smtpPort: Int!
    smtpSecure: Boolean!
    smtpUser: String!
    smtpPasswordMasked: String!
    emailFrom: String!
    isDefault: Boolean!
    createdAt: String
    updatedAt: String
  }

  input AdminSmtpProfileInput {
    name: String!
    smtpHost: String!
    smtpPort: Int!
    smtpSecure: Boolean
    smtpUser: String!
    smtpPassword: String!
    emailFrom: String!
    isDefault: Boolean
  }

  input AdminSmtpProfileUpdateInput {
    name: String
    smtpHost: String
    smtpPort: Int
    smtpSecure: Boolean
    smtpUser: String
    smtpPassword: String
    emailFrom: String
    isDefault: Boolean
  }

  type AdminEmailTestResult {
    ok: Boolean!
    to: String
    message: String
  }

  type AdminUserProject {
    projectKey: String!
    role: String!
    clientId: String
  }

  """
  A user as seen from one client's Users tab — only this client's project memberships.
  """
  type AdminClientUser {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    role: String!
    isOrgAdmin: Boolean
    active: Boolean!
    clientProjects: [AdminUserProject!]!
    grantedBy: String
    createdAt: String
    updatedAt: String
  }

  input AdminUserProjectInput {
    projectKey: String!
    role: String!
  }

  input AdminCreateUserInput {
    email: String!
    password: String!
    firstName: String
    lastName: String
    role: String
    isOrgAdmin: Boolean
    projects: [AdminUserProjectInput!]
  }

  input AdminAssignUserInput {
    email: String!
    projects: [AdminUserProjectInput!]!
  }

  input AdminUpdateClientUserInput {
    email: String!
    firstName: String
    lastName: String
    password: String
    role: String
    isOrgAdmin: Boolean
    active: Boolean
    projects: [AdminUserProjectInput!]
  }

  type AdminPermission {
    module: String!
    view: Boolean!
    create: Boolean!
    update: Boolean!
    delete: Boolean!
  }
  input AdminPermissionInput {
    module: String!
    view: Boolean!
    create: Boolean!
    update: Boolean!
    delete: Boolean!
  }
  type AdminRole {
    id: ID!
    clientId: ID!
    projectKey: String!
    key: String!
    label: String!
    description: String!
    system: Boolean!
    permissions: [AdminPermission!]!
  }
  input AdminRoleInput {
    key: String!
    label: String!
    description: String!
    permissions: [AdminPermissionInput!]!
  }
  input AdminRoleUpdateInput {
    key: String
    label: String
    description: String
    permissions: [AdminPermissionInput!]
  }

  type AdminAiSettings {
    clientId: ID!
    enabled: Boolean!
    provider: String!
    displayName: String!
    model: String!
    baseUrl: String
    apiKeySet: Boolean!
    updatedBy: String
    updatedAt: String
  }
  input AdminAiSettingsInput {
    enabled: Boolean!
    provider: String!
    displayName: String!
    model: String!
    baseUrl: String
    apiKey: String
  }

  "Native-ticket SLA target in minutes of 24/7 time; null = no target."
  type AdminTicketingSlaTarget { priority: String!, firstResponseMinutes: Int, resolutionMinutes: Int }
  input AdminTicketingSlaTargetInput { priority: String!, firstResponseMinutes: Int, resolutionMinutes: Int }
  type AdminProjectTicketing {
    provider: String!
    subdomain: String!
    clientId: String!
    secretSet: Boolean!
    freshdeskDomain: String!
    freshdeskApiKeySet: Boolean!
  }
  scalar ConnectionHubProductRecord
  type ConnectionHubProductPage {
    selected: Boolean!
    results: [ConnectionHubProductRecord!]!
    total: Int
  }
  type ProjectProductsConfiguration {
    provider: String!
    appId: String
    indexName: String
    searchApiKey: String
  }
  type AdminProjectProducts {
    configured: Boolean!
    provider: String!
    appId: String!
    indexName: String!
    searchApiKeySet: Boolean!
  }
  input AdminProjectProductsInput {
    provider: String!
    appId: String
    indexName: String
    searchApiKey: String
  }
  input AdminProjectTicketingInput {
    provider: String!
    subdomain: String
    clientId: String
    clientSecret: String
    freshdeskDomain: String
    freshdeskApiKey: String
  }
  type AdminTicketingTest {
    success: Boolean!
    message: String!
  }
  type AdminProjectCrm {
    provider: String!
    salesforceInstanceUrl: String!
    salesforceClientId: String!
    salesforceSecretSet: Boolean!
    hubspotPortalId: String!
    hubspotTokenSet: Boolean!
    zohoRegion: String!
    zohoClientId: String!
    zohoSecretSet: Boolean!
    zohoConnected: Boolean!
    zohoOrgId: String!
  }
  input AdminProjectCrmInput {
    provider: String!
    salesforceInstanceUrl: String
    salesforceClientId: String
    salesforceClientSecret: String
    hubspotAccessToken: String
    zohoRegion: String
    zohoClientId: String
    zohoClientSecret: String
    zohoGrantCode: String
  }
  type AdminCrmTest {
    success: Boolean!
    message: String!
  }
  extend type Query {
    projectConnectionHubProducts(
      query: String = ""
      limit: Int = 20
    ): ConnectionHubProductPage!
    projectProductsConfiguration: ProjectProductsConfiguration
    adminProjectProducts(clientId: ID!, id: ID!): AdminProjectProducts!
    adminProjectTicketing(clientId: ID!, id: ID!): AdminProjectTicketing!
    "Native-ticket SLA targets for every priority."
    adminProjectTicketingSla(clientId: ID!, id: ID!): [AdminTicketingSlaTarget!]!
    adminProjectCrm(clientId: ID!, id: ID!): AdminProjectCrm!

    adminClients: [AdminClient!]!
    adminClient(id: ID!): AdminClient
    adminProjectsByClient(clientId: ID!): [AdminProject!]!
    adminProject(id: ID!): AdminProject
    adminUsersByClient(clientId: ID!): [AdminClientUser!]!
    adminSmtpProfilesByClient(clientId: ID!): [AdminSmtpProfile!]!
    adminRoles(clientId: ID!, projectKey: String!): [AdminRole!]!
    adminAiSettings(clientId: ID!): AdminAiSettings!
  }

  extend type Mutation {
    adminSaveProjectProducts(
      clientId: ID!
      id: ID!
      input: AdminProjectProductsInput!
    ): AdminProjectProducts!
    adminTestProjectProducts(
      clientId: ID!
      id: ID!
      input: AdminProjectProductsInput!
    ): AdminTicketingTest!
    adminSaveProjectTicketing(
      clientId: ID!
      id: ID!
      input: AdminProjectTicketingInput!
    ): AdminProjectTicketing!
    adminSaveProjectTicketingSla(
      clientId: ID!
      id: ID!
      targets: [AdminTicketingSlaTargetInput!]!
    ): [AdminTicketingSlaTarget!]!
    adminTestProjectTicketing(
      clientId: ID!
      id: ID!
      input: AdminProjectTicketingInput!
    ): AdminTicketingTest!
    adminSaveProjectCrm(
      clientId: ID!
      id: ID!
      input: AdminProjectCrmInput!
    ): AdminProjectCrm!
    adminTestProjectCrm(
      clientId: ID!
      id: ID!
      input: AdminProjectCrmInput!
    ): AdminCrmTest!

    adminCreateClient(
      name: String!
      contactEmail: String!
      slug: String
      uiTheme: String
    ): AdminClient!
    adminUpdateClient(
      id: ID!
      name: String
      contactEmail: String
      uiTheme: String
      ssoConfig: AdminSsoConfigInput
    ): AdminClient!
    adminSetClientStatus(id: ID!, status: String!): AdminClient!
    adminDeleteClient(id: ID!): Boolean!

    adminCreateProject(
      clientId: ID!
      input: AdminProjectInput!
      createdBy: String!
    ): AdminProject!
    adminUpdateProject(id: ID!, input: AdminProjectUpdateInput!): AdminProject!
    adminDeleteProject(id: ID!): Boolean!
    adminTestProjectConnection(id: ID!): AdminConnectionTestResult!
    adminTestProjectCredentials(
      input: AdminTestCredentialsInput!
    ): AdminConnectionTestResult!

    adminCreateSmtpProfile(
      clientId: ID!
      input: AdminSmtpProfileInput!
    ): AdminSmtpProfile!
    adminUpdateSmtpProfile(
      id: ID!
      clientId: ID!
      input: AdminSmtpProfileUpdateInput!
    ): AdminSmtpProfile!
    adminDeleteSmtpProfile(id: ID!, clientId: ID!): Boolean!
    adminTestSmtpProfile(id: ID!, clientId: ID!, to: String): AdminEmailTestResult!

    adminCreateClientUser(
      clientId: ID!
      input: AdminCreateUserInput!
      grantedBy: String!
    ): AdminClientUser!
    adminAssignClientUser(
      clientId: ID!
      input: AdminAssignUserInput!
      grantedBy: String!
    ): AdminClientUser!
    adminUpdateClientUser(
      clientId: ID!
      input: AdminUpdateClientUserInput!
      grantedBy: String!
    ): AdminClientUser!
    adminRemoveUserFromProject(
      clientId: ID!
      email: String!
      projectKey: String!
    ): Boolean!
    adminRemoveUserFromClient(clientId: ID!, email: String!): Boolean!
    adminUpdateClientContact(clientId: ID!, contactEmail: String!): AdminClient!
    adminCreateRole(
      clientId: ID!
      projectKey: String!
      input: AdminRoleInput!
    ): AdminRole!
    adminUpdateRole(
      id: ID!
      clientId: ID!
      projectKey: String!
      input: AdminRoleUpdateInput!
    ): AdminRole
    adminDeleteRole(id: ID!, clientId: ID!, projectKey: String!): Boolean!
    adminUpdateAiSettings(clientId: ID!, input: AdminAiSettingsInput!): AdminAiSettings!
    adminSetProjectSmtp(
      clientId: ID!
      projectKey: String!
      smtpProfileId: String
    ): Boolean!
  }
`;

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const resolvers = {
  ConnectionHubProductRecord: connectionHubProductRecord,
  Query: {
    projectProductsConfiguration,
    projectConnectionHubProducts,
    adminProjectProducts: async (_p: unknown, args: { clientId: string; id: string }) =>
      (await projectHubSettings(args.clientId, args.id)).products,
    adminProjectTicketingSla: (_p: unknown, args: { clientId: string; id: string }) =>
      getProjectTicketingSla(args.clientId, args.id),
    adminProjectTicketing: async (_p: unknown, args: { clientId: string; id: string }) =>
      (await projectHubSettings(args.clientId, args.id)).ticketing,
    adminProjectCrm: async (_p: unknown, args: { clientId: string; id: string }) =>
      (await projectHubSettings(args.clientId, args.id)).crm,
    adminClients: async () => {
      const clients = await clientsRepo.listClients();
      return Promise.all(
        clients.map(async (c) => {
          const id = c._id.toHexString();
          const [projectCount, userCount] = await Promise.all([
            projectsRepo.countProjectsByClient(id),
            usersRepo.countUsersByClient(id)
          ]);
          return { ...clientViewIso(c), projectCount, userCount };
        })
      );
    },

    adminClient: async (_p: unknown, args: { id: string }) => {
      const c = await clientsRepo.findClientById(args.id);
      if (!c) return null;
      const id = c._id.toHexString();
      const [projectCount, userCount] = await Promise.all([
        projectsRepo.countProjectsByClient(id),
        usersRepo.countUsersByClient(id)
      ]);
      return { ...clientViewIso(c), projectCount, userCount };
    },

    adminProjectsByClient: async (_p: unknown, args: { clientId: string }, context: unknown) => {
      await requireClient(args.clientId);
      const ctx = (context ?? {}) as ResolverContext;
      const docs = await projectsRepo.listProjectsByClient(args.clientId);
      if (ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
        const userDoc = ctx.userEmail ? await usersRepo.findUserByEmail(ctx.userEmail) : null;
        const assignedKeys = new Set((userDoc?.projects || []).map((p) => p.projectKey));
        return docs.filter((p) => assignedKeys.has(p.projectKey)).map(projectViewIso);
      }
      return docs.map(projectViewIso);
    },

    adminProject: async (_p: unknown, args: { id: string }, context: unknown) => {
      const doc = await findProjectScoped(context, args.id);
      return doc ? projectViewIso(doc) : null;
    },

    adminUsersByClient: async (_p: unknown, args: { clientId: string }) => {
      await requireClient(args.clientId);
      const docs = await usersRepo.listUsersByClient(args.clientId);
      return docs.map((u) => clientUserView(u, args.clientId));
    },

    adminSmtpProfilesByClient: async (_p: unknown, args: { clientId: string }) => {
      await requireClient(args.clientId);
      const docs = await smtpRepo.listSmtpProfilesByClient(args.clientId);
      return docs.map(smtpViewIso);
    },
    adminRoles: (_p: unknown, args: { clientId: string; projectKey: string }) =>
      rolesRepo.listRoles(args.clientId, args.projectKey),
    adminAiSettings: (_p: unknown, args: { clientId: string }) =>
      aiSettingsRepo.getAiSettings(args.clientId)
  },

  Mutation: {
    adminSaveProjectProducts: () => {
      throw new Error(
        "Legacy connector configuration has been retired. Manage this project’s external connectors in Connection Hub."
      );
    },
    adminTestProjectProducts: () => {
      throw new Error(
        "Legacy connector configuration has been retired. Manage this project’s external connectors in Connection Hub."
      );
    },
    adminSaveProjectTicketing: () => {
      throw new Error(
        "Legacy connector configuration has been retired. Manage this project’s external connectors in Connection Hub."
      );
    },
    // Native SLA targets are a built-in capability, not a retired external connector.
    adminSaveProjectTicketingSla: (_p: unknown, args: { clientId: string; id: string; targets: SlaTargetInput[] }) =>
      saveProjectTicketingSla(args.clientId, args.id, args.targets),
    adminTestProjectTicketing: () => {
      throw new Error(
        "Legacy connector configuration has been retired. Manage this project’s external connectors in Connection Hub."
      );
    },
    adminSaveProjectCrm: () => {
      throw new Error(
        "Legacy connector configuration has been retired. Manage this project’s external connectors in Connection Hub."
      );
    },
    adminTestProjectCrm: () => {
      throw new Error(
        "Legacy connector configuration has been retired. Manage this project’s external connectors in Connection Hub."
      );
    },
    // ── Clients ──────────────────────────────────────────────────────────
    adminCreateClient: async (
      _p: unknown,
      args: { name: string; contactEmail: string; slug?: string; uiTheme?: string }
    ) => {
      const slug =
        args.slug?.trim().toLowerCase() ||
        args.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      const existing = await clientsRepo.findClientBySlug(slug);
      if (existing) throw new Error(`A client with slug '${slug}' already exists`);

      const client = await clientsRepo.createClient({
        name: args.name,
        contactEmail: args.contactEmail,
        slug,
        uiTheme: args.uiTheme,
        createdBy: "superadmin"
      });
      return { ...clientViewIso(client), projectCount: 0, userCount: 0 };
    },

    adminUpdateClient: async (
      _p: unknown,
      args: {
        id: string;
        name?: string;
        contactEmail?: string;
        uiTheme?: string;
        ssoConfig?: unknown;
      },
      context: unknown
    ) => {
      const ctx = (context ?? {}) as ResolverContext;
      if (ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
        throw new Error("Organization Administrator access is required");
      }
      const patch: {
        name?: string;
        contactEmail?: string;
        uiTheme?: string;
        ssoConfig?: ClientSsoConfigStored;
      } = {};
      if (args.name !== undefined) patch.name = args.name;
      if (args.contactEmail !== undefined) patch.contactEmail = args.contactEmail;
      if (args.uiTheme !== undefined) patch.uiTheme = args.uiTheme;

      if (args.ssoConfig !== undefined) {
        const existing = await clientsRepo.findClientByIdRaw(args.id);
        const parsed = parseClientSsoConfigInput(args.ssoConfig, existing);
        if (!parsed.ok) throw new Error(parsed.error);
        patch.ssoConfig = parsed.value;
      }

      const updated = await clientsRepo.updateClient(args.id, patch);
      if (!updated) throw new Error("Client not found");

      const client = await requireClient(args.id);
      const id = client._id.toHexString();
      const [projectCount, userCount] = await Promise.all([
        projectsRepo.countProjectsByClient(id),
        usersRepo.countUsersByClient(id)
      ]);
      return { ...clientViewIso(client), projectCount, userCount };
    },

    adminSetClientStatus: async (_p: unknown, args: { id: string; status: string }) => {
      if (args.status !== "active" && args.status !== "blocked") {
        throw new Error("status must be 'active' or 'blocked'");
      }
      const updated = await clientsRepo.setClientStatus(args.id, args.status);
      if (!updated) throw new Error("Client not found");
      const client = await requireClient(args.id);
      const id = client._id.toHexString();
      const [projectCount, userCount] = await Promise.all([
        projectsRepo.countProjectsByClient(id),
        usersRepo.countUsersByClient(id)
      ]);
      return { ...clientViewIso(client), projectCount, userCount };
    },

    adminDeleteClient: async (_p: unknown, args: { id: string }) => {
      const client = await requireClient(args.id);
      const id = client._id.toHexString();
      await projectsRepo.deleteProjectsByClient(id);
      await smtpRepo.deleteSmtpProfilesByClient(id);
      await usersRepo.deactivateUsersByClient(id);
      return clientsRepo.deleteClient(id);
    },

    // ── Projects ─────────────────────────────────────────────────────────
    adminCreateProject: async (
      _p: unknown,
      args: {
        clientId: string;
        createdBy: string;
        input: {
          platform?: "commercetools" | "shopify" | "bigcommerce";
          projectKey: string;
          displayName: string;
          ctApiUrl?: string;
          ctAuthUrl?: string;
          ctClientId?: string;
          ctClientSecret?: string;
          scopes?: string;
          shopifyStoreDomain?: string;
          shopifyAdminAccessToken?: string;
          shopifyApiVersion?: string;
          bigcommerceStoreHash?: string;
          bigcommerceClientId?: string;
          bigcommerceAccessToken?: string;
          standaloneB2cEnabled?: boolean;
          standaloneB2bEnabled?: boolean;
        };
      },
      context: unknown
    ) => {
      const ctx = (context ?? {}) as ResolverContext;
      if (ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
        throw new Error("Only Organization Administrators or Superadmins can create projects");
      }
      const client = await requireClient(args.clientId);
      if (client.status === "blocked")
        throw new Error("Cannot add projects to a blocked client");

      const modeCheck = normalizeExclusiveProjectShellFlags({
        standaloneB2cEnabled:
          args.input.standaloneB2cEnabled !== undefined
            ? args.input.standaloneB2cEnabled
            : true,
        standaloneB2bEnabled:
          args.input.standaloneB2bEnabled !== undefined
            ? args.input.standaloneB2bEnabled
            : false
      });
      if (!modeCheck)
        throw new Error("Select either the B2C shell or the B2B shell for this project.");

      const cleanKey = args.input.projectKey.trim();
      if (!cleanKey) {
        throw new Error("Project key is required");
      }
      const existingProjects = await projectsRepo.listProjectsByClient(args.clientId);
      if (
        existingProjects.some(
          (p) => p.projectKey.toLowerCase() === cleanKey.toLowerCase()
        )
      ) {
        throw new Error(`A project with key "${cleanKey}" already exists in this organization.`);
      }

      const project = await projectsRepo.createProject({
        clientId: args.clientId,
        platform: args.input.platform,
        projectKey: args.input.projectKey,
        displayName: args.input.displayName,
        ctApiUrl: args.input.ctApiUrl,
        ctAuthUrl: args.input.ctAuthUrl,
        ctClientId: args.input.ctClientId,
        ctClientSecret: args.input.ctClientSecret,
        scopes: args.input.scopes,
        shopifyStoreDomain: args.input.shopifyStoreDomain,
        shopifyAdminAccessToken: args.input.shopifyAdminAccessToken,
        shopifyApiVersion: args.input.shopifyApiVersion,
        bigcommerceStoreHash: args.input.bigcommerceStoreHash,
        bigcommerceClientId: args.input.bigcommerceClientId,
        bigcommerceAccessToken: args.input.bigcommerceAccessToken,
        createdBy: args.createdBy,
        standaloneB2cEnabled: modeCheck.standaloneB2cEnabled,
        standaloneB2bEnabled: modeCheck.standaloneB2bEnabled
      });

      // If the project was created by an admin of this client (or if there are org admins with 0 projects),
      // ensure the creator and unassigned org admins get access to this project
      try {
        const orgUsers = await usersRepo.listUsersByClient(args.clientId);
        for (const user of orgUsers) {
          const isCreator =
            args.createdBy && user.email.toLowerCase() === args.createdBy.toLowerCase();
          const hasNoProjects = !user.projects || user.projects.length === 0;
          if (isCreator || (user.role === "admin" && hasNoProjects)) {
            await usersRepo
              .assignUserToClient({
                email: user.email,
                clientId: args.clientId,
                projects: [{ projectKey: args.input.projectKey, role: "admin" }],
                grantedBy: args.createdBy || "system"
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        log.warn("adminCreateProject auto-assignment notice", { err });
      }

      return projectViewIso(project);
    },

    adminUpdateProject: async (
      _p: unknown,
      args: {
        id: string;
        input: {
          displayName?: string;
          ctApiUrl?: string;
          ctAuthUrl?: string;
          ctClientId?: string;
          ctClientSecret?: string;
          scopes?: string;
          smtpProfileId?: string | null;
          standaloneB2cEnabled?: boolean;
          standaloneB2bEnabled?: boolean;
          shopifyStoreDomain?: string;
          shopifyAdminAccessToken?: string;
          shopifyApiVersion?: string;
          bigcommerceStoreHash?: string;
          bigcommerceClientId?: string;
          bigcommerceAccessToken?: string;
        };
      },
      context: unknown
    ) => {
      const existing = await findProjectScoped(context, args.id);
      if (!existing) throw new Error("Project not found");

      const input = args.input;

      const shellTouched =
        input.standaloneB2cEnabled !== undefined ||
        input.standaloneB2bEnabled !== undefined;
      let exclusiveShellFlags: {
        standaloneB2cEnabled: boolean;
        standaloneB2bEnabled: boolean;
      } | null = null;

      if (shellTouched) {
        exclusiveShellFlags = normalizeExclusiveProjectShellFlags({
          standaloneB2cEnabled:
            input.standaloneB2cEnabled !== undefined
              ? input.standaloneB2cEnabled
              : existing.standaloneB2cEnabled,
          standaloneB2bEnabled:
            input.standaloneB2bEnabled !== undefined
              ? input.standaloneB2bEnabled
              : existing.standaloneB2bEnabled
        });
        if (!exclusiveShellFlags)
          throw new Error(
            "Select either the B2C shell or the B2B shell for this project."
          );
      }

      const ok = await projectsRepo.updateProject(args.id, {
        ...input,
        standaloneB2cEnabled: exclusiveShellFlags?.standaloneB2cEnabled,
        standaloneB2bEnabled: exclusiveShellFlags?.standaloneB2bEnabled
      });
      if (!ok) throw new Error("Failed to update project");

      // Invalidate the commercetools subgraph's cached project config so an
      // updated credential/URL takes effect immediately rather than after the
      // 300s TTL. Keyed on (clientId, projectKey) — the same shape the subgraph
      // caches under. Best-effort: `del` never throws (no-op if Redis is down).
      await cacheDel(ctProjectConfig(existing.clientId, existing.projectKey));

      const updated = await findProjectScoped(context, args.id);
      return updated ? projectViewIso(updated) : null;
    },

    adminDeleteProject: async (_p: unknown, args: { id: string }, context: unknown) => {
      return deleteProjectScoped(context, args.id);
    },

    adminTestProjectConnection: async (_p: unknown, args: { id: string }, context: unknown) => {
      const existing = await findProjectScoped(context, args.id);
      if (!existing) throw new Error("Project not found");
      return testProjectConnection(args.id, log);
    },

    adminTestProjectCredentials: async (
      _p: unknown,
      args: {
        input: {
          platform: "commercetools" | "shopify" | "bigcommerce";
          projectKey?: string;
          ctAuthUrl?: string;
          ctClientId?: string;
          ctClientSecret?: string;
          scopes?: string;
          shopifyStoreDomain?: string;
          shopifyAdminAccessToken?: string;
          shopifyApiVersion?: string;
          bigcommerceStoreHash?: string;
          bigcommerceClientId?: string;
          bigcommerceAccessToken?: string;
        };
      }
    ) => {
      return testCredentials(args.input, log);
    },

    // ── SMTP profiles ────────────────────────────────────────────────────
    adminCreateSmtpProfile: async (
      _p: unknown,
      args: {
        clientId: string;
        input: {
          name: string;
          smtpHost: string;
          smtpPort: number;
          smtpSecure?: boolean;
          smtpUser: string;
          smtpPassword: string;
          emailFrom: string;
          isDefault?: boolean;
        };
      }
    ) => {
      await requireClient(args.clientId);
      const existing = await smtpRepo.listSmtpProfilesByClient(args.clientId);
      const isDefault = args.input.isDefault === true || existing.length === 0;

      const profile = await smtpRepo.createSmtpProfile({
        clientId: args.clientId,
        name: args.input.name,
        smtpHost: args.input.smtpHost,
        smtpPort: args.input.smtpPort,
        smtpSecure: args.input.smtpSecure === true,
        smtpUser: args.input.smtpUser,
        smtpPassword: args.input.smtpPassword,
        emailFrom: args.input.emailFrom,
        isDefault
      });
      return smtpViewIso(profile);
    },

    adminUpdateSmtpProfile: async (
      _p: unknown,
      args: {
        id: string;
        clientId: string;
        input: {
          name?: string;
          smtpHost?: string;
          smtpPort?: number;
          smtpSecure?: boolean;
          smtpUser?: string;
          smtpPassword?: string;
          emailFrom?: string;
          isDefault?: boolean;
        };
      }
    ) => {
      const ok = await smtpRepo.updateSmtpProfile(args.id, args.clientId, args.input);
      if (!ok) throw new Error("Update failed");
      const updated = await smtpRepo.findSmtpProfileByIdForClient(args.id, args.clientId);
      return updated ? smtpViewIso(updated) : null;
    },

    adminDeleteSmtpProfile: async (
      _p: unknown,
      args: { id: string; clientId: string }
    ) => {
      return smtpRepo.deleteSmtpProfile(args.id, args.clientId);
    },

    adminTestSmtpProfile: async (
      _p: unknown,
      args: { id: string; clientId: string; to?: string }
    ) => {
      return testSmtpProfile(args.id, args.clientId, args.to ?? "", log);
    },

    // ── Users ────────────────────────────────────────────────────────────
    adminCreateClientUser: async (
      _p: unknown,
      args: {
        clientId: string;
        grantedBy: string;
        input: {
          email: string;
          password: string;
          firstName?: string;
          lastName?: string;
          role?: string;
          isOrgAdmin?: boolean;
          projects?: { projectKey: string; role: string }[];
        };
      },
      context: unknown
    ) => {
      const ctx = (context ?? {}) as ResolverContext;
      if (args.input.isOrgAdmin && ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
        throw new Error(
          "Only Organization Administrators or Superadmins can create or promote an Organization Admin"
        );
      }
      const client = await requireClient(args.clientId);
      if (client.status === "blocked")
        throw new Error("Cannot add users to a blocked client");
      if (args.input.password.length < 8)
        throw new Error("Password must be at least 8 characters");

      const projectsToAssign = args.input.projects ?? [];
      if (projectsToAssign.length > 0) {
        const clientProjectKeys = new Set(
          (await projectsRepo.listProjectsByClient(args.clientId)).map(
            (p) => p.projectKey
          )
        );
        for (const p of projectsToAssign) {
          if (!clientProjectKeys.has(p.projectKey)) {
            throw new Error(`Project '${p.projectKey}' does not belong to this client`);
          }
        }
      }

      const roleToSet = args.input.role?.trim() || "agent";
      const isOrgAdminToSet = Boolean(args.input.isOrgAdmin);
      if (isOrgAdminToSet) {
        const existingUsers = await usersRepo.listUsersByClient(args.clientId);
        const hasOrgAdmin = existingUsers.some((u) => u.isOrgAdmin);
        if (hasOrgAdmin) {
          throw new Error(
            "An Organization Admin already exists for this organization. Only one Organization Admin is permitted per organization."
          );
        }
      }

      const user = await usersRepo.createUser({
        email: args.input.email,
        password: args.input.password,
        firstName: args.input.firstName,
        lastName: args.input.lastName,
        role: roleToSet,
        isOrgAdmin: isOrgAdminToSet,
        clientId: args.clientId,
        projects: projectsToAssign,
        grantedBy: args.grantedBy
      });
      return clientUserView(user, args.clientId);
    },

    adminAssignClientUser: async (
      _p: unknown,
      args: {
        clientId: string;
        grantedBy: string;
        input: { email: string; projects: { projectKey: string; role: string }[] };
      }
    ) => {
      const client = await requireClient(args.clientId);
      if (client.status === "blocked")
        throw new Error("Cannot add users to a blocked client");
      if (!args.input.projects || args.input.projects.length === 0) {
        throw new Error("Select at least one project");
      }

      const clientProjectKeys = new Set(
        (await projectsRepo.listProjectsByClient(args.clientId)).map((p) => p.projectKey)
      );
      for (const p of args.input.projects) {
        if (!clientProjectKeys.has(p.projectKey)) {
          throw new Error(`Project '${p.projectKey}' does not belong to this client`);
        }
      }

      const result = await usersRepo.assignUserToClient({
        email: args.input.email,
        clientId: args.clientId,
        projects: args.input.projects,
        grantedBy: args.grantedBy
      });
      if (!result) throw new Error(`No user found with email ${args.input.email}`);
      return clientUserView(result.user, args.clientId);
    },

    adminUpdateClientUser: async (
      _p: unknown,
      args: {
        clientId: string;
        grantedBy: string;
        input: {
          email: string;
          firstName?: string;
          lastName?: string;
          password?: string;
          role?: string;
          isOrgAdmin?: boolean;
          active?: boolean;
          projects?: { projectKey: string; role: string }[];
        };
      },
      context: unknown
    ) => {
      const ctx = (context ?? {}) as ResolverContext;
      if (args.input.isOrgAdmin && ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
        throw new Error(
          "Only Organization Administrators or Superadmins can create or promote an Organization Admin"
        );
      }
      await requireClient(args.clientId);

      if (args.input.isOrgAdmin === true) {
        const existingUsers = await usersRepo.listUsersByClient(args.clientId);
        const existingOtherAdmin = existingUsers.find(
          (u) =>
            u.isOrgAdmin &&
            u.email.toLowerCase() !== args.input.email.toLowerCase()
        );
        if (existingOtherAdmin) {
          throw new Error(
            "An Organization Admin already exists for this organization. Cannot promote another user to Organization Admin."
          );
        }
      }

      const existingUser = await usersRepo.findUserByEmail(args.input.email);
      if (existingUser && args.input.projects && args.input.role !== "admin") {
        for (const membership of existingUser.projects.filter(
          (item) => item.clientId === args.clientId && item.role === "admin"
        )) {
          const replacement = args.input.projects.find(
            (item) => item.projectKey === membership.projectKey
          );
          if (
            (!replacement || replacement.role !== "admin") &&
            (await usersRepo.countUsersByProjectRole(
              args.clientId,
              membership.projectKey,
              "admin"
            )) <= 1
          ) {
            throw new Error(
              `Cannot remove the last administrator from '${membership.projectKey}'`
            );
          }
        }
      }

      if (
        args.input.password &&
        args.input.password.trim() &&
        args.input.password.length < 8
      ) {
        throw new Error("Password must be at least 8 characters");
      }

      if (args.input.projects !== undefined) {
        const clientProjectKeys = new Set(
          (await projectsRepo.listProjectsByClient(args.clientId)).map(
            (p) => p.projectKey
          )
        );
        for (const p of args.input.projects) {
          if (!clientProjectKeys.has(p.projectKey)) {
            throw new Error(`Project '${p.projectKey}' does not belong to this client`);
          }
        }
      }

      const updated = await usersRepo.updateClientUser({
        email: args.input.email,
        clientId: args.clientId,
        firstName: args.input.firstName,
        lastName: args.input.lastName,
        password: args.input.password,
        role: args.input.role,
        isOrgAdmin: args.input.isOrgAdmin,
        active: args.input.active,
        projects: args.input.projects,
        grantedBy: args.grantedBy
      });
      if (!updated) throw new Error(`No user found with email ${args.input.email}`);
      return clientUserView(updated, args.clientId);
    },

    adminRemoveUserFromProject: async (
      _p: unknown,
      args: { clientId: string; email: string; projectKey: string }
    ) => {
      return usersRepo.removeUserFromProject(args.email, args.clientId, args.projectKey);
    },

    adminRemoveUserFromClient: async (
      _p: unknown,
      args: { clientId: string; email: string }
    ) => {
      await requireClient(args.clientId);
      const user = await usersRepo.findUserByEmail(args.email);
      if (user && user.role === "admin") {
        throw new Error("Cannot remove the Organization Admin account.");
      }
      return usersRepo.removeUserFromClient(args.email, args.clientId);
    },
    adminUpdateClientContact: async (
      _p: unknown,
      args: { clientId: string; contactEmail: string },
      context: unknown
    ) => {
      const ctx = (context ?? {}) as ResolverContext;
      if (ctx.userRole !== "superadmin" && !ctx.userIsOrgAdmin) {
        throw new Error("Organization Administrator access is required");
      }
      await clientsRepo.updateClient(args.clientId, {
        contactEmail: args.contactEmail.trim()
      });
      const client = await requireClient(args.clientId);
      return {
        ...clientViewIso(client),
        projectCount: await projectsRepo.countProjectsByClient(args.clientId),
        userCount: await usersRepo.countUsersByClient(args.clientId)
      };
    },
    adminCreateRole: (
      _p: unknown,
      args: {
        clientId: string;
        projectKey: string;
        input: {
          key: string;
          label: string;
          description: string;
          permissions: rolesRepo.Permission[];
        };
      }
    ) => rolesRepo.createRole(args.clientId, args.projectKey, args.input),
    adminUpdateRole: async (
      _p: unknown,
      args: {
        id: string;
        clientId: string;
        projectKey: string;
        input: {
          key?: string;
          label?: string;
          description?: string;
          permissions?: rolesRepo.Permission[];
        };
      }
    ) => {
      const existing = (await rolesRepo.listRoles(args.clientId, args.projectKey)).find(
        (item) => item.id === args.id
      );
      if (!existing) throw new Error("Role not found");

      let newKey: string | undefined = undefined;
      if (args.input.key !== undefined) {
        newKey = args.input.key
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "");
        if (!newKey) throw new Error("Role name/slug cannot be empty");
        if (newKey !== existing.key) {
          if (existing.system) throw new Error("System role name cannot be modified");
          const conflict = (
            await rolesRepo.listRoles(args.clientId, args.projectKey)
          ).find((item) => item.key === newKey && item.id !== args.id);
          if (conflict) throw new Error("A role with this slug already exists");
          await usersRepo.reassignRole(
            args.clientId,
            args.projectKey,
            existing.key,
            newKey
          );
        }
      }

      return rolesRepo.updateRole(args.id, args.clientId, args.projectKey, {
        ...(newKey !== undefined ? { key: newKey } : {}),
        ...(args.input.label !== undefined ? { label: args.input.label.trim() } : {}),
        ...(args.input.description !== undefined
          ? { description: args.input.description.trim() }
          : {}),
        ...(args.input.permissions !== undefined
          ? { permissions: args.input.permissions }
          : {})
      });
    },
    adminDeleteRole: async (
      _p: unknown,
      args: { id: string; clientId: string; projectKey: string }
    ) => {
      const role = (await rolesRepo.listRoles(args.clientId, args.projectKey)).find(
        (item) => item.id === args.id
      );
      if (!role) return false;
      if (role.system) throw new Error("System roles cannot be deleted");
      if (
        (await usersRepo.countUsersAssignedRole(
          args.clientId,
          args.projectKey,
          role.key
        )) > 0
      )
        throw new Error("Role is assigned to one or more users");
      return rolesRepo.deleteRole(args.id, args.clientId, args.projectKey);
    },
    adminUpdateAiSettings: (
      _p: unknown,
      args: {
        clientId: string;
        input: {
          enabled: boolean;
          provider: string;
          displayName: string;
          model: string;
          baseUrl?: string;
          apiKey?: string;
        };
      },
      context: unknown
    ) =>
      aiSettingsRepo.updateAiSettings(
        args.clientId,
        args.input,
        (context as { userEmail?: string } | undefined)?.userEmail ?? "unknown"
      ),
    adminSetProjectSmtp: async (
      _p: unknown,
      args: { clientId: string; projectKey: string; smtpProfileId?: string | null }
    ) => {
      const project = (await projectsRepo.listProjectsByClient(args.clientId)).find(
        (item) => item.projectKey === args.projectKey
      );
      if (!project) throw new Error("Project not found in this organisation");
      return projectsRepo.updateProject(project._id.toHexString(), {
        smtpProfileId: args.smtpProfileId ?? null
      });
    }
  }
};
