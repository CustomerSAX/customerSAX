"use client";

import { AlgoliaSearchInterface, type OrganizationSearchConfig } from "@csa/search";
import { CommercetoolsCatalogProvider } from "../providers/CommercetoolsCatalogProvider";
import type { ProductsProvider } from "../providers/config";

export function ProductListView({
  provider,
  searchConfig
}: {
  provider: ProductsProvider;
  searchConfig?: OrganizationSearchConfig;
}) {
  return provider === "algolia" ? (
    <AlgoliaSearchInterface config={searchConfig} />
  ) : (
    <CommercetoolsCatalogProvider />
  );
}
