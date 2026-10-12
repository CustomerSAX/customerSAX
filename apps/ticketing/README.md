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

## Superadmin project setup

Go to **Client Organisations → client → Projects → Ticketing** beside the
project. Select Native or Zendesk. For Zendesk enter the subdomain, OAuth client
Identifier and secret, click Test Connection, then Save Ticketing Settings.
Use a **confidential** OAuth client owned by a Zendesk agent/admin, with
`read tickets:write` allowed scopes. This setup uses client credentials: agents
need no Zendesk browser login, and the service obtains fresh tokens automatically.
The test verifies authorization, search and field reads without writing tickets;
it does not prove every possible ticket write is permitted by the owner's role.

Ticketing must read the same admin cluster and `MONGO_ADMIN_DB` as Admin, and
use the same stable `SUPERADMIN_ENCRYPTION_KEY`. When native ticket data lives
in a different cluster, set `MONGO_ADMIN_URI` to Admin's connection string and
keep `MONGO_URI` pointing at native ticket storage. A key is required even locally when storing Zendesk
secrets. Blank secrets keep the saved secret; changing the account or Identifier
requires a new secret. Secrets are never returned to the settings UI.

Build `@csa/mongodb`, restart admin and ticketing, then restart the BFF to compose
the new schema. No BFF provider environment setting is needed. Requests carrying
an authenticated client and active project use the saved project setting;
unconfigured projects default to native and do not inherit local Zendesk env
credentials. Settings/database errors never fall back to another account.

Each Zendesk subdomain is reserved for one project across clients, enforced by a
unique database index. The reservation remains when selecting native; changing
the configured Zendesk account or deleting the project releases it. All tickets
in the reserved account are visible to that project. Shared Zendesk accounts and
per-ticket project partitioning are not supported yet. Native ticket operations are scoped by client ID and project key. Legacy tickets
without a client ID remain accessible only when the project key has one owner;
ambiguous legacy records require an explicit ownership backfill.

The local environment/OAuth helper below remains available for development
requests without client context; that path is rejected in production. Existing
local tokens are not automatically imported into Superadmin. Configure the
connection explicitly before using it through Studio.

## Local Env

Copy `.env.example` to `.env` and set:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `MONGO_TICKETS_COLLECTION`

Studio/BFF forwards the active project from the user's session automatically.
`TICKETING_PROJECT_KEY` is only an optional fallback for direct local requests
without that context (for example, set it to `default` for standalone testing).
Native ticket queries/writes are scoped by this project key.

## Test native ticketing

Set `TICKETING_PROVIDER=internal` (the default) and run:

```sh
pnpm --filter @csa/ticketing dev
```

Native operations use the existing MongoDB repository unchanged. The existing
in-memory fallback remains available for local development without `MONGO_URI`.

## Set up Zendesk locally

1. In `apps/ticketing/.env`, set `ZENDESK_SUBDOMAIN` (for example `mycompany`),
   `ZENDESK_CLIENT_ID` (the OAuth Identifier), and `ZENDESK_CLIENT_SECRET`.
   The active project comes from Studio/BFF; no project environment setting is required.
2. Register `http://localhost:4351/callback` as a redirect URL on your confidential
   Zendesk OAuth client. Set `ZENDESK_REDIRECT_URI` to the same value.
   This callback is served by the local helper, **not Studio on port 3000**.
   Allow `read tickets:write` scopes. The unified Search API used for ticket
   listings needs broad read access; writes remain restricted to tickets.
   Authorize as a Zendesk agent/admin. If changing an existing client's allowed
   scopes, rerun authorization: editing the client does not upgrade saved tokens.
3. With the ticketing service stopped, run:

   ```sh
   pnpm --filter @csa/ticketing zendesk:authorize
   ```

4. Open `http://localhost:4351/` in your browser and approve Zendesk access.
   The command uses authorization code with PKCE, validates state/browser binding,
   saves tokens to the gitignored `apps/ticketing/.zendesk-tokens.json` with
   owner-only permissions, then exits. Tokens are never printed.
5. Set `TICKETING_PROVIDER=zendesk`, then start the ticketing service:

   ```sh
   pnpm --filter @csa/ticketing dev
   ```

The service refreshes tokens from the local file when needed. Run only one
ticketing process against that file and stop it before reauthorizing. This local
file store is for development, not shared or multi-instance deployment. If a
refresh outcome is uncertain, reauthorize rather than retrying the same rotating
refresh token.

If you already have a Zendesk OAuth access token, you can instead set
`ZENDESK_ACCESS_TOKEN`. This overrides the file and is not automatically refreshed.
Client ID and secret alone do not grant authorization-code API access.

## Try the same GraphQL API with either provider

For the environment-based test below, send requests directly to
`http://localhost:4350/graphql` without a client header. Studio/BFF uses the
Superadmin project settings described above.
Requests use `x-csa-project-key` forwarded from the active Studio session, ahead
of the optional `TICKETING_PROJECT_KEY` fallback. For direct GraphQL testing,
supply that header or set the fallback. Missing both rejects ticket operations.
This local setup uses one shared Zendesk account: switching projects does not
switch Zendesk accounts or isolate their tickets. Listings show the configured
account's tickets. Per-project account configuration/isolation is deferred.

```graphql
query {
  ticketingProvider
  ticketPage(limit: 10) {
    total
    results { id ticketNumber subject status priority customerEmail }
  }
}
```

```graphql
mutation {
  createTicket(draft: {
    subject: "CSA integration test"
    customerEmail: "your-test-customer@example.com"
    message: "Testing the Zendesk provider"
    priority: "normal"
  }) { id ticketNumber subject }
}
```

The mutation creates a real ticket in your test Zendesk account. Use the returned
ID with `ticket`, `updateTicket`, and `addTicketWorklog`. Zendesk IDs include the
account (`zendesk:mycompany:123`); raw numeric Zendesk ticket numbers also work.
Switching providers changes which backend serves requests; it does not migrate
or aggregate tickets. Native IDs are unchanged.

## Included in this step

- Shared `TicketingProvider` interface and environment-based provider selection.
- Zendesk list/search, get, create, update, and private worklog comments.
- Read comments and attachments on demand through the existing GraphQL fields.
- Status/priority translation, rate-limit errors, and safe-update collision checks.
- Optional custom field mapping through `ZENDESK_FIELD_MAPPINGS`. For fields such
  as category, commerce customer ID, order number, solution, and time spent, set
  mappings before supplying nonempty values. Zendesk dropdown values must match
  the CSA values. Unmapped business fields are rejected before writing.

Initial descriptions and worklogs are private notes. Public replies, attachment
upload, audit-history import, custom statuses, UI-specific workflows, and webhooks
are deferred. Closed tickets cannot be edited/reopened; resolve them from CSA and
let Zendesk manage closing. The existing UI may offer operations the adapter
rejects; use the GraphQL examples for this first provider-level test.

Zendesk's normal search endpoint exposes up to 1,000 retrievable results; larger
offsets return an error. Search indexing may lag after creation, so use direct
ticket lookup to verify a new ticket. No automatic write retries are performed;
after a timeout, check Zendesk before submitting again.

## Checks

```sh
pnpm exec vitest run apps/ticketing/src
pnpm --filter @csa/ticketing typecheck
```

Tests mock Zendesk and do not authorize accounts or create real tickets.

## Freshdesk project setup

In **Superadmin → Client → Projects → Ticketing**, select **Freshdesk** and enter:

- Domain, such as `royalcyber-help.freshdesk.com` (the HTTPS account URL also works).
- Agent API key from Freshdesk Profile Settings.

Use Test Connection, then Save Ticketing Settings. The test reads the current
agent, tickets and field definitions; it does not create or modify tickets or
verify every write permission. The key is encrypted using the existing shared
`SUPERADMIN_ENCRYPTION_KEY`; it is never returned to Studio. Blank preserves the
saved key. Changing the domain requires entering a key. No OAuth callback or
Freshdesk environment credentials are required. Freshdesk and Zendesk credentials
are stored separately and retained when switching providers. Each saved account
stays reserved for this project until its domain changes or the project is deleted.

Restart Admin and Ticketing, then BFF after building `@csa/mongodb`; reload Studio.
The selected provider badge updates after saving. Existing tickets are not migrated.

The initial Freshdesk adapter supports list/detail, create/update, private notes,
conversation/attachment reads and read-only custom fields. New ticket descriptions
use Freshdesk's standard create-ticket behavior and account notification rules;
internal notes are explicitly private. HTML input is escaped. Freshdesk does not
have the shared model's separate In Progress status, so it maps to Open.

List queries use a bounded account snapshot (up to 1,000 accessible non-deleted
non-spam tickets), including older tickets, to support the existing UI's totals,
sorting and filters. Larger accounts return an explicit limit error and need a
server-side search/pagination extension. Each page with requester details consumes
extra API credits; avoid repeated refreshes on a trial account. Conversations load
on the detail page only. There are no automatic write retries.

Attachment uploads, public replies, custom-field editing, audit history and CSA
business-field mappings are not included. Nonempty unmapped business fields are
rejected rather than silently discarded. Categories sent on writes must match the
Freshdesk account's Type choices; custom statuses and fully provider-specific
create/workflow forms remain future work.

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
