# CSA Ticketing Service

## Local SendGrid ticket confirmation

Native ticket creation can send a confirmation using SendGrid's Mail Send API.
This local pilot is disabled by default and rejects production use. External
Zendesk/Freshdesk providers keep their own notification behavior.

In `apps/ticketing/.env`, set:

```dotenv
TICKET_EMAIL_ENABLED=true
TICKET_EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-private-key-with-mail-send-permission
TICKET_EMAIL_FROM=your-verified-sender@example.com
TICKET_EMAIL_REPLY_TO=your-monitored-mailbox@example.com
```

Project and client come automatically from the active Studio session (the project
selector). No email-specific project/client environment variables are needed;
old `TICKET_EMAIL_PROJECT_KEY` and `TICKET_EMAIL_CLIENT_ID` values are ignored and
can be removed. Enabling email uses the local sender credentials for native ticket
creation in whichever project is active. Existing client/project ticket isolation
still applies. Keep the API key in the ignored `.env` file.
Verify the sender in SendGrid first (Single Sender verification can be used for
a local trial while domain DNS setup is pending).

Build the shared package with `pnpm --filter @csa/email build`, then start/restart
ticketing with `pnpm --filter @csa/ticketing dev`. In Studio, select
a native project and create a ticket with your own email as the
customer email. Watch ticketing logs for “Ticket email accepted by provider” and
check the inbox/spam folder and SendGrid Email Activity. HTTP 202 means accepted,
not confirmed delivery. No tunnel or Vercel deployment is required for sending.

### Automatic requests for missing details

With email enabled, `TICKET_EMAIL_AI_FOLLOWUP_ENABLED` defaults to true. Native
GraphQL ticket creation asks AI Assist to analyze the ticket using the active
client/project and agent identity. Set `AI_ASSIST_URL` in ticketing if AI Assist
is not at `http://localhost:8080`. Keep AI Assist, BFF and ticketing running;
AI Assist requires its existing MongoDB and model configuration. Restart BFF
**after ticketing** to compose the new `requestTicketInformation` mutation.

The AI selects supported missing-detail categories (new phone number, unclear
request, missing order items/quantities, or incomplete new shipping address).
Ticketing uses those selections to construct a customer-facing email; internal
summaries, worklogs, and model-generated response drafts are never sent. Complete
requests get the generic confirmation instead. Account/order changes still
require the existing approval flow. Set `TICKET_EMAIL_AI_FOLLOWUP_ENABLED=false`
to restore generic confirmations without automatic analysis on creation.

A record on the ticket claims the information-request send atomically before
calling the email provider. Only one automatic information request is attempted
per ticket, even across repeated analysis or different question wording. Accepted,
rejected, and unknown outcomes are recorded with the exact recipient and message.
Accepted emails put an unchanged ticket in Pending (waiting for the customer).
An intervening ticket edit or closure is preserved. The AI panel shows the email
outcome and content, and a worklog records the outcome. Acceptance is not proof
of inbox delivery. A crashed/in-flight send remains `sending`; check provider
activity before any manual resend. There are no automatic send retries.

Use MongoDB for durable ticket/send records. The local in-memory ticket fallback
loses tickets and send records on restart. Creation may wait up to 65 seconds
for analysis; an analysis failure preserves the ticket and logs a warning. Open
the AI panel / Analyze again to recover failed analysis; inspect existing email
records first. Analysis is synchronous in this local pilot, not a durable job queue.

To test, create a native ticket with your own customer email and the message
“Please update my phone number” without a new number. Confirm a single request
email, Pending status, and the recorded content. Analyze again and verify no
second email. Existing cached analyses may need Analyze again once to use the
new question extraction.

Replies currently go to `TICKET_EMAIL_REPLY_TO` (or the sender address if omitted).
Automatic inbound capture, reply threading, and reply notifications are still
not implemented. Use a monitored reply mailbox until Inbound Parse is connected.

### Replacing the email provider

The shared backend transport lives in `packages/email` (`@csa/email`). It owns
provider-neutral messages/results, provider selection, and the SendGrid adapter.
See [shared email usage](../../packages/email/README.md).

Ticketing keeps `src/email/config.ts` for local scope and environment settings,
`types.ts` for sender configuration, and `ticket-created.ts` for ticket content
and notification behavior. Add future provider adapters to `@csa/email` and
register them in its factory; ticket creation and templates stay unchanged.
Incoming replies need a separate adapter; the shared package currently covers
outbound email only.

One Apollo subgraph with interchangeable native MongoDB and Zendesk providers.
Connections can be configured per project in Superadmin. Studio ticket details fetch a ticket directly by ID
and show an additional read-only Zendesk Fields section for Zendesk tickets.

The section reads active custom fields present on the ticket from Zendesk's
field definitions, including their current labels and dropdown option labels.
It also shows Zendesk status, type, tags, and group/organization/form IDs.
Edit these values in Zendesk and use the section's Refresh button to reload.
New fields appear when Zendesk includes them on the ticket; unsupported lookup
relationships display their stored identifiers. Native tickets have no extra
section. Restart the BFF after restarting ticketing to compose the new
`ticketProviderFields` query.

## External ticketing through Connection Hub

Connection Hub's enabled project bindings are the source of truth. Connect Zendesk
in **Admin Settings → Connection Hub**. `zendesk-read` supplies ticket lists,
details, comments and fields. Enable `zendesk-custom-api-call` for ticket writes
and ensure the Hub account token has the required permissions. Writes preserve
safe-update checks and remain account-scoped. No ticketing OAuth client or secret
is stored, read or refreshed by the Ticketing service.

Removing or disabling Zendesk restores the native ticket store for that project;
it does not move or delete Zendesk tickets. A Hub outage fails explicitly instead
of falling back to other data. Assistant-only search remains an independent action.
Freshdesk's old direct integration is retired until Hub supports it.

Backend deployment automatically binds a shared `CONNECTION_HUB_PLATFORM_CONFIG`
secret to Ticketing, CRM and Admin. Provider credentials remain in Hub. See
[the migration and deployment contract](../../docs/architecture/CONNECTION-HUB-MIGRATION.md).
Native storage still needs its existing MongoDB configuration.

## Checks

```sh
pnpm exec vitest run apps/ticketing/src
pnpm --filter @csa/ticketing typecheck
```

## Agent notifications

The Studio header bell shows the latest 50 ticket notifications with an unread
badge, individual read-on-open, and Mark all as read. It polls every 15 seconds
while visible and refreshes when the browser regains focus. Switching the active
client/project clears the previous feed. Reads are scoped to the authenticated
agent, client and project; read state is independent for each agent.

Ticket creation, updates, assignment changes, worklogs, closure, and accepted
customer-information emails made through CSA generate events. Assigned email
addresses receive their ticket events; queue/unassigned tickets (including legacy
assignees stored as names rather than email addresses) notify the project's
agents. Reassignments notify both the previous and new assignee. Self-generated
updates are included. Existing tickets are not backfilled as new notifications.

Events/read state use `csa_ticket_notifications` in the ticket database. MongoDB
is required to retain them across restarts; local in-memory mode is ephemeral.
Notification writes are best-effort: failures are logged without failing an
already saved ticket. There is no durable notification outbox/retry worker yet.
External Zendesk/Freshdesk changes made outside CSA and inbound customer replies
need their respective webhook integrations before they can generate events.

Restart ticketing, then BFF to compose the notification query/mutations. Restart
Studio or let its dev server reload. No email-provider configuration is needed
for these in-app notifications.

## AI status in the ticket list

The AI Status column reads saved AI reviews through AI Assist's read-only batch
endpoint (`/ticket-review/statuses`). It never starts analysis or sends email.
Ticketing forwards the active agent/client/project and batches up to 100 rows per
request. AI Assist reads only reviews in that scope. The table refreshes every
15 seconds while visible; service failures show Unavailable instead of suggesting
that no review exists. External-provider tickets show Not supported.

Statuses distinguish agent input, approval, waiting for customer, in-progress
analysis/actions, failed or uncertain outcomes, and completed reviews. AI resolved
requires a confirmed automated action and a closed review/ticket; a completed
action on an open ticket shows AI action completed. Manually closed tickets with
no AI review remain Not analyzed. No historical backfill is required.

Restart AI Assist and ticketing, then BFF to compose the new Ticket.aiStatus field.
`AI_ASSIST_URL` in ticketing selects AI Assist (default localhost:8080).

Click an AI status badge in the Studio ticket list to open quick review. The panel
loads the saved review without starting analysis on open. It reuses the ticket
page's address selection, analysis, approval/decline and closure controls. Actions
retain the existing revision/approval checks and refresh the table. Escape or an
outside click closes the panel; interacting with it does not navigate the row.
