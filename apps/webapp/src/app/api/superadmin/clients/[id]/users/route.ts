/**
 * GET    /api/superadmin/clients/[id]/users — list users scoped to this client
 *
 * POST   /api/superadmin/clients/[id]/users
 *   Two modes determined by the presence of `password` in the body:
 *   Create mode  — { email, password, firstName?, lastName?, role?, projectKey? }
 *   Assign mode  — { email, role?, projectKey? } (moves an existing user,
 *                   found by email, into this client — the real schema is
 *                   single-tenant-per-user, so this reassigns rather than
 *                   adds a membership)
 *
 * PUT    /api/superadmin/clients/[id]/users
 *   { id, firstName?, lastName?, role?, projectKey?, active?, password? }
 *
 * DELETE /api/superadmin/clients/[id]/users
 *   { id } — permanently removes the user (scoped to this client).
 *
 * Requires superadmin role (see lib/get-current-user.ts). Writes documents
 * shaped exactly like apps/auth's AuthUser — see lib/mongo-users.ts's doc
 * comment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';
import { ROLES, normalizeCsaRole } from '@/constants';

async function requireSuperadmin(): Promise<{ email: string } | NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;
  return { email: user!.email };
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/superadmin/clients/[id]/users */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const { findClientById } = await import('@/lib/mongo-clients');
    const { listUsersByClient } = await import('@/lib/mongo-users');

    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const users = await listUsersByClient(id);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[superadmin/clients/[id]/users] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/clients/[id]/users — create-new (with password) or
 * assign-existing (without password) mode. See file doc comment above.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      projectKey?: string;
    };

    const { email, password, firstName, lastName, role: roleRaw, projectKey } = body ?? {};

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Superadmin accounts aren't managed per-client — restrict to agent/admin here.
    const role = roleRaw === ROLES.admin ? ROLES.admin : ROLES.agent;

    const { findClientById } = await import('@/lib/mongo-clients');
    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.status === 'blocked') {
      return NextResponse.json({ error: 'Cannot add users to a blocked client' }, { status: 403 });
    }

    if (projectKey) {
      const { listProjectsByClient } = await import('@/lib/mongo-projects');
      const clientProjects = await listProjectsByClient(id);
      if (!clientProjects.some((p) => p.projectKey === projectKey)) {
        return NextResponse.json({ error: `Project '${projectKey}' does not belong to this client` }, { status: 400 });
      }
    }

    const { findUserByEmail, createUser, assignExistingUserToClient } = await import('@/lib/mongo-users');

    // ── ASSIGN MODE: no password → move an existing user into this client ──
    if (!password) {
      const existing = await findUserByEmail(email);
      if (!existing) {
        return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 });
      }
      if (existing.role === ROLES.superadmin) {
        return NextResponse.json({ error: 'Cannot reassign a superadmin account' }, { status: 400 });
      }
      if (existing.tenantId === id) {
        return NextResponse.json({ error: `User ${email} is already part of this client` }, { status: 409 });
      }

      const updated = await assignExistingUserToClient({ email, tenantId: id, role, projectKey });
      return NextResponse.json({
        message: `User ${email} assigned to client '${client.name}'`,
        user: updated,
        mode: 'assigned',
      });
    }

    // ── CREATE MODE: password provided → create a new user ──────────────────
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const duplicate = await findUserByEmail(email);
    if (duplicate) {
      return NextResponse.json({ error: `User ${email} already exists.` }, { status: 409 });
    }

    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
      role,
      tenantId: id,
      projectKey,
    });

    return NextResponse.json(
      { message: `User ${email} created in client '${client.name}'`, user, mode: 'created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[superadmin/clients/[id]/users] POST failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to process user request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/superadmin/clients/[id]/users
 * Body: { id, firstName?, lastName?, role?, projectKey?, active?, password? }
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      id?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      projectKey?: string | null;
      active?: boolean;
      password?: string;
    };

    const { id: userId, firstName, lastName, role: roleRaw, projectKey, active, password } = body ?? {};

    if (!userId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { findClientById } = await import('@/lib/mongo-clients');
    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { findUserByIdForClient, updateUser } = await import('@/lib/mongo-users');
    const existing = await findUserByIdForClient(userId, id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found in this client' }, { status: 404 });
    }
    if (existing.role === ROLES.superadmin) {
      return NextResponse.json({ error: 'Cannot modify a superadmin account here' }, { status: 400 });
    }

    if (password && password.trim() && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (projectKey) {
      const { listProjectsByClient } = await import('@/lib/mongo-projects');
      const clientProjects = await listProjectsByClient(id);
      if (!clientProjects.some((p) => p.projectKey === projectKey)) {
        return NextResponse.json({ error: `Project '${projectKey}' does not belong to this client` }, { status: 400 });
      }
    }

    const ok = await updateUser(userId, id, {
      firstName,
      lastName,
      role: roleRaw ? normalizeCsaRole(roleRaw) : undefined,
      projectKey,
      active,
      password: password?.trim() || undefined,
    });

    if (!ok) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('[superadmin/clients/[id]/users] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/clients/[id]/users
 * Body: { id } — permanently deletes the user account (scoped to this client).
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { id?: string };
    const { id: userId } = body ?? {};

    if (!userId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { findUserByIdForClient, deleteUserForClient } = await import('@/lib/mongo-users');
    const existing = await findUserByIdForClient(userId, id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found in this client' }, { status: 404 });
    }
    if (existing.role === ROLES.superadmin) {
      return NextResponse.json({ error: 'Cannot delete a superadmin account here' }, { status: 400 });
    }

    await deleteUserForClient(userId, id);
    return NextResponse.json({ message: `User ${existing.email} removed`, email: existing.email });
  } catch (error) {
    console.error('[superadmin/clients/[id]/users] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
