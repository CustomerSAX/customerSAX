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
