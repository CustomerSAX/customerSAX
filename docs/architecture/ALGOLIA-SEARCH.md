# Algolia Search Capability Architecture

## 1. Overview

The **Algolia Search** capability provides high-performance, intelligent catalog search within the Customer Service Accelerator (CSA). Built on top of official Algolia React InstantSearch and rendered using CSA's design system (`@csa/ui`), it delivers instant query execution, multifaceted filtering, numeric ranges, highlighting, and dynamic schema resilience without hardcoding customer data structures or leaking credentials.

The feature is decoupled from CSA's core commerce layers through a provider-contract abstraction (`@csa/search`), ensuring Algolia acts as a pluggable search provider rather than a hardwired application dependency.

---

## 2. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph CSA Studio ["CSA Studio Application"]
        Page["/algolia-search Page"]
        View["AlgoliaSearchView"]
    end

    subgraph CSA Search Package ["@csa/search"]
        Interface["AlgoliaSearchInterface"]
        Capability["Search Capability Abstraction\n(OrganizationSearchConfig)"]
        Registry["SearchProviderRegistry"]
        Contract["ISearchProvider Contract"]
        Provider["AlgoliaSearchProvider"]
        Client["Cached Algolia LiteClient"]
        Components["InstantSearch Components\n(SearchBox, SearchFilters, SearchResults, etc.)"]
    end

    subgraph Algolia Cloud ["Algolia Cloud Engine"]
        API["Algolia Search API"]
        Index["Configured Product Index"]
    end

    Page --> View
    View --> Interface
    Interface --> Capability
    Capability --> Registry
    Registry --> Contract
    Contract --> Provider
    Provider --> Client
    Interface --> Components
    Components --> Client
    Client --> API
    API --> Index
```

---

## 3. Core Principles

1. **Pluggable & Replaceable**: The search capability communicates exclusively through the `ISearchProvider` interface. Algolia is the default initial provider, but additional providers (e.g. backend Elasticsearch, OpenSearch, etc.) can be introduced seamlessly.
2. **Strict Credential Isolation**: Only the search-only API key is exposed to the browser (`NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`). Write keys and admin credentials are strictly forbidden in client-side code and runtime bundles.
3. **Dynamic Schema Compatibility**: Hits and catalog attributes are normalized through a resilient field-mapping layer (`normalizeSearchResultItem`), enabling instant compatibility with diverse customer product schemas (e.g. `title` vs. `name` vs. `productName`).
4. **Organization-Level Multi-Tenancy**: The search capability can be enabled, disabled, or configured on an organization/tenant level via `OrganizationSearchConfig`.
5. **No Interference with Existing Workflows**: CSA's native Commercetools product catalog and existing search implementations remain completely intact.

---

## 4. Configuration

### Environment Variables

Search settings are driven by environment variables:

```env
# Algolia Search Capability (Browser-accessible)
NEXT_PUBLIC_ALGOLIA_APP_ID=
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=
NEXT_PUBLIC_ALGOLIA_INDEX_NAME=
```

> [!IMPORTANT]
> Never commit actual API keys or configure write/admin keys in `NEXT_PUBLIC_*` variables. Only Search-Only API Keys must be used in frontend configurations.

### Organization Configuration Schema

Tenant-specific search behavior can be configured programmatically using `OrganizationSearchConfig`:

```typescript
export interface OrganizationSearchConfig {
  /** Whether search capability is enabled for this organization */
  enabled: boolean;
  /** Active provider identifier, e.g. "algolia" */
  provider: 'algolia' | string;
  /** Primary index to search */
  indexName?: string;
  /** Application ID for search engine */
  appId?: string;
  /** Public search-only API key */
  searchApiKey?: string;
  /** User-friendly search box placeholder text */
  placeholder?: string;
  /** Configured facets for filtering */
  facets?: SearchFacetConfig[];
  /** Configured numeric filters */
  numericFilters?: SearchNumericFilterConfig[];
  /** Configured sort/replica options */
  sortOptions?: SearchSortOption[];
  /** Schema field mapping to normalize hit records */
  fieldMapping?: SearchFieldMapping;
}
```

### Enabling and Disabling Search

When search is disabled for an organization:
```typescript
const orgConfig: OrganizationSearchConfig = {
  enabled: false,
  provider: 'algolia'
};
```
The search UI automatically renders a message stating:
> *"Search is currently unavailable for this organization."*

When enabled and connected, the search interface displays a status indicator displaying the active provider, status, and target index.

---

## 5. Adding Another Search Provider

To add an alternative provider in the future (such as a backend search service or Elasticsearch), follow these steps:

1. **Implement `ISearchProvider`**:
   ```typescript
   import { ISearchProvider, SearchCapabilityState, OrganizationSearchConfig } from '@csa/search';

   export class CustomSearchProvider implements ISearchProvider {
     public readonly id = 'custom';
     public readonly name = 'Custom Search';

     public initialize(config: OrganizationSearchConfig): void {
       // initialize client with config
     }

     public getStatus(): SearchCapabilityState {
       return {
         enabled: true,
         providerId: this.id,
         providerName: this.name,
         status: 'connected',
         searchMode: 'Custom Search'
       };
     }

     public getClient() {
       return this.client;
     }
   }
   ```

2. **Register the Provider**:
   ```typescript
   import { SearchProviderRegistry } from '@csa/search';

   SearchProviderRegistry.getInstance().register(new CustomSearchProvider());
   ```

3. **Switch Organization Configuration**:
   Update the organization's search configuration:
   ```typescript
   {
     enabled: true,
     provider: 'custom'
   }
   ```
   The CSA search UI will interact through the unified contract without requiring UI rewrites.

## Server-side connection-hub transport

Studio can use either a local Hub or its deployed Cloud Run service. These are server-only settings in `apps/studio/.env`:

```dotenv
CONNECTION_HUB_ENABLED=true
USE_CONNECTION_HUB_PROD=true
CONNECTION_HUB_PROD_URL=https://csa-production-connection-hub-17754871169.us-central1.run.app
CONNECTION_HUB_PROD_API_KEY=<production Hub execution API_KEY>
CONNECTION_HUB_CLIENT_ID=<authenticated CSA activeClientId>
CONNECTION_HUB_PROD_TENANT_ID=<Hub runtime TENANT_ID>
```

`USE_CONNECTION_HUB_PROD=false` selects the existing `CONNECTION_HUB_URL` and `CONNECTION_HUB_API_KEY`; `true` selects only the production URL and key. Missing production settings fail closed and never fall back to localhost or its credentials. An unbound project in production mode returns a configuration error rather than silently selecting another product provider. `CONNECTION_HUB_ENABLED=false` disables the integration. Restart Studio after changing these values. Keep keys out of `NEXT_PUBLIC_*` variables. These settings currently apply to Studio's Products and Teams transports, not the ticketing service or AI-assist MCP integration.

The key is Hub's REST execution `API_KEY`, not an MCP client token, administrator key or Algolia key. Hub must already have a live Algolia connection and approved `search-products` / `browse-records` bindings for the selected project. MCP account grants do not create REST project bindings. The deployed application ID `connection-hub` and legacy `customersax` are both accepted; authorization still validates tenant and project for bindings and execution results.

`CONNECTION_HUB_CLIENT_ID` restricts which authenticated CSA client can use this integration. `CONNECTION_HUB_PROD_TENANT_ID` identifies its Hub workspace; when omitted it defaults to the CSA client ID. Local mode supports a separate optional `CONNECTION_HUB_TENANT_ID`. The browser cannot select any of these values or override its session's project. Do not map multiple CSA clients onto this single-client configuration.

For private Cloud Run, Studio uses Google Application Default Credentials to obtain and refresh an ID token with the Hub service origin as its audience. It sends the ID token in `X-Serverless-Authorization` and the Hub execution key in `Authorization`. The Google principal needs `roles/run.invoker` on the Hub service. No service IAM or cloud environment settings are changed by this code.

For local development, configure an impersonated service account that can invoke Hub:

```bash
gcloud auth application-default login --impersonate-service-account=YOUR_HUB_INVOKER_SERVICE_ACCOUNT
```

Your user needs permission to impersonate that account. Ordinary user ADC alone may not support ID-token minting. On Cloud Run, ADC uses the attached runtime service account. On Vercel, configure a supported workload identity credential source; local ADC is not automatically available in a Vercel deployment. The flag does not create credentials, IAM grants, production connections or bindings. See [Google's local ADC setup](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment) and [Cloud Run service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).

Verify a real bound project through Products after switching. A successful test must return live provider data with the configured Hub tenant and authenticated selected project. Missing credentials, Google/Hub authorization failures, mismatched scopes and simulated responses remain errors. The automated tests use synthetic responses and cannot establish production connectivity.

The Products page can use connection-hub for the authenticated selected project within the configured CustomerSax client. Studio verifies the session and active project before calling the connector service. The browser calls `POST /api/connection-hub/products`; the server calls connection-hub's `search-products` action for a query and `browse-records` for an empty query. API keys and Algolia credentials remain server-side.

Add these to `apps/studio/.env.local` (never use `NEXT_PUBLIC_`):

```dotenv
CONNECTION_HUB_ENABLED=true
CONNECTION_HUB_URL=http://127.0.0.1:3100
CONNECTION_HUB_API_KEY=<same API_KEY as connection-hub>
CONNECTION_HUB_CLIENT_ID=<authenticated activeClientId>
```

Use `activeClientId` from the authenticated `/api/auth/me` response for the client ID. The project key is read automatically from the authenticated session updated by the project dropdown; do not set `CONNECTION_HUB_PROJECT_KEY`. The selected project's saved Products configuration must use Algolia with the application ID and index configured in connection-hub. Studio passes those settings as an expected binding; connection-hub rejects a mismatch before executing an action. Restart Studio after changing environment variables. Keep connection-hub running in `EXECUTION_MODE=live` with the intended Algolia index and credentials. Studio rejects simulated provider results. Open Products and search as you type, with the search button, or Enter. With no query it browses up to 20 records; searches show up to 20 matches and the provider's total. Browse does not claim an exact catalog total. Facets, replica sorting and further pages are not implemented by this connector transport. Projects using Native commerce and clients outside the configured client continue using their existing provider. Switching the dropdown reloads the page using the new session project; the browser cannot override the project in a search request.

Errors render in the catalog with retry. Missing sessions, mismatched projects, invalid inputs, upstream failures and malformed results fail closed. The client restriction and saved project configuration protect the current single-catalog connection-hub service; expand connection-hub's connection/binding model before enabling additional tenants.

## Connection-hub project bindings

When `CONNECTION_HUB_ENABLED=true`, Studio checks connection-hub for the authenticated session's selected project. Projects with saved `search-products` or `browse-records` bindings use the server-side connector transport; unbound projects retain the existing provider. Disabled bindings still select the connector transport so disabling an action cannot silently bypass it through direct Algolia.

Studio uses `CONNECTION_HUB_URL`, `CONNECTION_HUB_API_KEY` and `CONNECTION_HUB_CLIENT_ID` only on the server. The session supplies the project key; the browser supplies only query and limit. `POST /api/connection-hub/products` calls `POST /v1/projects/<selected-project>/actions/search-products` or `browse-records`. Connection-hub resolves the saved connection, allowed index, approved release and digest, and snapshots the binding revision before execution. Provider credentials and package selection are owned by connection-hub and never supplied by Studio.

Run connection-hub's `npm run setup:control-plane`, restart it, then `npm run activate -- b2c-csa` to approve the current build and register the existing Algolia credentials and project bindings. This is an explicit activation; changing environment credentials alone does not update a saved connection. Keep its encryption key stable across restarts. The admin API supports deliberate promotion, disabling and connection revocation. See connection-hub's README for endpoint contracts and local SQLite limitations.
