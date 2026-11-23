import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { createLogger } from "@csa/logger";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";
import { ensureClientsIndex, ensureProjectsIndex, ensureSmtpProfilesIndex, ensureUsersIndex } from "@csa/mongodb";
import { recordAdminAudit } from "./audit/repository.js";
import { authorize, type AdminContext } from "./auth.js";

const log = createLogger("admin");
const port = Number(process.env.PORT ?? process.env.ADMIN_PORT ?? 4370);

const securedResolvers = { ...resolvers, ...secureAdminResolvers({ Query: resolvers.Query, Mutation: resolvers.Mutation }) };

await startSubgraph({
  serviceName: "admin",
  schema: buildSubgraphSchema([{ resolvers: securedResolvers, typeDefs }]),
  port,
});

Promise.all([ensureClientsIndex(), ensureProjectsIndex(), ensureSmtpProfilesIndex(), ensureUsersIndex()]).catch(
  (error) => {
    log.warn("index setup warning (non-fatal)", { reason: error instanceof Error ? error.message : String(error) });
  }
);

/**
 * Header-trust boundary — READ THIS BEFORE EXPOSING THIS SERVICE.
 *
 * `authorize()` below makes every access decision from `context.userRole` and
 * `context.clientId` (see `AdminContext`). Those values are populated upstream
 * from the caller's `x-csa-*` request headers (`x-csa-user-role`,
 * `x-csa-client-id`, …). Nothing in THIS service cryptographically verifies
 * them — a caller who can set arbitrary request headers can therefore assert
 * any role, including `superadmin`.
 *
 * That is only safe because of a deployment invariant that MUST hold: this
 * admin subgraph is reachable ONLY behind the BFF gateway over private
 * networking, and the BFF is the sole component that derives these headers from
 * an authenticated session. **This service must never be publicly reachable.**
 * If it ever gains a public ingress, the header trust is broken and every
 * authorization check here becomes bypassable.
 *
 * TODO(security): replace header-trust with signed/verified inter-service
 * identity propagation (e.g. a signed principal token minted by the BFF and
 * verified here) so authorization no longer depends on network topology alone.
 * That is a separate, larger piece of work — tracked here as a boundary note.
 */
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
          // Audit is best-effort and MUST NOT be coupled to the mutation's
          // response: the mutation has already committed by this point, so an
          // audit-insert failure must not surface to the client as if the
          // mutation itself failed. Log and continue.
          try {
            await recordAdminAudit({ actor: context.userEmail ?? "unknown", action: field, clientId: context.clientId, projectKey: context.projectKey, target: String(args.id ?? args.email ?? args.projectKey ?? "") });
          } catch (error) {
            log.error("admin audit write failed (mutation already committed)", error, { action: field, clientId: context.clientId, projectKey: context.projectKey });
          }
        }
        return result;
      };
    }
  }
  return secured as T;
}

export { authorize, clientScopedAdminFields, orgAdminOnlyFields, type AdminContext } from "./auth.js";
