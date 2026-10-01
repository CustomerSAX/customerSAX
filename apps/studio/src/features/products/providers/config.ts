export type ProductsProvider = "commercetools" | "algolia";

/** Configuration boundary: env today; project settings can supply this later. */
export function productsProvider(value: string | undefined): ProductsProvider {
  const provider = value?.trim().toLowerCase() || "commercetools";
  if (provider !== "commercetools" && provider !== "algolia") {
    throw new Error("PRODUCTS_PROVIDER must be commercetools or algolia");
  }
  return provider;
}
