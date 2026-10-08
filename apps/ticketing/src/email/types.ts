import type { EmailAddress, EmailProvider } from "@csa/email";

export type TicketEmailService = {
  provider: EmailProvider;
  from: EmailAddress;
  replyTo?: EmailAddress;
};
