"use client";

import { AlgoliaSearchInterface } from "@csa/search";
import { CommercetoolsCatalogProvider } from "../providers/CommercetoolsCatalogProvider";
import type { ProductsProvider } from "../providers/config";

const catalogProviders = {
  commercetools: CommercetoolsCatalogProvider,
  algolia: AlgoliaSearchInterface
};

export function ProductListView({ provider }: { provider: ProductsProvider }) {
  const Provider = catalogProviders[provider];
  return <Provider />;
}
