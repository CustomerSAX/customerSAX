/**
 * GET    /api/superadmin/clients/[id] — get a single client + its projects/users/smtp profiles
 * PUT    /api/superadmin/clients/[id] — update client name / contactEmail / ssoConfig
 * PATCH  /api/superadmin/clients/[id] — set status (active | blocked)
 * DELETE /api/superadmin/clients/[id] — permanently delete a client and its projects/profiles
 *
 * Requires superadmin role (see lib/get-current-user.ts / clients/route.ts's doc comment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';
import type { ClientStatus } from '@/lib/mongo-clients';

async function requireSuperadmin(): Promise<{ email: string } | NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;
  return { email: user!.email };
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/superadmin/clients/[id]
 * Returns the client along with its projects, SMTP profiles, and users.
 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const { findClientById } = await import('@/lib/mongo-clients');
    const { listProjectsByClient } = await import('@/lib/mongo-projects');
    const { listUsersByClient } = await import('@/lib/mongo-users');
    const { listSmtpProfilesByClient } = await import('@/lib/mongo-smtp-profiles');

    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [projects, users, smtpProfiles] = await Promise.all([
      listProjectsByClient(id),
      listUsersByClient(id),
      listSmtpProfilesByClient(id),
    ]);

    return NextResponse.json({ client, projects, smtpProfiles, users });
  } catch (error) {
    console.error('[superadmin/clients/[id]] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

/**
 * PUT /api/superadmin/clients/[id]
 * Updates name, contactEmail, and/or per-tenant SSO (OIDC / SAML) configuration.
 *
 * Body: { name?: string, contactEmail?: string, ssoConfig?: object }
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { updateClient, findClientById, findClientByIdRaw } = await import('@/lib/mongo-clients');
    const { parseClientSsoConfigInput } = await import('@/lib/parse-client-sso-input');

    const name = typeof body.name === 'string' ? body.name : undefined;
    const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail : undefined;

    const patch: {
      name?: string;
      contactEmail?: string;
      ssoConfig?: import('@/lib/mongo-clients').ClientSsoConfigStored;
    } = {};

    if (name !== undefined) patch.name = name;
    if (contactEmail !== undefined) patch.contactEmail = contactEmail;

    if ('ssoConfig' in body) {
      const existing = await findClientByIdRaw(id);
      const parsed = parseClientSsoConfigInput(body.ssoConfig, existing);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      patch.ssoConfig = parsed.value;
    }

    if (patch.name === undefined && patch.contactEmail === undefined && patch.ssoConfig === undefined) {
      return NextResponse.json(
        { error: 'At least one of name, contactEmail, or ssoConfig is required' },
        { status: 400 }
      );
    }

    const updated = await updateClient(id, {
      name: patch.name,
      contactEmail: patch.contactEmail,
      ssoConfig: patch.ssoConfig,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = await findClientById(id);
    return NextResponse.json({ message: 'Client updated', client });
  } catch (error) {
    console.error('[superadmin/clients/[id]] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

/**
 * PATCH /api/superadmin/clients/[id]
 * Sets the client status to 'active' or 'blocked'.
 *
 * Body: { status: 'active' | 'blocked' }
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { status?: string };
    const status = body.status as ClientStatus | undefined;

    if (status !== 'active' && status !== 'blocked') {
      return NextResponse.json({ error: "status must be 'active' or 'blocked'" }, { status: 400 });
    }

    const { setClientStatus } = await import('@/lib/mongo-clients');
    const updated = await setClientStatus(id, status);

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: `Client ${status === 'blocked' ? 'blocked' : 'unblocked'} successfully`,
      status,
    });
  } catch (error) {
    console.error('[superadmin/clients/[id]] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update client status' }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/clients/[id]
 * Permanently deletes the client, all of its projects, and its SMTP
 * profiles; deactivates (does not delete) any users scoped to it, since
 * those are real login-capable accounts owned by apps/auth's schema.
 */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const { findClientById, deleteClient } = await import('@/lib/mongo-clients');
    const { deleteProjectsByClient } = await import('@/lib/mongo-projects');
    const { deleteSmtpProfilesByClient } = await import('@/lib/mongo-smtp-profiles');
    const { deactivateUsersByClient } = await import('@/lib/mongo-users');

    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const projectsDeleted = await deleteProjectsByClient(id);
    await deleteSmtpProfilesByClient(id);
    const usersDeactivated = await deactivateUsersByClient(id);

    await deleteClient(id);

    console.info(
      `[superadmin/clients/[id]] Deleted client '${client.name}' (${id}) — ${projectsDeleted} project(s) removed, ${usersDeactivated} user(s) deactivated`
    );

    return NextResponse.json({ message: `Client '${client.name}' deleted`, projectsDeleted, usersDeactivated });
  } catch (error) {
    console.error('[superadmin/clients/[id]] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
