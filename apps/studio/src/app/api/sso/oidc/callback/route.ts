/**
 * GET /api/sso/oidc/callback — completes OAuth code exchange and provisions a session via apps/auth.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCanonicalAppOrigin } from '@/lib/app-origin';
import { safeInternalAppPath } from '@/lib/safe-internal-path';
import { decodeJwtPayload, fetchOpenIdDiscovery } from '@/lib/sso-oidc';
import { clientsRepo } from '@csa/mongodb';
import { SSO_OIDC_CV, SSO_OIDC_ST, SSO_OIDC_CID, SSO_OIDC_NEXT } from '@/lib/sso-cookies';
import { authServiceUrl, setSessionCookie } from '@/app/api/auth/shared';

function secureCookie(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.AUTH_FORCE_SECURE_COOKIES === 'true'
  );
}

const clearOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
  secure: secureCookie(),
};

function emailFromPayload(payload: Record<string, unknown>): string | null {
  const email = payload.email;
  if (typeof email === 'string' && email.includes('@')) {
    return email.toLowerCase().trim();
  }
  const pref = payload.preferred_username;
  if (typeof pref === 'string' && pref.includes('@')) {
    return pref.toLowerCase().trim();
  }
  return null;
}

/**
 * GET /api/sso/oidc/callback
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const appOrigin = getCanonicalAppOrigin();
  const errUrl = (code: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(code)}`, `${appOrigin}/`));

  const q = request.nextUrl.searchParams;
  const code = q.get('code');
  const state = q.get('state');
  const err = q.get('error');

  if (err) {
    console.warn('[sso/oidc/callback] IdP error:', err, q.get('error_description'));
    return errUrl('idp_error');
  }

  if (!code || !state) {
    return errUrl('missing_code');
  }

  const cookieState = request.cookies.get(SSO_OIDC_ST)?.value;
  const codeVerifier = request.cookies.get(SSO_OIDC_CV)?.value;
  const tenantClientId = request.cookies.get(SSO_OIDC_CID)?.value;
  const nextRaw = request.cookies.get(SSO_OIDC_NEXT)?.value;
  const nextPath = safeInternalAppPath(nextRaw ?? null);

  if (!cookieState || cookieState !== state || !codeVerifier || !tenantClientId) {
    return errUrl('session_expired');
  }

  const row = await clientsRepo.findClientByIdRaw(tenantClientId);
  const cfg = row?.ssoConfig;
  if (!row || row.status !== 'active' || !cfg || cfg.provider !== 'oidc') {
    return errUrl('client_invalid');
  }

  let discovery: Awaited<ReturnType<typeof fetchOpenIdDiscovery>>;
  try {
    discovery = await fetchOpenIdDiscovery(cfg.issuer);
  } catch (e) {
    console.error('[sso/oidc/callback] discovery:', e);
    return errUrl('discovery_failed');
  }

  const redirectUri = `${appOrigin}/api/sso/oidc/callback`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: codeVerifier,
  });

  let tokenRes: Response;
  try {
    tokenRes = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[sso/oidc/callback] token fetch:', e);
    return errUrl('token_fetch_failed');
  }

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => tokenRes.statusText);
    console.error('[sso/oidc/callback] token endpoint:', tokenRes.status, text);
    return errUrl('token_exchange_failed');
  }

  const tokenJson = (await tokenRes.json()) as Record<string, unknown>;
  const idToken = typeof tokenJson.id_token === 'string' ? tokenJson.id_token : '';
  const accessToken = typeof tokenJson.access_token === 'string' ? tokenJson.access_token : '';

  let email: string | null = null;
  if (idToken) {
    const payload = decodeJwtPayload(idToken);
    if (payload) {
      email = emailFromPayload(payload);
    }
  }

  if (!email && accessToken && discovery.userinfo_endpoint) {
    try {
      const ui = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (ui.ok) {
        const uj = (await ui.json()) as Record<string, unknown>;
        email = emailFromPayload(uj);
      }
    } catch (e) {
      console.error('[sso/oidc/callback] userinfo:', e);
    }
  }

  if (!email) {
    return errUrl('email_missing');
  }

  // Instruct apps/auth to issue a session for this SSO user
  const sessionRes = await fetch(`${authServiceUrl()}/sessions/sso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csa-sso-secret': process.env.SEED_SECRET || '',
    },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });

  if (!sessionRes.ok) {
    console.error('[sso/oidc/callback] auth service rejected session:', sessionRes.status);
    return errUrl('user_not_found');
  }

  const payload = await sessionRes.json().catch(() => ({}));
  if (!payload.token || !payload.expiresAt) {
    return errUrl('session_creation_failed');
  }

  const complete = new URL(nextPath, `${appOrigin}/`);
  const res = NextResponse.redirect(complete);

  // Use the exact same cookie helper as the password login route
  setSessionCookie(res, payload.token, payload.expiresAt);

  res.cookies.set(SSO_OIDC_CV, '', clearOpts);
  res.cookies.set(SSO_OIDC_ST, '', clearOpts);
  res.cookies.set(SSO_OIDC_CID, '', clearOpts);
  res.cookies.set(SSO_OIDC_NEXT, '', clearOpts);
  
  return res;
}
