# Connection Hub as the external integration registry

Commerce platform integrations remain in project configuration. External ticketing,
CRM and product search use enabled Connection Hub bindings exclusively. Native
tickets and native commerce remain available. Existing encrypted legacy records
are preserved for rollback but are not read by these runtime paths.

## Runtime selection

- Ticketing selects Zendesk when `zendesk-read` or `zendesk-custom-api-call` is
  enabled. Reads use the read binding when available; other operations require the
  enabled custom API action. The adapter never uses saved direct OAuth credentials.
  Removing Zendesk returns the project to native tickets; an outage does not.
- CRM selects one enabled Salesforce, HubSpot or Zoho CRM connector. The existing
  CRM workspace requires that connector's Custom API Call action. Multiple selected
  CRMs or conflicting accounts return an explicit configuration error. No legacy
  project secret or environment provider default is used. HubSpot portal links and
  Zoho organization links are omitted when Hub does not supply that metadata.
- Products selects enabled Hub Algolia search/browse bindings. Direct saved Algolia
  keys are never returned to the browser. Without Hub Algolia, native commerce is
  retained. Commerce credentials and commerce adapters are unchanged.

Project ownership is checked before requesting Hub bindings. Executions must match
the registered client/tenant, project, connector, binding, revision, account, release,
and operation, and must be live. Applications do not approve new actions or releases
automatically. Custom API calls remain restricted by Hub's provider policies.

Freshdesk is retired because Hub has no corresponding connector. Existing external
records are not migrated into native storage. AI, SMTP and SSO remain built-in
platform capabilities, outside this connector migration.

## Central platform authentication

`CONNECTION_HUB_PLATFORM_CONFIG` is a secret JSON document containing `url`,
`apiKey` (Hub's execution key), `tenants` (explicit CSA-client-to-Hub-tenant mapping),
and optional `privateHub`. It contains no Zendesk/CRM/Algolia credentials. Unknown
clients and missing production configuration fail closed.

Terraform creates `${name_prefix}-hub-platform-config` and grants the application
runtime identity access. The backend deployment initializes its first version from
the existing Hub service URL, `TENANT_ID` and execution-key secret, then mounts the
same secret into Admin, CRM and Ticketing automatically. Existing secret versions
are preserved. Initial registration maps the Hub tenant ID to the identical CSA
client ID; deployments with different IDs must register the explicit mapping once
in this central secret. Connections and enabled actions then require no per-service
changes. No user workflow handles platform service credentials.

The Hub service must exist in the deployment environment; deployment fails if it
cannot establish a valid platform registration. Existing `CONNECTION_HUB_*` settings
remain a development/backward-compatible transport option. Studio's Vercel platform
authentication remains configured centrally on its project, separate from provider
credentials. The backend execution key is never a provider OAuth client secret.

## UI and API retirement

Project creation and onboarding no longer write direct ticketing credentials.
Superadmin shows Hub management instead of separate external connector forms.
Legacy save/test GraphQL operations remain in the schema for compatibility but
reject requests with a message directing callers to Connection Hub. Project
ticketing/CRM/search metadata is marked as Hub-managed; detailed connector settings
queries resolve Hub bindings. No saved credentials are deleted automatically.

The Zoho Hub policy change in the Connection Hub repository allows the CRM workspace's
GET-only contact search and related activity/account reads. Deploy the matching Hub
change before enabling these workspace operations. No live actions, bindings,
credentials or deployments are changed by the source migration itself.
