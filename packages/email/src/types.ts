/** Provider-independent transport contract. No ticket or SDK types cross this boundary. */
export type EmailAddress = { email: string; name?: string };
export type EmailMessage = {
  from: EmailAddress;
  to: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  text: string;
};

export type EmailSendResult =
  | { status: "accepted"; messageId?: string }
  | { status: "rejected"; statusCode: number }
  | { status: "unknown" };

export interface EmailProvider {
  readonly name: string;
  /** Accepted is not delivered. Unknown outcomes must not be blindly retried. */
  send(message: EmailMessage): Promise<EmailSendResult>;
}

