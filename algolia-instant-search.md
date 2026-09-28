# Task: Implement Production-Ready Algolia InstantSearch as a Pluggable CSA Search Capability

## Objective

Implement **Algolia InstantSearch as a first-class, production-ready search capability within CSA**.

This should be treated as a real CSA feature that can be used by customers and demonstrated to clients.

**Do NOT refer to this feature anywhere in the UI, code comments, documentation, routes, labels, headings, or user-facing text as:**

- POC
- Proof of Concept
- Test
- Testing
- Demo
- Experimental
- Temporary

The feature should be designed and implemented as a **production-ready CSA capability**.

I currently have an Algolia account with an existing indexed dataset and the required credentials. The current index/data is being used to validate the integration, but **the architecture must be designed for real production product/customer data**.

In the future, I should be able to replace the current Algolia credentials/index with the actual customer/product Algolia configuration without rewriting the search feature.

---

# 1. Add Algolia Search as a CSA Feature

Create a dedicated CSA section for advanced search powered by Algolia.

Suggested name:

**Algolia Search**

Suggested route:

```text
/algolia-search
```

Follow the existing CSA routing and navigation conventions if another route structure is more appropriate.

The page should feel like a natural part of CSA.

Example:

```text
Algolia Search

Fast, intelligent search across your catalog.
```

Do not add any "POC", "test", or "demo" terminology.

---

# 2. Production-Ready Architecture

Algolia must NOT be tightly coupled throughout the CSA application.

Create a clean search-provider abstraction.

Recommended architecture:

```text
CSA
 │
 ├── Search Capability
 │
 ├── Search Contract
 │
 └── Search Provider
       │
       └── Algolia
             │
             └── Algolia InstantSearch
```

The application should communicate with a generic search abstraction rather than directly importing Algolia logic everywhere.

Conceptually:

```text
SearchProvider
    │
    ├── AlgoliaSearchProvider
    │
    └── Future providers
```

Only Algolia needs to be implemented now.

The architecture must make it possible to introduce another provider later without rewriting the search UI or CSA business logic.

---

# 3. Keep Algolia Replaceable and Configurable

The current Algolia account/index is only the initial configuration.

The implementation must make the following configurable:

```text
Application ID
Search-only API Key
Index Name
Search configuration
Facet configuration
Optional sorting/replica indexes
```

For example:

```env
NEXT_PUBLIC_ALGOLIA_APP_ID=
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=
NEXT_PUBLIC_ALGOLIA_INDEX_NAME=
```

Use the project's existing environment-variable naming conventions if appropriate.

Never hard-code credentials.

Only a Search-Only API Key may be exposed to browser-side code.

Never expose an Algolia Admin API Key or other write-capable secret in frontend code.

---

# 4. Organization-Level Configuration Ready

CSA supports multiple organizations/customers.

Therefore the search capability should be designed around organization-level configuration.

Conceptually:

```ts
{
  search: {
    enabled: true,
    provider: "algolia"
  }
}
```

Future configuration could look like:

```ts
{
  search: {
    enabled: false
  }
}
```

or:

```ts
{
  search: {
    enabled: true,
    provider: "backend"
  }
}
```

Do not implement the backend provider now.

The important requirement is that **Algolia is a pluggable provider rather than a mandatory CSA dependency**.

---

# 5. Enable / Disable Search

Provide configuration-driven enable/disable behavior.

When enabled:

```text
Search Provider: Algolia
Status: Connected
```

When disabled:

```text
Search is currently unavailable for this organization.
```

Do not spread:

```ts
if (algoliaEnabled)
```

throughout the application.

The enable/disable decision should be handled at the provider/capability level.

This should allow an organization administrator/configuration system to control whether Algolia Search is available.

---

# 6. Use Algolia InstantSearch

Use the official Algolia React InstantSearch integration appropriate for the existing CSA React/Next.js stack.

Use the current supported Algolia package/version after inspecting the existing project dependencies and compatibility.

The implementation should leverage Algolia InstantSearch for:

- Instant search
- Search state
- Results
- Facets
- Filters
- Highlighting
- Pagination
- Sorting where configured
- Result counts
- Loading states
- No-result states
- Search refinement

Do not implement a custom search engine when Algolia already provides the required functionality.

---

# 7. Dynamic Data Compatibility

The existing Algolia index already contains data, but its schema is currently unknown.

Do not assume that records have fields such as:

```text
name
title
price
category
brand
image
description
```

Inspect the actual indexed data/configuration and build the result rendering to accommodate it.

The search UI should be resilient to different product/catalog schemas.

For example, if records contain:

```json
{
  "objectID": "123",
  "name": "Cabernet Sauvignon",
  "category": "Wine",
  "price": 25
}
```

render those fields appropriately.

If another customer's index contains:

```json
{
  "sku": "ABC-123",
  "productName": "Product A",
  "region": "France"
}
```

the implementation should be adaptable without rewriting the entire search experience.

Create a sensible configurable field-mapping approach where necessary.

---

# 8. Advanced Search Experience

Build a full-featured search interface rather than just a search box.

The experience should include:

## Search Box

Prominent search input with:

- Instant results
- Clear action
- Loading indication
- Keyboard-friendly interaction

Example:

```text
Search products, customers, orders...
```

The placeholder should be configurable according to the search context.

---

## Search Results

Create a polished responsive result layout.

Support:

- Result cards/list
- Highlighted matching text
- Primary result information
- Secondary metadata
- Images when available
- Object ID/SKU where useful
- Responsive behavior

Do not hard-code the result design around one specific dataset.

---

# 9. Faceted Search

Use Algolia facets to provide powerful filtering.

For example, depending on the actual indexed attributes:

```text
Filters

Category
□ Red Wine
□ White Wine
□ Sparkling

Brand
□ Brand A
□ Brand B

Region
□ France
□ Italy
□ Spain
```

Do not hard-code these example values.

Use the actual configured facet attributes available from the index.

The architecture should allow facet configuration such as:

```ts
const searchConfiguration = {
  facets: [
    "category",
    "brand",
    "region"
  ]
};
```

Keep this configurable.

---

# 10. Numeric Filtering

Where the index contains appropriate numeric attributes, support range filtering.

For example:

```text
Price

$0 ───────────── $500
```

Do not assume that the attribute is named `price`.

Make numeric filters configurable based on the search configuration.

---

# 11. Sorting

If the Algolia configuration provides replicas/sort indexes, expose sorting.

Example:

```text
Sort by

Relevance
Price: Low to High
Price: High to Low
```

Only expose sorting options that actually exist in the configured Algolia setup.

Do not create fake sorting behavior on the frontend.

---

# 12. Pagination

Implement production-quality pagination.

Provide:

```text
Previous
1 2 3 4 5
Next
```

or an appropriate pagination component based on the CSA UX conventions.

Make sure pagination state integrates correctly with InstantSearch.

---

# 13. Search State

Search state should properly handle:

- Query
- Filters
- Facets
- Sorting
- Pagination

Where appropriate, support URL synchronization so that a search can be shared/bookmarked.

Follow existing CSA routing conventions before introducing URL state.

---

# 14. Clear Filters

Provide a clear and obvious:

```text
Clear all filters
```

action.

It should reset all active refinements without unnecessarily resetting unrelated search configuration.

---

# 15. Loading / Empty / Error States

Implement polished production-ready states.

### Loading

Use Mantine loading/skeleton components.

### No Results

```text
No results found

Try adjusting your search or removing some filters.
```

### Error

Display a useful error state without exposing technical credentials or internal details.

Example:

```text
Unable to load search results.

Please try again.
```

Provide appropriate logging for developers without exposing sensitive information to users.

---

# 16. Search Provider Status

Include a subtle configuration/status section so administrators/developers can understand which search provider is active.

Example:

```text
Search Configuration

Provider
Algolia

Status
● Connected

Index
products

Search Mode
Instant Search
```

Do not expose API keys.

The actual index name may be shown if appropriate for the CSA administrative context.

---

# 17. Mantine Integration

Use **Mantine** for the CSA UI.

Do not introduce another UI library.

Important architectural principle:

```text
Algolia
=
Search engine + search state

Mantine
=
CSA visual presentation
```

Do not allow Algolia's default visual styling to dictate the CSA design.

The final search experience must visually belong to CSA.

Use Algolia's hooks/connectors where appropriate to power custom Mantine components.

---

# 18. Recommended Component Architecture

Use a structure similar to:

```text
packages/
  search/
    src/
      contracts/
        SearchProvider.ts

      providers/
        algolia/
          AlgoliaSearchProvider.ts
          algoliaClient.ts
          configuration.ts

      components/
        SearchBox.tsx
        SearchResults.tsx
        SearchFilters.tsx
        SearchSort.tsx
        SearchPagination.tsx
        SearchStats.tsx
        SearchEmptyState.tsx
        SearchErrorState.tsx

      config/
        searchConfig.ts
```

Adapt this structure to the existing CSA monorepo instead of blindly creating duplicate package architecture.

If CSA already has a suitable shared package, extend it instead.

---

# 19. Keep Existing CSA Search Untouched

Do not replace or modify existing product search functionality as part of this implementation.

The new Algolia Search capability should be independently accessible.

Once the architecture has been validated and approved, it can potentially be connected to existing CSA product-search experiences later.

For now:

```text
Existing CSA Search
        │
        └── remains unchanged

New Algolia Search
        │
        └── uses new Search Provider abstraction
```

---

# 20. Future Customer Data

The current Algolia account/index is being used as the initial configuration.

The implementation must make it easy to transition to real customer/product data.

For example, later we should be able to change:

```env
NEXT_PUBLIC_ALGOLIA_APP_ID=<customer-app-id>
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=<customer-search-key>
NEXT_PUBLIC_ALGOLIA_INDEX_NAME=<customer-product-index>
```

without changing the search components.

Ideally, organization-specific configuration should eventually resolve:

```text
Organization
     ↓
Search Configuration
     ↓
Algolia Credentials / Index
     ↓
Algolia Search Provider
     ↓
CSA Search UI
```

Do not build a hard-coded Direct Wines or any other customer-specific implementation.

---

# 21. Security

Follow production security practices.

Never:

- commit API keys
- expose Admin API Keys
- expose write credentials
- place secrets directly in components
- log credentials
- log complete sensitive search payloads unnecessarily

Use only credentials appropriate for browser-side search.

---

# 22. Performance

The search experience should feel instantaneous.

Use Algolia InstantSearch capabilities appropriately for:

- Debounced/managed query handling
- Efficient result rendering
- Pagination
- Facet refinement
- Avoiding unnecessary React re-renders

Do not add unnecessary API calls or duplicate search requests.

Follow Next.js/React best practices already used by CSA.

---

# 23. Accessibility

The search experience should be accessible.

Ensure:

- Keyboard navigation
- Accessible labels
- Focus states
- Screen-reader-friendly controls
- Proper button semantics
- Accessible filter controls
- Accessible loading/empty/error states

Use Mantine's accessibility support where available.

---

# 24. Responsive Design

The search experience must work across:

- Desktop
- Tablet
- Mobile

Desktop can use:

```text
┌───────────────┬──────────────────────────┐
│ Filters       │ Search Results           │
│               │                          │
│               │                          │
└───────────────┴──────────────────────────┘
```

Mobile should collapse filters into an appropriate drawer/modal rather than forcing the desktop layout.

---

# 25. Documentation

Add developer documentation explaining:

## Algolia Search

What the feature provides.

## Architecture

```text
CSA
 ↓
Search Capability
 ↓
Search Provider Contract
 ↓
Algolia Provider
 ↓
Algolia InstantSearch
 ↓
Algolia Index
```

## Configuration

Document:

```env
NEXT_PUBLIC_ALGOLIA_APP_ID=
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=
NEXT_PUBLIC_ALGOLIA_INDEX_NAME=
```

without including actual secrets.

## Organization Configuration

Document how the feature can eventually be enabled/disabled per organization.

## Adding Another Provider

Explain how a future provider can implement the same search contract without changing the CSA search UI.

---

# 26. Acceptance Criteria

The feature is complete when:

- [ ] Algolia Search exists as a first-class CSA feature.
- [ ] No user-facing UI/documentation refers to it as POC, test, testing, demo, or experimental.
- [ ] Existing CSA functionality remains unaffected.
- [ ] Algolia credentials are configuration-driven.
- [ ] No secrets are hard-coded.
- [ ] Existing Algolia indexed data can be searched.
- [ ] Instant search works.
- [ ] Results render cleanly.
- [ ] Result highlighting works.
- [ ] Result counts work.
- [ ] Faceted filtering works.
- [ ] Numeric filtering works where applicable.
- [ ] Sorting works where configured.
- [ ] Pagination works.
- [ ] Clear filters works.
- [ ] Loading state works.
- [ ] Empty state works.
- [ ] Error state works.
- [ ] Search state is managed correctly.
- [ ] The UI uses Mantine.
- [ ] The UI follows CSA's existing design language.
- [ ] The feature is responsive.
- [ ] The feature is accessible.
- [ ] Algolia logic is isolated behind a provider abstraction.
- [ ] Algolia can be enabled/disabled through configuration.
- [ ] The architecture supports future organization-specific configuration.
- [ ] Another search provider can be added without rewriting the search UI.
- [ ] The existing CSA Product Search implementation is not broken or replaced.
- [ ] The current Algolia index can later be replaced with real customer/product indexes through configuration.
- [ ] Relevant linting, type-checking, tests, and build validation pass.

---

# 27. Implementation Approach

Before making changes:

1. Inspect the existing CSA monorepo structure.
2. Identify the current routing/navigation architecture.
3. Identify existing shared UI/component packages.
4. Identify the existing organization configuration architecture.
5. Identify any existing search abstractions or product-search functionality.
6. Identify the current Mantine integration.
7. Check existing package/dependency versions.
8. Choose the cleanest location for the new search-provider abstraction.

Then implement the feature using the existing CSA conventions wherever possible.

Do not create unnecessary parallel architecture if an existing CSA abstraction can be extended.

After implementation:

1. Run type checking.
2. Run linting.
3. Run relevant tests.
4. Run the production build.
5. Fix all issues introduced by the implementation.
6. Verify the Algolia Search page works with the configured Algolia index.

Finally provide a concise implementation summary covering:

- Files/modules created or modified
- Search-provider architecture
- Algolia configuration
- Organization-level enable/disable approach
- Supported search capabilities
- Any index/schema-specific configuration required
- How another search provider can be added in the future