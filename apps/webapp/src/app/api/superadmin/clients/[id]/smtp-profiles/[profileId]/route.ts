/**
 * PUT    /api/superadmin/clients/[id]/smtp-profiles/[profileId]
 * DELETE /api/superadmin/clients/[id]/smtp-profiles/[profileId]
 *
 * Requires superadmin role (see lib/get-current-user.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';
import { findClientById } from '@/lib/mongo-clients';

async function requireSuperadmin(): Promise<{ email: string } | NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;
  return { email: user!.email };
}

type RouteContext = { params: Promise<{ id: string; profileId: string }> };

/** PUT — update profile (omit smtpPassword to keep existing secret) */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id, profileId } = await context.params;

  try {
    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpUser?: string;
      smtpPassword?: string;
      emailFrom?: string;
      isDefault?: boolean;
    };

    const { findSmtpProfileByIdForClient, updateSmtpProfile } = await import('@/lib/mongo-smtp-profiles');

    const existing = await findSmtpProfileByIdForClient(profileId, id);
    if (!existing) {
      return NextResponse.json({ error: 'SMTP profile not found' }, { status: 404 });
    }

    const portRaw = body.smtpPort;
    const smtpPort =
      portRaw !== undefined && typeof portRaw === 'number' && Number.isFinite(portRaw)
        ? portRaw
        : portRaw !== undefined
          ? Number(portRaw)
          : undefined;

    const ok = await updateSmtpProfile(profileId, id, {
      name: body.name,
      smtpHost: body.smtpHost,
      smtpPort,
      smtpSecure: body.smtpSecure,
      smtpUser: body.smtpUser,
      smtpPassword: body.smtpPassword,
      emailFrom: body.emailFrom,
      isDefault: body.isDefault,
    });

    if (!ok) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    const smtpProfile = await findSmtpProfileByIdForClient(profileId, id);
    return NextResponse.json({ message: 'SMTP profile updated', smtpProfile });
  } catch (error) {
    console.error('[smtp-profiles PUT]', error);
    return NextResponse.json({ error: 'Failed to update SMTP profile' }, { status: 500 });
  }
}

/** DELETE — remove profile */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id, profileId } = await context.params;

  try {
    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { findSmtpProfileByIdForClient, deleteSmtpProfile } = await import('@/lib/mongo-smtp-profiles');
    const existing = await findSmtpProfileByIdForClient(profileId, id);
    if (!existing) {
      return NextResponse.json({ error: 'SMTP profile not found' }, { status: 404 });
    }

    await deleteSmtpProfile(profileId, id);
    return NextResponse.json({ message: 'SMTP profile deleted' });
  } catch (error) {
    console.error('[smtp-profiles DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete SMTP profile' }, { status: 500 });
  }
}
