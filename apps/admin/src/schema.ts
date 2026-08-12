import { gql } from "graphql-tag";

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
} from "@csa/mongodb";
import type { ClientSsoConfigStored, CsaUser } from "@csa/mongodb";

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
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
    clientProjects: usersRepo.clientProjectsForUser(user, clientId),
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

  """A user as seen from one client's Users tab — only this client's project memberships."""
  type AdminClientUser {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    role: String!
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
    projects: [AdminUserProjectInput!]!
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
    projects: [AdminUserProjectInput!]
  }

  extend type Query {
    adminClients: [AdminClient!]!
    adminClient(id: ID!): AdminClient
    adminProjectsByClient(clientId: ID!): [AdminProject!]!
    adminProject(id: ID!): AdminProject
    adminUsersByClient(clientId: ID!): [AdminClientUser!]!
    adminSmtpProfilesByClient(clientId: ID!): [AdminSmtpProfile!]!
  }

  extend type Mutation {
    adminCreateClient(name: String!, contactEmail: String!, slug: String): AdminClient!
    adminUpdateClient(id: ID!, name: String, contactEmail: String, ssoConfig: AdminSsoConfigInput): AdminClient!
    adminSetClientStatus(id: ID!, status: String!): AdminClient!
    adminDeleteClient(id: ID!): Boolean!

    adminCreateProject(clientId: ID!, input: AdminProjectInput!, createdBy: String!): AdminProject!
    adminUpdateProject(id: ID!, input: AdminProjectUpdateInput!): AdminProject!
    adminDeleteProject(id: ID!): Boolean!
    adminTestProjectConnection(id: ID!): AdminConnectionTestResult!
    adminTestProjectCredentials(input: AdminTestCredentialsInput!): AdminConnectionTestResult!

    adminCreateSmtpProfile(clientId: ID!, input: AdminSmtpProfileInput!): AdminSmtpProfile!
    adminUpdateSmtpProfile(id: ID!, clientId: ID!, input: AdminSmtpProfileUpdateInput!): AdminSmtpProfile!
    adminDeleteSmtpProfile(id: ID!, clientId: ID!): Boolean!
    adminTestSmtpProfile(id: ID!, clientId: ID!, to: String): AdminEmailTestResult!

    adminCreateClientUser(clientId: ID!, input: AdminCreateUserInput!, grantedBy: String!): AdminClientUser!
    adminAssignClientUser(clientId: ID!, input: AdminAssignUserInput!, grantedBy: String!): AdminClientUser!
    adminUpdateClientUser(clientId: ID!, input: AdminUpdateClientUserInput!, grantedBy: String!): AdminClientUser!
    adminRemoveUserFromProject(clientId: ID!, email: String!, projectKey: String!): Boolean!
    adminRemoveUserFromClient(clientId: ID!, email: String!): Boolean!
  }
`;

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const resolvers = {
  Query: {
    adminClients: async () => {
      const clients = await clientsRepo.listClients();
      return Promise.all(
        clients.map(async (c) => {
          const id = c._id.toHexString();
          const [projectCount, userCount] = await Promise.all([
            projectsRepo.countProjectsByClient(id),
            usersRepo.countUsersByClient(id),
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
        usersRepo.countUsersByClient(id),
      ]);
      return { ...clientViewIso(c), projectCount, userCount };
    },

    adminProjectsByClient: async (_p: unknown, args: { clientId: string }) => {
      await requireClient(args.clientId);
      const docs = await projectsRepo.listProjectsByClient(args.clientId);
      return docs.map(projectViewIso);
    },

    adminProject: async (_p: unknown, args: { id: string }) => {
      const doc = await projectsRepo.findProjectById(args.id);
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
  },

  Mutation: {
    // ── Clients ──────────────────────────────────────────────────────────
    adminCreateClient: async (_p: unknown, args: { name: string; contactEmail: string; slug?: string }) => {
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
        createdBy: "superadmin",
      });
      return { ...clientViewIso(client), projectCount: 0, userCount: 0 };
    },

    adminUpdateClient: async (
      _p: unknown,
      args: { id: string; name?: string; contactEmail?: string; ssoConfig?: unknown }
    ) => {
      const patch: { name?: string; contactEmail?: string; ssoConfig?: ClientSsoConfigStored } = {};
      if (args.name !== undefined) patch.name = args.name;
      if (args.contactEmail !== undefined) patch.contactEmail = args.contactEmail;

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
        usersRepo.countUsersByClient(id),
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
        usersRepo.countUsersByClient(id),
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
      }
    ) => {
      const client = await requireClient(args.clientId);
      if (client.status === "blocked") throw new Error("Cannot add projects to a blocked client");

      const modeCheck = normalizeExclusiveProjectShellFlags({
        standaloneB2cEnabled: args.input.standaloneB2cEnabled !== undefined ? args.input.standaloneB2cEnabled : true,
        standaloneB2bEnabled: args.input.standaloneB2bEnabled !== undefined ? args.input.standaloneB2bEnabled : false,
      });
      if (!modeCheck) throw new Error("Select either the B2C shell or the B2B shell for this project.");

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
        standaloneB2bEnabled: modeCheck.standaloneB2bEnabled,
      });
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
      }
    ) => {
      const existing = await projectsRepo.findProjectById(args.id);
      if (!existing) throw new Error("Project not found");

      const input = args.input;

      const shellTouched = input.standaloneB2cEnabled !== undefined || input.standaloneB2bEnabled !== undefined;
      let exclusiveShellFlags: { standaloneB2cEnabled: boolean; standaloneB2bEnabled: boolean } | null = null;

      if (shellTouched) {
        exclusiveShellFlags = normalizeExclusiveProjectShellFlags({
          standaloneB2cEnabled: input.standaloneB2cEnabled !== undefined ? input.standaloneB2cEnabled : existing.standaloneB2cEnabled,
          standaloneB2bEnabled: input.standaloneB2bEnabled !== undefined ? input.standaloneB2bEnabled : existing.standaloneB2bEnabled,
        });
        if (!exclusiveShellFlags) throw new Error("Select either the B2C shell or the B2B shell for this project.");
      }

      const ok = await projectsRepo.updateProject(args.id, {
        ...input,
        standaloneB2cEnabled: exclusiveShellFlags?.standaloneB2cEnabled,
        standaloneB2bEnabled: exclusiveShellFlags?.standaloneB2bEnabled,
      });
      if (!ok) throw new Error("Failed to update project");

      const updated = await projectsRepo.findProjectById(args.id);
      return updated ? projectViewIso(updated) : null;
    },

    adminDeleteProject: async (_p: unknown, args: { id: string }) => {
      return projectsRepo.deleteProject(args.id);
    },

    adminTestProjectConnection: async (_p: unknown, args: { id: string }) => {
      return testProjectConnection(args.id);
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
      return testCredentials(args.input);
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
        isDefault,
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

    adminDeleteSmtpProfile: async (_p: unknown, args: { id: string; clientId: string }) => {
      return smtpRepo.deleteSmtpProfile(args.id, args.clientId);
    },

    adminTestSmtpProfile: async (_p: unknown, args: { id: string; clientId: string; to?: string }) => {
      return testSmtpProfile(args.id, args.clientId, args.to ?? "");
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
          projects: { projectKey: string; role: string }[];
        };
      }
    ) => {
      const client = await requireClient(args.clientId);
      if (client.status === "blocked") throw new Error("Cannot add users to a blocked client");
      if (!args.input.projects || args.input.projects.length === 0) {
        throw new Error("Select at least one project");
      }
      if (args.input.password.length < 8) throw new Error("Password must be at least 8 characters");

      const clientProjectKeys = new Set((await projectsRepo.listProjectsByClient(args.clientId)).map((p) => p.projectKey));
      for (const p of args.input.projects) {
        if (!clientProjectKeys.has(p.projectKey)) {
          throw new Error(`Project '${p.projectKey}' does not belong to this client`);
        }
      }

      const user = await usersRepo.createUser({
        email: args.input.email,
        password: args.input.password,
        firstName: args.input.firstName,
        lastName: args.input.lastName,
        clientId: args.clientId,
        projects: args.input.projects,
        grantedBy: args.grantedBy,
      });
      return clientUserView(user, args.clientId);
    },

    adminAssignClientUser: async (
      _p: unknown,
      args: { clientId: string; grantedBy: string; input: { email: string; projects: { projectKey: string; role: string }[] } }
    ) => {
      const client = await requireClient(args.clientId);
      if (client.status === "blocked") throw new Error("Cannot add users to a blocked client");
      if (!args.input.projects || args.input.projects.length === 0) {
        throw new Error("Select at least one project");
      }

      const clientProjectKeys = new Set((await projectsRepo.listProjectsByClient(args.clientId)).map((p) => p.projectKey));
      for (const p of args.input.projects) {
        if (!clientProjectKeys.has(p.projectKey)) {
          throw new Error(`Project '${p.projectKey}' does not belong to this client`);
        }
      }

      const result = await usersRepo.assignUserToClient({
        email: args.input.email,
        clientId: args.clientId,
        projects: args.input.projects,
        grantedBy: args.grantedBy,
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
          projects?: { projectKey: string; role: string }[];
        };
      }
    ) => {
      await requireClient(args.clientId);

      if (args.input.password && args.input.password.trim() && args.input.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      if (args.input.projects !== undefined) {
        const clientProjectKeys = new Set((await projectsRepo.listProjectsByClient(args.clientId)).map((p) => p.projectKey));
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
        projects: args.input.projects,
        grantedBy: args.grantedBy,
      });
      if (!updated) throw new Error(`No user found with email ${args.input.email}`);
      return clientUserView(updated, args.clientId);
    },

    adminRemoveUserFromProject: async (_p: unknown, args: { clientId: string; email: string; projectKey: string }) => {
      return usersRepo.removeUserFromProject(args.email, args.clientId, args.projectKey);
    },

    adminRemoveUserFromClient: async (_p: unknown, args: { clientId: string; email: string }) => {
      return usersRepo.removeUserFromClient(args.email, args.clientId);
    },
  },
};
