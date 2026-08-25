import { createHash, randomBytes } from 'crypto';

/** Subset of fields read from the issuer discovery document. */
export interface OpenIdDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Loads OIDC discovery JSON for an issuer URL.
 *
 * @param issuer - Base issuer URL (with or without trailing slash)
 */
export async function fetchOpenIdDiscovery(issuer: string): Promise<OpenIdDiscovery> {
  const base = issuer.replace(/\/$/, '');
  const url = `${base}/.well-known/openid-configuration`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`OpenID discovery failed for ${url} (${res.status})`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const authz = json.authorization_endpoint;
  const token = json.token_endpoint;
  if (typeof authz !== 'string' || typeof token !== 'string') {
    throw new Error('OpenID discovery document missing authorization_endpoint or token_endpoint');
  }
  const userinfo = json.userinfo_endpoint;
  return {
    authorization_endpoint: authz,
    token_endpoint: token,
    userinfo_endpoint: typeof userinfo === 'string' ? userinfo : undefined,
  };
}

/**
 * Generates PKCE code_verifier and S256 code_challenge per RFC 7636.
 */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

/**
 * Builds random OAuth state value (hex).
 */
export function createOauthState(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Parses a JWT body segment without verifying the signature (already obtained from token endpoint over TLS).
 *
 * @param jwt - Signed JWT string
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    let seg = padded;
    while (seg.length % 4 !== 0) {
      seg += '=';
    }
    const json = Buffer.from(seg, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
