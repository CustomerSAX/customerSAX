export type ProductsProvider = "commercetools" | "algolia";

/** Environment fallback for projects without saved Products settings. */
export function productsProvider(value: string | undefined): ProductsProvider {
  const provider = value?.trim().toLowerCase() || "commercetools";
  if (provider !== "commercetools" && provider !== "algolia") {
    throw new Error("PRODUCTS_PROVIDER must be commercetools or algolia");
  }
  return provider;
}
