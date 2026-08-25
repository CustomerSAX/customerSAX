/**
 * Returns the public origin for callback URLs and redirects.
 */

/**
 * Canonical app origin, e.g. https://csa.example.com (no trailing slash).
 */
export function getCanonicalAppOrigin(): string {
  const raw = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return 'http://localhost:3000';
  }
}
