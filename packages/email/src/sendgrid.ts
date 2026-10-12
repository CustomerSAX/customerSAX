import type { EmailProvider } from "./types.js";

/** Transport adapter: credentials and SendGrid payloads stay inside this module. */
export function createSendGridProvider(apiKey: string, request: typeof fetch = fetch): EmailProvider {
  return {
    name: "sendgrid",
    async send(message) {
      try {
        const response = await request("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [message.to] }],
            from: message.from,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
            subject: message.subject,
            content: [{ type: "text/plain", value: message.text }],
            tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } }
          }),
          signal: AbortSignal.timeout(10_000)
        });
        if (response.status !== 202) return { status: "rejected", statusCode: response.status };
        return { status: "accepted", messageId: response.headers.get("x-message-id") ?? undefined };
      } catch {
        // Never propagate provider errors that may include credentials or recipient data.
        return { status: "unknown" };
      }
    }
  };
}
