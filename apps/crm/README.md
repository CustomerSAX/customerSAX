# CSA CRM Service

One Apollo subgraph (port 4390) with interchangeable CRM providers, configured per project in
Superadmin — the same model as `apps/ticketing`. Providers: Salesforce, HubSpot and Zoho CRM; a project with no
CRM selected returns an honest "No CRM is connected" instead of any data.

Agents reach the CRM through the BFF and the CSA Assistant's CRM tools (`find_crm_contact`,
`get_crm_contact_details`, `log_crm_activity`, `update_crm_contact`).

## Superadmin project setup

Go to **Client Organisations → client → Projects → CRM** beside the project. Select No CRM or
Salesforce. For Salesforce enter the My Domain URL, consumer key and consumer secret, click
Test Connection, then Save CRM Settings.

In Salesforce, create an **External Client App** (or Connected App) with OAuth enabled, scope
`api`, and **Client Credentials Flow** enabled, then set its **Run As** user (OAuth Policies). This
uses client credentials: agents need no Salesforce login, and the service obtains fresh tokens
automatically. Record access follows the Run As user's permissions. The test verifies authorization
and reads of Contact, Account and Task without writing records; it does not prove every write is
permitted for that user.

CRM must read the same admin cluster and `MONGO_ADMIN_DB` as Admin, and use the same stable
`SUPERADMIN_ENCRYPTION_KEY`. A key is required even locally when storing Salesforce secrets. Blank
secrets keep the saved secret; changing the org or consumer key requires a new secret. Secrets are
never returned to the settings UI.

Build `@csa/mongodb`, restart admin and crm, then let the BFF re-poll (or restart it) to compose the
schema. Requests carrying an authenticated client and active project use the saved project setting;
unconfigured projects default to **No CRM** and do not inherit local env credentials. Settings or
database errors never fall back to another org.

Each CRM account (Salesforce org / HubSpot account) can be connected to one project at a time
across clients, enforced by a unique database index. Unlike ticketing, a project keeps only the
credentials of the CRM it currently uses: choosing No CRM or another provider deletes the saved
credentials and releases the account. All records the connected user/key can see are visible to
that project.

## HubSpot setup

In HubSpot: **Development → Keys → Service keys → Create service key** (new accounts no longer offer
private apps; a legacy private app token also works). Scopes: `crm.objects.contacts.read`,
`crm.objects.contacts.write`, `crm.objects.companies.read`, `crm.objects.owners.read`, `sales-email-read`,
and `oauth` if offered (lets CSA read the account ID for "Open in HubSpot" links). In Superadmin choose
HubSpot, paste the key, Test Connection, Save. Each HubSpot account can be connected to one project at a time; choosing No CRM releases it.

## Zoho setup

In the Zoho API console for your region (api-console.zoho.com / .in / .eu …) → **Add Client → Self Client**.
Copy the client ID and secret. Then **Generate Code** with these scopes and a 10-minute duration:
`ZohoCRM.modules.contacts.ALL, ZohoCRM.modules.accounts.READ, ZohoCRM.modules.calls.ALL,
ZohoCRM.modules.tasks.ALL, ZohoCRM.modules.events.READ, ZohoCRM.modules.notes.READ, ZohoCRM.org.READ,
ZohoSearch.securesearch.READ`. In Superadmin choose Zoho CRM, pick the region, paste client ID, secret and
grant code, and **Save** — a grant code works once, so Save exchanges it for a refresh token (stored encrypted)
and checks access; Test Connection works afterwards. Zoho needs a duration (minutes) when logging a call.

## Layout

| Path | Role |
|---|---|
| `src/schema.ts` | GraphQL schema + thin resolvers (`crmProvider`, contacts, accounts, activities) |
| `src/providers/` | `CrmProvider` port and `resolveCrm()` (per-project provider selection) |
| `src/salesforce/` | Salesforce provider: OAuth token cache, REST client, SOQL/SOSL, mappers |
| `src/zoho/` | Zoho provider: token cache, Contacts/Accounts and Calls/Tasks/Events/Notes related lists (v8) |
| `src/hubspot/` | HubSpot provider: contacts/companies/engagements via CRM v3 with a service key |
| `src/crm/types.ts` | Provider-neutral CRM record types |
| `packages/mongodb/src/projects/crm.ts` | Saved settings: validate, encrypt, save, test, resolve |
| `packages/mongodb/src/projects/salesforce.ts` | My Domain validation, credentials, token issue |
| `packages/mongodb/src/projects/zoho.ts` | Zoho regions, grant-code exchange, token refresh, request client |
| `packages/mongodb/src/projects/hubspot.ts` | HubSpot token, account ID lookup, request client |

Adding a CRM: a provider folder implementing `CrmProvider`, a branch in `resolveCrm()`, its fields in
`ProjectCrm`/`prepareCrm`/`testProjectCrm`, and an option in `CrmSettings.tsx`.

## Local Env

Copy `.env.example` to `.env` and set `MONGO_URI`, `MONGO_ADMIN_DB` and `SUPERADMIN_ENCRYPTION_KEY`.

The `CRM_PROVIDER` / `SALESFORCE_*` variables are a development helper for requests **without**
client context (e.g. `curl` straight to :4390, with `CRM_PROJECT_KEY` set); that path is rejected in
production and is never used for Studio requests. Configure the connection in Superadmin for Studio.

```bash
pnpm app:crm dev
pnpm exec vitest run apps/crm packages/mongodb/src/projects/crm.test.ts
```
