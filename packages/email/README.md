# Shared backend email

`@csa/email` provides an outbound email interface and a SendGrid adapter for any
CustomerSAX backend service. It does not read environment variables, store
credentials, or depend on ticketing. Each caller owns its sender configuration,
tenant authorization, templates, and delivery-failure handling. Use it only on
the server; API keys must never enter browser bundles.

Add `"@csa/email": "workspace:*"` to the consuming service's dependencies and run
`pnpm install`. Turbo builds workspace dependencies automatically. For direct
service commands, first run `pnpm --filter @csa/email build`. Services with explicit
Docker COPY lists must include this package in their build and runtime stages,
as the ticketing Dockerfile does.

```ts
import { createEmailProvider } from "@csa/email";

const email = createEmailProvider({
  provider: "sendgrid",
  apiKey: process.env.SENDGRID_API_KEY ?? "",
});

const result = await email.send({
  from: { email: "support@example.com", name: "CustomerSAX" },
  to: { email: "customer@example.com" },
  replyTo: { email: "support@example.com" },
  subject: "Your request was received",
  text: "Our team will review your request.",
});

// accepted means queued by the provider, not delivered to the inbox.
if (result.status === "accepted") {
  // Store result.messageId if delivery correlation is needed.
}
```

`EmailProvider.send` returns `accepted` (optional provider message ID), `rejected`
(HTTP status code), or `unknown` (network/timeout outcome). It does not retry;
blindly retrying an unknown outcome can duplicate an email. The SendGrid adapter
uses a 10-second timeout and never returns raw provider error bodies. Callers
should validate recipient addresses with the exported `validateEmail` helper.

To replace SendGrid, implement `EmailProvider` in a new adapter and register it
in `src/provider.ts`, extending the configuration type for its credentials as
needed. Consumers keep the same `EmailMessage` and `EmailSendResult` contract.
The optional factory transport argument allows tests to run without live email.

This package currently supports plain-text outbound messages. It does not
implement inbound replies, delivery webhooks, queues, or agent notifications.
