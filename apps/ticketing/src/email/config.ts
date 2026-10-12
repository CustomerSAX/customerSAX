import { createEmailProvider, validateEmail } from "@csa/email";
import type { TicketEmailService } from "./types.js";

/** Local sender settings; project/client scope comes from the ticket request. */
export function localEmailConfig(projectKey: string): TicketEmailService | null {
  if (process.env.TICKET_EMAIL_ENABLED !== "true") return null;
  if (process.env.NODE_ENV === "production") throw new Error("Local ticket email is not enabled for production");
  if (!projectKey.trim()) throw new Error("An active project is required for ticket email");
  const providerName = process.env.TICKET_EMAIL_PROVIDER?.trim() || "sendgrid";
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) throw new Error("Set SENDGRID_API_KEY before enabling ticket email");
  const from = validateEmail(process.env.TICKET_EMAIL_FROM?.trim() || "", "TICKET_EMAIL_FROM");
  const replyTo = process.env.TICKET_EMAIL_REPLY_TO?.trim();
  return {
    provider: createEmailProvider({ provider: providerName, apiKey }),
    from: { email: from, name: "CustomerSAX Support" },
    replyTo: replyTo ? { email: validateEmail(replyTo, "TICKET_EMAIL_REPLY_TO") } : undefined
  };
}
