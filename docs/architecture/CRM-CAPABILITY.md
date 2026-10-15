# CRM Capability — Design & Implementation

> **Status:** implemented on branch `feature/crm-capability` (uncommitted). Follows the **ticketing provider
> model** (`apps/ticketing`, Zendesk/Freshdesk) one-for-one: same storage, admin API shape, service layout and
> Superadmin UI. **Source proposal:** *Evolving CustomerSAX into a Composable Customer Service Platform*.

## 1. Goal

Each client project chooses **which CRM** serves it — Salesforce first — in Superadmin, exactly as it chooses
Native / Zendesk / Freshdesk for ticketing. Agents and the AI assistant then see that CRM's contacts, accounts
and activity through one provider-neutral API. CSA does not hold CRM data; it reads and writes the client's CRM.

## 2. How it mirrors ticketing

| Concern | Ticketing | CRM |
|---|---|---|
| Saved per project | `csa_projects.ticketing` sub-document | `csa_projects.crm` sub-document |
| Providers | `internal` (default), `zendesk`, `freshdesk` | `none` (default), `salesforce`, `hubspot`, `zoho` |
| Settings logic (`@csa/mongodb`) | `projects/ticketing.ts`, `projects/freshdesk.ts` | `projects/crm.ts`, `projects/salesforce.ts`, `projects/hubspot.ts`, `projects/zoho.ts` |
| Validate / encrypt / save | `prepareTicketing`, `saveProjectTicketing` | `prepareCrm`, `saveProjectCrm` |
| Connection test | `testProjectTicketing` (read-only calls) | `testProjectCrm` (read-only Contact/Account/Task queries) |
| Per-request resolution | `resolveProjectTicketing` → `resolveTicketing()` | `resolveProjectCrm` → `resolveCrm()` |
| One account per project | unique index on `ticketing.subdomain` / `freshdeskDomain` | unique index on `crm.salesforceInstanceUrl` / `hubspotPortalId` / `zohoOrgId` (released on disconnect) |
| Service | `apps/ticketing` (:4350): `providers/`, `zendesk/`, `freshdesk/` | `apps/crm` (:4390): `providers/`, `salesforce/`, `hubspot/`, `zoho/` |
| Port | `TicketingProvider` | `CrmProvider` |
| OAuth token cache | `zendesk/project-client.ts` | `salesforce/project-client.ts` |
| Admin API (superadmin-only) | `adminProjectTicketing`, `adminSaveProjectTicketing`, `adminTestProjectTicketing` | `adminProjectCrm`, `adminSaveProjectCrm`, `adminTestProjectCrm` |
| Project list field | `AdminProject.ticketingProvider` | `AdminProject.crmProvider` |
| Superadmin UI | Projects table "Ticketing" column + button → `TicketingSettings.tsx` | "CRM" column + button → `CrmSettings.tsx` |
| Dev-only env path | `TICKETING_PROVIDER` for requests without client | `CRM_PROVIDER` + `SALESFORCE_*` for requests without client |

Only intentional difference: ticketing's default is a working **native** store; there is no native CSA CRM,
so the CRM default is **`none`** and every CRM query then returns *"No CRM is connected for this project"*
(code `CRM_NOT_CONFIGURED`) rather than any substitute data.

## 3. Request flow

```
Studio / AI Assist ──► BFF (:4000) ──► crm subgraph (:4390)
                                         schema.ts  selectedProvider(context)
                                         providers/index.ts  resolveCrm(projectKey, clientId)
                                            └─ @csa/mongodb resolveProjectCrm → csa_projects.crm
                                         salesforce/provider.ts  ──► client's Salesforce org (REST, SOQL/SOSL)
```

- Client context present → the saved project setting decides; no env fallback, no cross-project fallback.
- No client context → development only (`CRM_PROVIDER`); rejected in production.

## 4. Superadmin setup (the UI)

**Client Organisations → client → Projects tab → CRM** (button beside **Ticketing**):

1. Provider: **No CRM** or **Salesforce**.
2. Salesforce: **My Domain URL** (`https://<domain>.my.salesforce.com`), **Consumer key**, **Consumer secret**.
3. **Test Connection** — real token request plus read-only Contact/Account/Task queries; writes nothing.
4. **Save CRM Settings** — the secret is encrypted with `SUPERADMIN_ENCRYPTION_KEY`; blank keeps the saved secret;
   changing the org or consumer key requires re-entering it. The table's **CRM** column then shows "Salesforce".

## 5. GraphQL (crm subgraph)

| Field | Purpose |
|---|---|
| `crmProvider: String!` | `"none"` or `"salesforce"` for the active project |
| `crmContact(id)`, `crmContactByEmail(email)` | single contact; `null` if not found |
| `searchCrmContacts(text, limit, offset)` | free-text search (`total` null when Salesforce can't report it) |
| `crmAccount(id)` | the contact's company |
| `crmContactActivities(contactId, limit)` | calls / emails / tasks / meetings, newest first |
| `updateCrmContact(id, input)`, `logCrmActivity(input)` | writes; require a writer role (`agent`/`admin`/`superadmin`) |

Types are `Crm`-prefixed (`CrmContact`, `CrmAccount`, `CrmActivity`…) so they never collide with the commerce
subgraph's `Customer` in the federated schema. A CRM contact and a commerce customer are linked by email.

## 6. Salesforce provider

- **Auth:** OAuth 2.0 client-credentials against the My Domain URL; tokens cached in-process (20 min) and
  re-issued once on HTTP 401.
- **Mapping:** Contact ↔ `CrmContact`; Account ↔ `CrmAccount`; Task (`TaskSubtype` Call/Email/Task) and Event
  (meetings, read-only) ↔ `CrmActivity`; `externalUrl` deep-links to the Lightning record.
- **Safety:** all input escaped for SOQL/SOSL, IDs validated (15/18 alphanumerics) before use, API paths
  allow-listed, vendor error bodies never echoed (only the Salesforce error code).
- **Not yet:** logging meetings, opportunities, cases, custom fields.

## 6b. HubSpot provider

- **Auth:** a HubSpot **service key** (Development → Keys → Service keys; new accounts no longer offer private
  apps) or a legacy private-app token, sent as `Authorization: Bearer`. Stored encrypted; never shown again.
- **Account ID:** looked up on save via the token-info endpoint, then account-info (`oauth` scope). If HubSpot
  reports neither, the CRM still works but "Open in HubSpot" links stay empty — never guessed.
- **Mapping:** contacts ↔ `CrmContact` (primary company association), companies ↔ `CrmAccount`, calls / emails /
  meetings / tasks / notes ↔ `CrmActivity` (task completion from `hs_task_status`; HTML bodies shown as text).
- **Rate limits:** activity history uses one contact read with associations plus one batch read per activity type,
  not the search API (5 requests/second).
- **Test Connection:** read-only probes per scope; a failure names the exact missing scope.

## 6c. Zoho CRM provider

- **Auth:** Self Client (client ID + secret). A one-time **grant code** is exchanged on Save for a refresh token
  (stored encrypted); one-hour access tokens are cached and re-issued from it. Tokens are region-specific (US, EU,
  IN, AU, JP, CN, CA, SA). The grant code itself is never stored, so Test Connection only works after a Save.
- **Mapping:** Contacts ↔ `CrmContact` (Account_Name lookup), Accounts ↔ `CrmAccount`, the contact's Calls /
  Tasks / Events / Notes related lists ↔ `CrmActivity`. Record links use the org `domain_name` read on save.
- **Writes:** calls are logged as Outbound / Completed and need a **duration** (CSA asks rather than inventing one);
  tasks can be open or done. Emails and meetings cannot be logged yet.

## 7. AI Assist

`apps/ai-assist/src/chat/tools/crm.ts`: `find_crm_contact`, `get_crm_contact_details` (reads,
`canViewCustomers`) and `log_crm_activity`, `update_crm_contact` (writes, `canUpdateCustomers` + approval gate).
The system prompt's CRM playbook tells the model to say "No CRM is connected" plainly when the project has none.

## 8. Security notes

Same model and same known gaps as ticketing/all subgraphs: identity comes from BFF-forwarded `x-csa-*` headers
(SECURITY-TENANCY.md); the CRM service must stay private behind the BFF. Salesforce record access is bounded by
the app's **Run As** user — give it only the objects CSA needs.

## 9. Adding another CRM (e.g. HubSpot)

1. `apps/crm/src/hubspot/` implementing `CrmProvider` (+ tests).
2. `ProjectCrm` fields, `prepareCrm` validation and `testProjectCrm` branch in `packages/mongodb/src/projects/crm.ts`
   (+ a `hubspot.ts` helper like `salesforce.ts`).
3. A branch in `resolveCrm()` and in `AdminProjectCrm`/`AdminProjectCrmInput`.
4. An option + fields in `CrmSettings.tsx` and the CRM column label.

## 10. Local setup & verification

`apps/crm/.env` (copy `.env.example`): `MONGO_URI`, `MONGO_ADMIN_DB`, `SUPERADMIN_ENCRYPTION_KEY` — **the same
values as `apps/admin/.env`**. Then `pnpm dev:studio` (now includes `@csa/crm`) and configure via Superadmin.

Getting a Salesforce test org: free Developer Edition (<https://developer.salesforce.com/signup>) → Setup →
External Client App Manager → new app with OAuth scope `api` + Client Credentials Flow → Policies: Run As user →
Settings: Consumer Key and Secret.

Verified so far: all touched packages typecheck (crm, admin, ai-assist, bff, studio); 66 tests pass (incl.
existing ticketing tests); live read-only check — admin lists real projects with `crmProvider: "none"` and
`adminProjectCrm` reads back defaults; earlier, the real Salesforce OAuth endpoint rejected deliberately invalid
credentials with its own error. **Not yet verified:** Save/Test against a real Salesforce org, the Superadmin
panel in a browser, and the AI tools against real Salesforce records.
