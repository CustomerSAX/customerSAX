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
export { ObjectId } from "mongodb";
export type { Collection, Db, Document, Filter, Sort } from "mongodb";
export * from "./admin/db.js";
export * from "./connection.js";

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------
export * from "./encrypt.js";

// ---------------------------------------------------------------------------
// Durable idempotency keys (exactly-once writes)
// ---------------------------------------------------------------------------
export * from "./idempotency.js";

// ---------------------------------------------------------------------------
// Domain — clients
// ---------------------------------------------------------------------------
export * from "./clients/parse-sso-input.js";
export * from "./clients/repository.js";
export * from "./clients/sso-secrets.js";
export * from "./clients/types.js";

// ---------------------------------------------------------------------------
// Domain — projects
// ---------------------------------------------------------------------------
export * from "./projects/repository.js";
export * from "./projects/standalone-workspace-core.js";
export * from "./projects/test-connection.js";
export * from "./projects/types.js";

// ---------------------------------------------------------------------------
// Domain — smtp profiles
// ---------------------------------------------------------------------------
export * from "./smtp-profiles/repository.js";
export * from "./smtp-profiles/resolve-send-email-post-url.js";
export * from "./smtp-profiles/test-send.js";
export * from "./smtp-profiles/types.js";

// ---------------------------------------------------------------------------
// Domain — users
// ---------------------------------------------------------------------------
export * from "./users/repository.js";
export * from "./users/types.js";

// ---------------------------------------------------------------------------
// Domain — knowledge base
// ---------------------------------------------------------------------------
export * from "./knowledge-base/repository.js";
export * from "./knowledge-base/types.js";

// ---------------------------------------------------------------------------
// Namespace re-exports — lets apps/admin/src/schema.ts keep its existing
// `import * as clientsRepo from "..."` style with minimal changes.
// ---------------------------------------------------------------------------
export * as clientsRepo from "./clients/repository.js";
export * as knowledgeBaseRepo from "./knowledge-base/repository.js";
export * as projectsRepo from "./projects/repository.js";
export * as smtpRepo from "./smtp-profiles/repository.js";
export * as usersRepo from "./users/repository.js";

export * from "./projects/ticketing.js";

export * from "./projects/freshdesk.js";

export * from "./projects/products.js";
