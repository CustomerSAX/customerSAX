/**
 * Builds the HTTPS POST URL for the outbound-email Cloud Function used by
 * the SMTP-profile "test" action.
 *
 * Ported from ct-csa-standalone's lib/resolve-send-email-post-url.ts,
 * trimmed to the one path this repo uses (test-send only, no order-summary
 * variant). Honestly returns null when unconfigured — see the [profileId]/
 * test route, which reports "not configured" rather than faking success.
 */

const DEFAULT_PATH = '/emailer/send-email';

function ensureHttps(url: string): string {
  const t = url.trim();
  if (!t.startsWith('http://') && !t.startsWith('https://')) {
    return `https://${t}`;
  }
  return t;
}

/** Resolves the email Cloud Function URL from env, or null if unconfigured. */
export function resolveSendEmailPostUrl(): string | null {
  const full = process.env.TICKET_EMAIL_SEND_URL?.trim();
  if (full) return ensureHttps(full);

  let base = process.env.SEND_EMAIL_API?.trim() ?? process.env.NEXT_PUBLIC_SEND_EMAIL_API?.trim() ?? '';
  if (!base) return null;
  base = ensureHttps(base);

  const pathRaw = (process.env.SEND_EMAIL_PATH ?? DEFAULT_PATH).trim();
  const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;
  const b = base.replace(/\/$/, '');

  if (path === DEFAULT_PATH && /\/emailer$/i.test(b)) {
    return `${b}/send-email`;
  }
  return `${b}${path}`;
}
