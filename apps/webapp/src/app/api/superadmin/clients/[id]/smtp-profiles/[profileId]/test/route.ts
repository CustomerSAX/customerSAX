/**
 * POST /api/superadmin/clients/[id]/smtp-profiles/[profileId]/test
 *
 * Sends a short test message through the configured outbound-email Cloud
 * Function using this profile. Requires SEND_EMAIL_API (or equivalent) to
 * be set — honestly reports "not configured" (503) rather than faking
 * success; see lib/resolve-send-email-post-url.ts.
 *
 * Body: { to?: string } — optional; defaults to the caller's own email.
 * Requires superadmin role (see lib/get-current-user.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/get-current-user';
import { forbidUnlessSuperadmin } from '@/lib/forbid-unless-superadmin';
import { findClientById } from '@/lib/mongo-clients';
import { findSmtpProfileByIdForClient } from '@/lib/mongo-smtp-profiles';
import { resolveSendEmailPostUrl } from '@/lib/resolve-send-email-post-url';

async function requireSuperadmin(): Promise<{ email: string } | NextResponse> {
  const user = await getCurrentUser();
  const denied = forbidUnlessSuperadmin(user);
  if (denied) return denied;
  return { email: user!.email };
}

type RouteContext = { params: Promise<{ id: string; profileId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = await requireSuperadmin();
  if (auth instanceof NextResponse) return auth;

  const { id: clientId, profileId } = await context.params;

  let bodyTo: string | undefined;
  try {
    const body = (await request.json()) as { to?: string };
    const t = body.to?.trim();
    if (t) bodyTo = t;
  } catch {
    bodyTo = undefined;
  }

  const to = bodyTo ?? (auth as { email: string }).email;

  try {
    const client = await findClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const profile = await findSmtpProfileByIdForClient(profileId, clientId);
    if (!profile) {
      return NextResponse.json({ error: 'SMTP profile not found' }, { status: 404 });
    }

    const emailUrl = resolveSendEmailPostUrl();
    if (!emailUrl) {
      return NextResponse.json(
        { error: 'Email service URL not configured (set SEND_EMAIL_API or TICKET_EMAIL_SEND_URL)' },
        { status: 503 }
      );
    }

    const subject = `[CSA] SMTP test — ${profile.name}`;
    const html = `<p>This is a test message from Customer Service Accelerator (Superadmin).</p>
<p><strong>Profile:</strong> ${profile.name}<br/>
<strong>Client:</strong> ${client.name}</p>
<p>If you received this, outbound SMTP for this profile is working.</p>`;

    const emailRes = await fetch(emailUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, clientId, smtpProfileId: profileId }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!emailRes.ok) {
      const text = await emailRes.text().catch(() => '');
      console.error('[smtp test] email API error', emailRes.status, text);
      let msg = `Email service returned ${emailRes.status}`;
      try {
        const parsed = JSON.parse(text) as { result?: string; message?: string };
        if (parsed.result) msg = parsed.result;
        else if (parsed.message) msg = parsed.message;
      } catch {
        if (text) msg = text.slice(0, 500);
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({ ok: true, to, message: 'Test email sent' });
  } catch (error) {
    console.error('[smtp test]', error);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
