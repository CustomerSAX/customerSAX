/**
 * Shared constants for the superadmin feature. Roles mirror
 * apps/auth/src/users/types.ts's AuthRole exactly — this is the live role
 * set the auth service actually issues in sessions, not an invented one.
 */

export const ROLES = {
  agent: 'agent',
  admin: 'admin',
  superadmin: 'superadmin',
} as const;

export type CsaRole = (typeof ROLES)[keyof typeof ROLES];

export function normalizeCsaRole(value: unknown): CsaRole {
  return value === ROLES.admin || value === ROLES.superadmin ? value : ROLES.agent;
}
