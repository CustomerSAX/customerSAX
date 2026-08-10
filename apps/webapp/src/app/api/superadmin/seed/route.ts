/**
 * POST /api/superadmin/seed
 *
 * One-time bootstrap endpoint that creates the initial superadmin account.
 * Requires a SEED_SECRET token (matches apps/auth/.env.example's SEED_SECRET
 * naming) to prevent unauthorized use.
 *
 * NOTE: middleware.ts's `publicPathPrefixes` does not currently list this
 * route, so it is only reachable once a session cookie already exists
 * (i.e. not truly usable for a from-zero bootstrap). That list lives in
 * the auth system this feature was told not to modify — use
 * `scripts/create-superadmin.mjs` instead for from-zero bootstrap; it
 * writes directly to MongoDB and doesn't depend on the webapp's routing at
 * all. This route is kept for parity/manual use once at least one session
 * exists, or after a teammate adds `/api/superadmin/seed` to the public
 * path list themselves.
 *
 * Body: { secret: string, email: string, password: string, firstName?: string, lastName?: string }
 *
 * Security:
 *   - Requires body.secret to match SEED_SECRET env var.
 *   - Returns 409 if that email already exists.
 *   - Returns 404 when SEED_SECRET is not configured (disabled state).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ROLES } from '@/constants';

const PLATFORM_TENANT_ID = 'platform';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const seedSecret = process.env.SEED_SECRET?.trim();

  // Route is disabled when the env var is unset — prevents accidental exposure.
  if (!seedSecret) {
    return NextResponse.json(
      { error: 'Superadmin seed is disabled. Set SEED_SECRET to enable.' },
      { status: 404 }
    );
  }

  let body: {
    secret?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { secret, email, password, firstName, lastName } = body ?? {};

  // Constant-time comparison to prevent timing attacks on the seed secret.
  const providedBuf = Buffer.from(secret ?? '', 'utf8');
  const expectedBuf = Buffer.from(seedSecret, 'utf8');
  const secretMatch =
    providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!secretMatch) {
    return NextResponse.json({ error: 'Invalid seed secret' }, { status: 403 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const { findUserByEmail, createUser } = await import('@/lib/mongo-users');

    const existing = await findUserByEmail(email);
    if (existing) {
      if (existing.role === ROLES.superadmin) {
        return NextResponse.json(
          { message: 'Superadmin already exists', email: existing.email },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            `User ${email} already exists with role '${existing.role}'. ` +
            'Use a different email for the superadmin account.',
        },
        { status: 409 }
      );
    }

    const newUser = await createUser({
      email,
      password,
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      role: ROLES.superadmin,
      tenantId: PLATFORM_TENANT_ID,
    });

    console.info(`[superadmin/seed] Superadmin account created: ${newUser.email}`);

    return NextResponse.json(
      { message: 'Superadmin created successfully. Consider clearing SEED_SECRET afterward.', email: newUser.email },
      { status: 201 }
    );
  } catch (error) {
    console.error('[superadmin/seed] Failed to create superadmin:', error);
    return NextResponse.json({ error: 'Failed to create superadmin account' }, { status: 500 });
  }
}
