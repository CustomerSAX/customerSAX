# CSA Assistant Zendesk plugin

The assistant's Plugins → Zendesk entry opens a project-scoped connection form.
Administrators supply a Zendesk subdomain and existing OAuth access token with
ticket read permission. Hub validates the token and stores it encrypted using
its existing connection store. Studio never persists the token, returns it in
responses, or sends it to the model. The form clears its password field after
each save attempt and on close. Automatic OAuth sign-in and refresh are not
implemented; replace the plugin connection when its token expires.

## Setup

1. Build and approve a Zendesk connector release supporting `find-tickets`
   (1.1.0 or later) in Hub. Run Hub in live mode. Account connection does not
   approve new code or promote an existing ticketing binding.
2. Configure Studio's server-side `CONNECTION_HUB_*` execution settings and
   `CONNECTION_HUB_ADMIN_API_KEY` (Hub's `ADMIN_API_KEY`). In production mode,
   use `CONNECTION_HUB_PROD_ADMIN_API_KEY` instead. Never use `NEXT_PUBLIC_*`.
3. Configure the ticketing service with the same Hub URL, execution key, mode,
   client ID and tenant mapping as Studio. It does not need the admin key or
   Zendesk token. The current ticketing plugin transport supports the public
   HTTPS Hub deployment and localhost development.
4. Restart Studio, ticketing and AI Assist. BFF picks up the ticketing schema
   through its existing introspection polling; restart BFF if necessary.
5. Open CSA Assistant → Plugins → Zendesk. Enter the account details and click
   **Connect Zendesk**, then **Try in chat** and send the suggested prompt.

## Execution and isolation

Studio's authenticated `/api/connection-hub/zendesk` endpoint supports status,
connect/replace, and disconnect. The session determines client/project; mutation
requests also carry the form's expected scope to reject stale project changes.
Management calls stay server-side and require an administrator. The deployment
is restricted to `CONNECTION_HUB_CLIENT_ID`; tenant mapping is server-configured.

Assistant setup binds only `zendesk-find-tickets → find-tickets`. This is independent of
`zendesk-read`, which the Tickets page can use when Zendesk is the selected
ticketing provider. Connecting the assistant plugin never modifies the MongoDB
project's ticketing selection or the existing ticketing binding.

## Using the same account on the Tickets page

Select Zendesk as the project's ticketing provider in Admin Settings → Connectors.
The existing Zendesk adapter keeps the same list, filters, detail, comments and
provider-fields UI. Its `zendesk-read → rc_zendesk_read` binding can reference
the same encrypted Hub connection and approved release as the assistant search
binding. Create that binding explicitly through Hub's administrator API; this
is separate from connecting or removing the assistant plugin.

Ticketing's existing read adapter now honors `USE_CONNECTION_HUB_PROD`, the
production URL/execution key and tenant mapping, matching the assistant path.
Reads validate live execution metadata against the selected binding and account.
Native and Freshdesk projects retain their selected provider.

Create/update/note operations continue using the project's existing direct
Zendesk OAuth client settings, with the same account required as the Hub read
binding. The assistant's read-only token does not enable ticket writes. The
current `rc_b2b_shop_july_2023` project has both read bindings configured against
its existing `royalcyber-21430` Hub connection.

The `search_zendesk_tickets` model tool calls BFF's `zendeskPluginTickets` query.
Ticketing verifies authenticated agent identity and project ownership, checks
the enabled binding, then executes through Hub. Live-mode execution metadata
must match tenant, project, binding, connection and action. Only bounded ticket
summaries are returned. No Zendesk writes or native-ticket links are exposed.

Plugins lists connected Zendesk under **Selected connectors** with a **Remove connector** action. Removal updates that list immediately after the server succeeds; Zendesk stays available to reconnect. Removal failures keep the selected connector visible with a retryable error.

Remove connector disables the assistant binding using its current revision. It does
not revoke the provider token or a connection used elsewhere. Tokens belonging
to replaced or failed connection attempts can be reviewed/revoked in Hub.
Concurrent binding changes fail with a conflict instead of overwriting them.

Missing keys, unapproved releases, invalid tokens, unavailable Hub, and disabled
bindings produce retryable errors. There is no fallback to native ticket data
for an explicit Zendesk request. Use account-scoped authorization rather than
sharing this deployment-wide admin key with browser code or end users.
