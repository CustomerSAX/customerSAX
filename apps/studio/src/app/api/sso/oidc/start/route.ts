/**
 * GET /api/sso/oidc/start — begins the OAuth 2.0 authorization code + PKCE flow for a tenant IdP.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCanonicalAppOrigin } from '@/lib/app-origin';
import { safeInternalAppPath } from '@/lib/safe-internal-path';
import {
  createOauthState,
  createPkcePair,
  fetchOpenIdDiscovery,
} from '@/lib/sso-oidc';
import { clientsRepo } from '@csa/mongodb';
import { SSO_OIDC_CV, SSO_OIDC_ST, SSO_OIDC_CID, SSO_OIDC_NEXT } from '@/lib/sso-cookies';

const COOKIE_MAX_AGE = 600;

function secureCookie(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.AUTH_FORCE_SECURE_COOKIES === 'true'
  );
}

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE,
  secure: secureCookie(),
};

/**
 * Parses an optional OIDC login_hint from `/sign-in` (email pre-fill at IdP).
 * Invalid values are omitted so SSO still works if the hint is malformed.
 */
function sanitizeLoginHintParam(raw: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim().toLowerCase();
  if (t.length < 5 || t.length > 254 || !t.includes('@') || /<|>|\n|\r|'|"/u.test(t)) {
    return undefined;
  }
  const [local, domain = ''] = t.split('@');
  if (!local || !domain || local.startsWith('.') || domain.startsWith('.') || local.includes('@')) {
    return undefined;
  }
  return t;
}

/**
 * GET /api/sso/oidc/start?clientId=&callbackUrl=&loginHint=
 *
 * loginHint becomes the OAuth `login_hint` on the authorize request so IdPs
 * (e.g. Auth0, Entra ID) can pre-fill the user's email/username.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const appOrigin = getCanonicalAppOrigin();
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(msg)}`, `${appOrigin}/`));

  const clientIdParam = request.nextUrl.searchParams.get('clientId')?.trim() ?? '';
  if (!clientIdParam) {
    return fail('missing_client');
  }

  const nextPath = safeInternalAppPath(request.nextUrl.searchParams.get('callbackUrl'));
  const loginHint = sanitizeLoginHintParam(
    request.nextUrl.searchParams.get('loginHint') ?? request.nextUrl.searchParams.get('login_hint')
  );

  const row = await clientsRepo.findClientByIdRaw(clientIdParam);
  if (!row || row.status !== 'active') {
    return fail('client_not_found');
  }

  const cfg = row.ssoConfig;
  if (!cfg || cfg.provider !== 'oidc') {
    return fail('oidc_not_configured');
  }

  let discovery: Awaited<ReturnType<typeof fetchOpenIdDiscovery>>;
  try {
    discovery = await fetchOpenIdDiscovery(cfg.issuer);
  } catch (err) {
    console.error('[sso/oidc/start] discovery:', err);
    return fail('discovery_failed');
  }

  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = createOauthState();

  const origin = appOrigin;
  const redirectUri = `${origin}/api/sso/oidc/callback`;

  const scopeParts = ['openid', 'email', 'profile'];
  if (cfg.extraScopes?.trim()) {
    for (const s of cfg.extraScopes.trim().split(/\s+/)) {
      if (s && !scopeParts.includes(s)) scopeParts.push(s);
    }
  }
  const scope = scopeParts.join(' ');

  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set('client_id', cfg.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  if (loginHint) {
    authUrl.searchParams.set('login_hint', loginHint);
  }
  /** Auth0: database / enterprise connection name; other IdPs may ignore `connection`. */
  const authorizeConn = cfg.authorizeConnection?.trim();
  if (authorizeConn) {
    authUrl.searchParams.set('connection', authorizeConn);
  }

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(SSO_OIDC_CV, codeVerifier, baseCookie);
  res.cookies.set(SSO_OIDC_ST, state, baseCookie);
  res.cookies.set(SSO_OIDC_CID, clientIdParam, baseCookie);
  res.cookies.set(SSO_OIDC_NEXT, nextPath, { ...baseCookie, maxAge: COOKIE_MAX_AGE });
  return res;
}
