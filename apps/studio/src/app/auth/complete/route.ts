/**
 * GET /auth/complete
 *
 * Bridge route: after Auth0 SDK completes the callback and sets its own
 * `appSession` cookie, it redirects here (via the `returnTo` param on
 * /auth/login). We read the Auth0 session, extract the user email, and
 * exchange it for a `csa_session` via apps/auth — which is what the rest
 * of the studio app uses for identity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0-client';
import { safeInternalAppPath } from '@/lib/safe-internal-path';

const authServiceUrl = () =>
  process.env.AUTH_SERVICE_URL?.trim() || 'http://localhost:4360';

function secureCookie(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.AUTH_FORCE_SECURE_COOKIES === 'true'
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const nextUrl = safeInternalAppPath(
    request.nextUrl.searchParams.get('nextUrl') ?? '/dashboard'
  );

  const errRedirect = (code: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(code)}`, request.url)
    );

  // 1. Read the Auth0 session (appSession cookie set by /auth/callback)
  let email: string | undefined;
  try {
    const session = await auth0.getSession();
    email = session?.user?.email ?? undefined;
  } catch (e) {
    console.error('[auth/complete] getSession error:', e);
    return errRedirect('auth0_session_failed');
  }

  if (!email) {
    console.warn('[auth/complete] No email in Auth0 session');
    return errRedirect('email_missing');
  }

  // 2. Exchange email for a csa_session via apps/auth
  const seedSecret = process.env.SEED_SECRET?.trim() || '';
  let token: string | undefined;
  let expiresAt: string | undefined;

  try {
    const res = await fetch(`${authServiceUrl()}/sessions/sso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csa-sso-secret': seedSecret,
      },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[auth/complete] apps/auth rejected:', res.status, await res.text().catch(() => ''));
      return errRedirect('user_not_found');
    }

    const payload = (await res.json()) as { token?: string; expiresAt?: string };
    token = payload.token;
    expiresAt = payload.expiresAt;
  } catch (e) {
    console.error('[auth/complete] apps/auth fetch failed:', e);
    return errRedirect('auth_service_unavailable');
  }

  if (!token || !expiresAt) {
    return errRedirect('session_creation_failed');
  }

  // 3. Set csa_session cookie and redirect into the app
  const cookieName = process.env.AUTH_COOKIE_NAME?.trim() || 'csa_session';
  const destination = new URL(nextUrl === '/' ? '/dashboard' : nextUrl, request.url);
  const response = NextResponse.redirect(destination);

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(),
    path: '/',
    expires: new Date(expiresAt),
  });

  return response;
}
