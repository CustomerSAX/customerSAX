/**
 * GET  /api/superadmin/clients — list all client organisations
 * POST /api/superadmin/clients — create a new client organisation
 *
 * Requires superadmin role, checked via the real session (see
 * lib/get-current-user.ts, which reads the same csa_session cookie
 * api/auth/{login,logout,me} already use — this route does not implement
 * its own auth).
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

/**
 * GET /api/superadmin/clients
 * Returns all client organisations with project and user counts.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { listClients } = await import('@/lib/mongo-clients');
    const { countProjectsByClient } = await import('@/lib/mongo-projects');
    const { countUsersByClient } = await import('@/lib/mongo-users');

    const clients = await listClients();

    const enriched = await Promise.all(
      clients.map(async (c) => {
        const [projectCount, userCount] = await Promise.all([
          countProjectsByClient(c.id),
          countUsersByClient(c.id),
        ]);
        return { ...c, projectCount, userCount };
      })
    );

    return NextResponse.json({ clients: enriched });
  } catch (error) {
    console.error('[superadmin/clients] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/clients
 * Creates a new client organisation.
 *
 * Body: { name: string, contactEmail: string, slug?: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const adminEmail = (auth as { email: string }).email;

  try {
    const body = (await request.json()) as {
      name?: string;
      contactEmail?: string;
      slug?: string;
    };

    const { name, contactEmail, slug: slugRaw } = body ?? {};

    if (!name || !contactEmail) {
      return NextResponse.json({ error: 'name and contactEmail are required' }, { status: 400 });
    }

    // Auto-derive slug from name if not provided: lowercase, replace spaces/special chars with hyphens
    const slug =
      slugRaw?.trim().toLowerCase() ||
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const { findClientBySlug, createClient } = await import('@/lib/mongo-clients');

    const existing = await findClientBySlug(slug);
    if (existing) {
      return NextResponse.json({ error: `A client with slug '${slug}' already exists` }, { status: 409 });
    }

    const client = await createClient({ name, contactEmail, slug, createdBy: adminEmail });

    return NextResponse.json({ message: 'Client created', client }, { status: 201 });
  } catch (error) {
    console.error('[superadmin/clients] POST failed:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
