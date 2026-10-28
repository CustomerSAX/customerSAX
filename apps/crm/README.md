# CRM service

CRM workspace providers are selected exclusively from enabled Connection Hub
project bindings. The service never decrypts project CRM credentials or selects
an external provider from `CRM_PROVIDER`/Salesforce/HubSpot/Zoho environment keys.

Connect one Salesforce, HubSpot or Zoho CRM account in Connection Hub and enable
its Custom API Call action to use contact/account/activity workspace operations.
All calls are restricted by Hub's provider policy and the selected project binding.
Disabled actions, mixed accounts and multiple selected CRM providers report explicit
configuration errors. Removing the connector leaves the project with no CRM.

Existing provider mappers and workspace contracts are retained. Salesforce search
uses SOQL rather than SOSL to match Hub's approved query endpoint. HubSpot portal
and Zoho organization links are absent when their metadata is not supplied by Hub.
The Zoho workspace's search and related lists require the accompanying Hub policy
change. No live provider writes are performed by unit tests.

Cloud deployment supplies the central `CONNECTION_HUB_PLATFORM_CONFIG` secret;
there is no per-connector service configuration. See
[the platform migration](../../docs/architecture/CONNECTION-HUB-MIGRATION.md).
Commerce, native AI/SMTP/SSO and historical encrypted records remain intact.

```sh
pnpm --filter @csa/crm typecheck
pnpm exec vitest run apps/crm/src
```
