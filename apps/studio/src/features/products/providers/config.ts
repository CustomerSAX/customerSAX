export type ProductsProvider = "commercetools" | "algolia";

/** Resolve the saved project provider; unconfigured projects use Native. */
export function productsProvider(value: string | undefined): ProductsProvider {
  const provider = value?.trim().toLowerCase() || "commercetools";
  if (provider !== "commercetools" && provider !== "algolia") {
    throw new Error("Products provider must be commercetools or algolia");
  }
  return provider;
}
