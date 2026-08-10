/**
 * GET  /api/superadmin/clients/[id]/smtp-profiles — list SMTP profiles
 * POST /api/superadmin/clients/[id]/smtp-profiles — create profile
 *
 * Requires superadmin role (see lib/get-current-user.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';

async function requireSuperadmin(): Promise<{ email: string } | NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;
  return { email: user!.email };
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET — list profiles for the client */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const { findClientById } = await import('@/lib/mongo-clients');
    const client = await findClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { listSmtpProfilesByClient } = await import('@/lib/mongo-smtp-profiles');
    const smtpProfiles = await listSmtpProfilesByClient(id);
    return NextResponse.json({ smtpProfiles });
  } catch (error) {
    console.error('[smtp-profiles GET]', error);
    return NextResponse.json({ error: 'Failed to list SMTP profiles' }, { status: 500 });
  }
}

/**
 * POST — create profile
 * Body: { name, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, emailFrom, isDefault? }
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const { findClientById } = await import('@/lib/mongo-clients');
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

    const name = body.name?.trim();
    const smtpHost = body.smtpHost?.trim();
    const smtpUser = body.smtpUser?.trim();
    const smtpPassword = body.smtpPassword ?? '';
    const emailFrom = body.emailFrom?.trim();
    const smtpPort = typeof body.smtpPort === 'number' && Number.isFinite(body.smtpPort) ? body.smtpPort : Number(body.smtpPort) || 587;

    if (!name || !smtpHost || !smtpUser || !smtpPassword || !emailFrom) {
      return NextResponse.json({ error: 'name, smtpHost, smtpUser, smtpPassword, and emailFrom are required' }, { status: 400 });
    }

    const { createSmtpProfile, listSmtpProfilesByClient } = await import('@/lib/mongo-smtp-profiles');
    const existing = await listSmtpProfilesByClient(id);
    const isDefault = body.isDefault === true || existing.length === 0;

    const smtpProfile = await createSmtpProfile({
      clientId: id,
      name,
      smtpHost,
      smtpPort,
      smtpSecure: body.smtpSecure === true,
      smtpUser,
      smtpPassword,
      emailFrom,
      isDefault,
    });

    return NextResponse.json({ message: 'SMTP profile created', smtpProfile }, { status: 201 });
  } catch (error) {
    console.error('[smtp-profiles POST]', error);
    return NextResponse.json({ error: 'Failed to create SMTP profile' }, { status: 500 });
  }
}
