import type { ObjectId } from "@csa/mongodb";

/** Per-project role membership for a user. */
export interface CsaUserProject {
  projectKey: string;
  role: string;
  standaloneB2cAccess?: boolean;
  standaloneB2bAccess?: boolean;
  /** Hex ObjectId of the CsaClient this project belongs to. Absent on pre-multi-tenancy rows. */
  clientId?: string;
}

/**
 * Mirrors the real, already-live csa_users document shape exactly —
 * including fields the newer apps/auth service doesn't declare on its own
 * narrower AuthUser type (tenantId, active-session claims) but that are
 * genuinely present on real accounts and are what this admin console
 * actually manages. Do not narrow this back down without re-checking a
 * real document first (see apps/admin's repository doc comment).
 */
export interface CsaUser {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  /** Legacy single-project role — kept for backward compat with apps/auth's session claims. */
  role: string;
  /** Primary/legacy project key. */
  projectKey?: string;
  /** Default project key for switcher/session purposes. */
  defaultProjectKey?: string;
  /** Multi-project memberships — the actual source of truth for "which clients/projects does this user belong to". */
  projects: CsaUserProject[];
  /** @deprecated client membership is derived from projects[].clientId now. */
  clientId?: string;
  /** New field some accounts created via the rebuilt auth service also carry. Optional, never required. */
  tenantId?: string;
  active: boolean;
  ctCustomerId?: string | null;
  grantedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CsaUserPublic = Omit<CsaUser, "_id" | "passwordHash"> & { id: string };
