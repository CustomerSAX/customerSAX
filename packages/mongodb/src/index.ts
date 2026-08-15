/**
 * `@csa/mongodb` — the shared MongoDB data layer for the CSA platform.
 *
 * This barrel is the stable public surface consumed directly by the running
 * services (`apps/auth`, `apps/admin`, `apps/commerce/commercetools`,
 * `apps/ticketing`). It exposes:
 *  - connection + env helpers (connection.ts) and named collection getters
 *    (admin/db.ts);
 *  - AES-256-GCM `encrypt`/`decrypt` (the single source of truth for secret
 *    encryption across services);
 *  - domain repositories, types, and helpers for clients, projects, smtp
 *    profiles, and users.
 *
 * Internal plumbing (e.g. the shared collection-accessor factory) is
 * deliberately NOT re-exported here so the published API stays minimal and
 * stable; refactors happen behind these exports without changing them.
 */

// ---------------------------------------------------------------------------
// Connection utilities
// ---------------------------------------------------------------------------
export * from "./connection.js";
export * from "./admin/db.js";
export type { Collection, Db, Document, Filter, Sort } from "mongodb";
export { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------
export * from "./encrypt.js";

// ---------------------------------------------------------------------------
// Domain — clients
// ---------------------------------------------------------------------------
export * from "./clients/types.js";
export * from "./clients/repository.js";
export * from "./clients/parse-sso-input.js";

// ---------------------------------------------------------------------------
// Domain — projects
// ---------------------------------------------------------------------------
export * from "./projects/types.js";
export * from "./projects/repository.js";
export * from "./projects/standalone-workspace-core.js";
export * from "./projects/test-connection.js";

// ---------------------------------------------------------------------------
// Domain — smtp profiles
// ---------------------------------------------------------------------------
export * from "./smtp-profiles/types.js";
export * from "./smtp-profiles/repository.js";
export * from "./smtp-profiles/resolve-send-email-post-url.js";
export * from "./smtp-profiles/test-send.js";

// ---------------------------------------------------------------------------
// Domain — users
// ---------------------------------------------------------------------------
export * from "./users/types.js";
export * from "./users/repository.js";

// ---------------------------------------------------------------------------
// Namespace re-exports — lets apps/admin/src/schema.ts keep its existing
// `import * as clientsRepo from "..."` style with minimal changes.
// ---------------------------------------------------------------------------
export * as clientsRepo from "./clients/repository.js";
export * as projectsRepo from "./projects/repository.js";
export * as smtpRepo from "./smtp-profiles/repository.js";
export * as usersRepo from "./users/repository.js";
