/**
 * Sends a short test message through the configured outbound-email Cloud
 * Function using a stored SMTP profile. Honestly reports "not configured"
 * rather than faking success when SEND_EMAIL_API/TICKET_EMAIL_SEND_URL
 * aren't set — see resolve-send-email-post-url.ts.
 */

import { findClientById } from "../clients/repository.js";
import { findSmtpProfileByIdForClient } from "./repository.js";
import { resolveSendEmailPostUrl } from "./resolve-send-email-post-url.js";

export interface EmailTestResult {
  ok: boolean;
  to?: string;
  message: string;
}

export async function testSmtpProfile(profileId: string, clientId: string, to: string): Promise<EmailTestResult> {
  const client = await findClientById(clientId);
  if (!client) {
    return { ok: false, message: "Client not found" };
  }

  const profile = await findSmtpProfileByIdForClient(profileId, clientId);
  if (!profile) {
    return { ok: false, message: "SMTP profile not found" };
  }

  const emailUrl = resolveSendEmailPostUrl();
  if (!emailUrl) {
    return { ok: false, message: "Email service URL not configured (set SEND_EMAIL_API or TICKET_EMAIL_SEND_URL)" };
  }

  const subject = `[CSA] SMTP test — ${profile.name}`;
  const html = `<p>This is a test message from Customer Service Accelerator (Superadmin).</p>
<p><strong>Profile:</strong> ${profile.name}<br/>
<strong>Client:</strong> ${client.name}</p>
<p>If you received this, outbound SMTP for this profile is working.</p>`;

  try {
    const emailRes = await fetch(emailUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, clientId, smtpProfileId: profileId }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!emailRes.ok) {
      const text = await emailRes.text().catch(() => "");
      console.error("[admin/testSmtpProfile] email API error", emailRes.status, text);
      let msg = `Email service returned ${emailRes.status}`;
      try {
        const parsed = JSON.parse(text) as { result?: string; message?: string };
        if (parsed.result) msg = parsed.result;
        else if (parsed.message) msg = parsed.message;
      } catch {
        if (text) msg = text.slice(0, 500);
      }
      return { ok: false, message: msg };
    }

    return { ok: true, to, message: "Test email sent" };
  } catch (error) {
    console.error("[admin/testSmtpProfile]", error);
    return { ok: false, message: "Failed to send test email" };
  }
}
