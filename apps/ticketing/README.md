# CSA Ticketing Service

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
