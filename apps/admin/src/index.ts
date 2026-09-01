import { buildSubgraphSchema } from "@apollo/subgraph";
import "./env.js";
import { createLogger } from "@csa/logger";
import { startSubgraph } from "@csa/service-bootstrap";
import { resolvers, typeDefs } from "./schema.js";
import { ensureClientsIndex, ensureProjectsIndex, ensureSmtpProfilesIndex, ensureUsersIndex } from "@csa/mongodb";
import { recordAdminAudit } from "./audit/repository.js";

const log = createLogger("admin");
const port = Number(process.env.ADMIN_PORT ?? process.env.PORT ?? 4370);

await Promise.all([ensureClientsIndex(), ensureProjectsIndex(), ensureSmtpProfilesIndex(), ensureUsersIndex()]).catch(
  (error) => {
    log.warn("index setup warning (non-fatal)", { reason: error instanceof Error ? error.message : String(error) });
  }
);

type AdminContext = { clientId?: string; projectKey?: string; userRole?: string; userEmail?: string };

const securedResolvers = secureAdminResolvers(resolvers);

await startSubgraph({
  serviceName: "admin",
  schema: buildSubgraphSchema([{ resolvers: securedResolvers, typeDefs }]),
  port,
});

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

/**
 * DEFAULT-DENY classification for `admin*` fields.
 *
 * Explicit allowlist of the fields a client-scoped admin (role `admin`, bound
 * to a single `clientId`) may invoke — each still constrained to that admin's
 * OWN client by the org-scoping check in `authorize()`. Anything NOT listed
 * here — including any newly added `admin*` query/mutation — is treated as
 * SUPERADMIN-ONLY. Adding a new admin field therefore fails closed (superadmin
 * required) instead of silently downgrading to client-scoped access; add it
 * here deliberately if and only if a client-scoped admin should reach it.
 */
const clientScopedAdminFields = new Set([
  // Reads scoped to the caller's own client
  "adminClient", "adminProject", "adminProjectsByClient", "adminUsersByClient",
  "adminRoles", "adminAiSettings", "adminSmtpProfilesByClient",
  // Client-scoped user/role management
  "adminAssignClientUser", "adminCreateClientUser", "adminUpdateClientUser",
  "adminRemoveUserFromClient", "adminRemoveUserFromProject", "adminUpdateClientContact",
  "adminCreateRole", "adminUpdateRole", "adminDeleteRole",
  // Client-scoped AI + SMTP configuration
  "adminUpdateAiSettings", "adminCreateSmtpProfile", "adminUpdateSmtpProfile",
  "adminDeleteSmtpProfile", "adminSetProjectSmtp", "adminTestSmtpProfile"
]);

function authorize(field: string, args: Record<string, unknown>, context: AdminContext) {
  if (context.userRole === "superadmin") return;
  if (context.userRole !== "admin" || !context.clientId || !context.projectKey || !context.userEmail) {
    throw new Error("Administrator access is required");
  }

  // Default-deny: only fields explicitly classified as client-scoped are
  // reachable by a client-scoped admin; every other admin* field (known
  // superadmin-only fields AND any unclassified/new field) requires superadmin.
  if (!clientScopedAdminFields.has(field)) throw new Error("Superadmin access is required");

  const requestedClientId = typeof args.clientId === "string" ? args.clientId : typeof args.id === "string" && field === "adminClient" ? args.id : undefined;
  if (!requestedClientId || requestedClientId !== context.clientId) {
    throw new Error("Cannot access another organisation");
  }
}
