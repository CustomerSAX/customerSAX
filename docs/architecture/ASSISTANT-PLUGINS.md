# CSA Assistant Zendesk plugin

External ticketing, CRM and search now follow the [Hub-only routing contract](CONNECTION-HUB-MIGRATION.md). Commerce remains separately configured.

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

## Remove any connector from the Connection Hub catalog

Every connector with enabled project actions has a **Remove connector** button
on its card in **Admin Settings → Connection Hub**. The confirmation names the
connector and selected project. Confirming disables all its enabled actions in
that project, including actions not shown by the current catalog release.
Shared credentials, other projects and provider tokens remain active.

The generic `DELETE /api/connection-hub/connectors/:connectorId` route requires
an administrator and a matching client/project session. It resolves binding
targets server-side, checks revisions, and verifies all actions are disabled
before returning success. The form refreshes catalog and plugin status on both
success and failure; partial failures remain retryable. This supports every
connector without a provider-specific removal implementation.

## Manage Zendesk from the Connection Hub catalog

In **Admin Settings → Connection Hub → Zendesk → Manage Zendesk**, administrators
can enter a replacement OAuth access token or remove Zendesk from the selected
project. The account subdomain is prefilled and stays fixed during credential
updates. Hub validates and encrypts the replacement token before any project
binding changes. Saved tokens are never returned to the browser.

This project-wide form uses `/api/connection-hub/zendesk/connector`. Credential
updates move all existing Zendesk bindings, including Tickets' `zendesk-read`
and Assistant's `zendesk-find-tickets`, to the new encrypted connection. Each
action keeps its approved release and enabled state. A new or fully removed
connector enables only these two read actions when connected; disabled write
actions stay disabled. It does not change the project's selected ticketing
provider or its separate OAuth client settings for ticket writes.

**Remove connector → Remove from project** disables every enabled Zendesk action
in the current project after confirmation. Other projects and shared Hub accounts
stay active; this does not revoke the OAuth token at Zendesk. Removing Zendesk restores native tickets for this project. The catalog's Enabled badge reflects configured
bindings, not a live credential health check.

Mutations require an administrator and the same client/project as the current
session. Binding revisions prevent overwriting concurrent changes. Hub updates
bindings individually, so a failure can leave a partial update. The form refreshes
status after errors and allows retry; it never reports success until the resulting
bindings have been verified. Old encrypted connections remain in Hub for separate
review/revocation because they may be shared with other projects.

The existing Assistant plugin dialog continues to manage Assistant search only.

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

The Native Connectors tab lists built-in capabilities only; external discovery and
account setup belong to Connection Hub. Existing project ticketing selections are
preserved by that UI cleanup. For a project already using Zendesk, the adapter
keeps the same list, filters, detail, comments and provider-fields UI. Its `zendesk-read → rc_zendesk_read` binding can reference
the same encrypted Hub connection and approved release as the assistant search
binding. Create that binding explicitly through Hub's administrator API; this
is separate from connecting or removing the assistant plugin.

Ticketing's existing read adapter now honors `USE_CONNECTION_HUB_PROD`, the
production URL/execution key and tenant mapping, matching the assistant path.
Reads validate live execution metadata against the selected binding and account.
Native and Freshdesk projects retain their selected provider.

Create/update/note operations require an enabled Zendesk Custom API Call binding
in Hub for the same account. The service never uses separately saved Zendesk OAuth
client credentials. The assistant's read-only token does not enable ticket writes. The
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
