"use client";

import { AlgoliaSearchInterface, type OrganizationSearchConfig } from "@csa/search";
import { CommercetoolsCatalogProvider } from "../providers/CommercetoolsCatalogProvider";
import { ConnectionHubCatalogProvider } from "../providers/ConnectionHubCatalogProvider";
import type { ProductsProvider } from "../providers/config";

export function ProductListView({
  provider,
  searchConfig,
  connectionHubEnabled = false
}: {
  provider: ProductsProvider;
  searchConfig?: OrganizationSearchConfig;
  connectionHubEnabled?: boolean;
}) {
  if (connectionHubEnabled) return <ConnectionHubCatalogProvider />;
  return provider === "algolia" ? (
    <AlgoliaSearchInterface config={searchConfig} />
  ) : (
    <CommercetoolsCatalogProvider />
  );
}
