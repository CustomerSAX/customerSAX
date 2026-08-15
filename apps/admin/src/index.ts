import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { apolloContext, apolloLoggingPlugin, createLogger } from "@csa/logger";
import { resolvers, typeDefs } from "./schema.js";
import { ensureClientsIndex, ensureProjectsIndex, ensureSmtpProfilesIndex, ensureUsersIndex } from "@csa/mongodb";
import { recordAdminAudit } from "./audit/repository.js";

const log = createLogger("admin");
const port = Number(process.env.ADMIN_PORT ?? process.env.PORT ?? 4370);
const host = process.env.HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

await Promise.all([ensureClientsIndex(), ensureProjectsIndex(), ensureSmtpProfilesIndex(), ensureUsersIndex()]).catch(
  (error) => {
    log.warn("index setup warning (non-fatal)", { reason: error instanceof Error ? error.message : String(error) });
  }
);

type AdminContext = { clientId?: string; projectKey?: string; userRole?: string; userEmail?: string };

const securedResolvers = secureAdminResolvers(resolvers);

const server = new ApolloServer({
  schema: buildSubgraphSchema({ resolvers: securedResolvers, typeDefs }),
  plugins: [apolloLoggingPlugin(log)],
});

const { url } = await startStandaloneServer(server, {
  listen: { host, port },
  context: async ({ req }) => apolloContext(req),
});

log.info("service ready", { url });

function secureAdminResolvers<T extends Record<string, Record<string, unknown>>>(source: T): T {
  const secured = { ...source } as Record<string, Record<string, unknown>>;
  for (const operation of ["Query", "Mutation"]) {
    secured[operation] = { ...source[operation] };
    for (const [field, resolver] of Object.entries(source[operation] ?? {})) {
      if (typeof resolver !== "function" || !field.startsWith("admin")) continue;
      secured[operation][field] = async (parent: unknown, args: Record<string, unknown>, context: AdminContext, info: unknown) => {
        authorize(field, args, context);
        const result = await resolver(parent, args, context, info);
        if (operation === "Mutation") {
          await recordAdminAudit({ actor: context.userEmail ?? "unknown", action: field, clientId: context.clientId, projectKey: context.projectKey, target: String(args.id ?? args.email ?? args.projectKey ?? "") });
        }
        return result;
      };
    }
  }
  return secured as T;
}

function authorize(field: string, args: Record<string, unknown>, context: AdminContext) {
  if (context.userRole === "superadmin") return;
  if (context.userRole !== "admin" || !context.clientId || !context.projectKey || !context.userEmail) {
    throw new Error("Administrator access is required");
  }

  const superadminOnly = new Set([
    "adminClients", "adminCreateClient", "adminUpdateClient", "adminSetClientStatus", "adminDeleteClient",
    "adminCreateProject", "adminUpdateProject", "adminDeleteProject", "adminTestProjectConnection",
    "adminTestProjectCredentials"
  ]);
  if (superadminOnly.has(field)) throw new Error("Superadmin access is required");

  const requestedClientId = typeof args.clientId === "string" ? args.clientId : typeof args.id === "string" && field === "adminClient" ? args.id : undefined;
  if (!requestedClientId || requestedClientId !== context.clientId) {
    throw new Error("Cannot access another organisation");
  }
}
