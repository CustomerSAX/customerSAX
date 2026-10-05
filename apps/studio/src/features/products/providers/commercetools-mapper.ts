import type { NormalizedSearchResultItem } from "@csa/search";
import type { ProductListRow } from "../types/product-types";

/** Convert CT catalog data to the same presentation model used by Algolia. */
export function ctCatalogItem(row: ProductListRow): NormalizedSearchResultItem {
  const present = (value: string) => (value && value !== "--" ? value : undefined);
  const money = row.priceValue;
  return {
    id: row.id,
    title: row.itemName,
    sku: present(row.sku),
    description: present(row.description),
    category: present(row.productType),
    imageUrl: row.imageUrl || undefined,
    price: money ? money.centAmount / 10 ** money.fractionDigits : undefined,
    currency: money?.currencyCode,
    stockStatus: present(row.availability),
    inStock: row.availability === "--" ? undefined : row.availability === "In stock",
    raw: {
      objectID: row.id,
      id: row.id,
      sku: present(row.sku),
      variantCount: row.variantCount,
      skus: row.variants
        .map((variant) => variant.sku)
        .filter((sku) => sku && sku !== "--"),
      categories: present(row.categories)
    }
  };
}
