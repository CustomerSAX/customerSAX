export type AuthRole = "agent" | "admin" | "superadmin";

export type AuthUser = {
  _id?: unknown;
  active: boolean;
  email: string;
  firstName?: string;
  id: string;
  lastName?: string;
  name: string;
  passwordHash: string;
  projectKey?: string;
  role: AuthRole;
  tenantId: string;
};

export type SessionRecord = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  revokedAt?: Date;
  tokenHash: string;
  userId: string;
};

export type PublicUser = {
  email: string;
  id: string;
  name: string;
  projectKey?: string;
  role: AuthRole;
  tenantId: string;
};

export function toPublicUser(user: AuthUser): PublicUser {
  const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const id = user.id || String(user._id ?? user.email);

  return {
    email: user.email,
    id,
    name,
    projectKey: user.projectKey,
    role: user.role,
    tenantId: user.tenantId
  };
}
