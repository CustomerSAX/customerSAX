import { describe, expect, it } from "vitest";
import { ctCatalogItem } from "./commercetools-mapper";
import type { ProductListRow } from "../types/product-types";

const row: ProductListRow = {
  id: "ct-123",
  imageUrl: "https://example.test/chair.jpg",
  itemName: "Chair",
  productType: "Furniture",
  key: "chair",
  sku: "CHAIR-1",
  price: "€12,34",
  priceValue: { centAmount: 1234, fractionDigits: 2, currencyCode: "EUR" },
  availability: "In stock",
  description: "Oak chair",
  categories: "Dining",
  status: "Published",
  created: "",
  modified: "",
  variants: [{ id: "1", sku: "CHAIR-1", key: "chair" }],
  variantCount: 1
};

describe("CT catalog presentation mapping", () => {
  it("maps CT to the shared model using numeric money, not a formatted price string", () => {
    expect(ctCatalogItem(row)).toMatchObject({
      id: "ct-123",
      title: "Chair",
      category: "Furniture",
      price: 12.34,
      currency: "EUR",
      inStock: true,
      raw: { variantCount: 1, skus: ["CHAIR-1"] }
    });
  });
  it("preserves unknown price and inventory rather than manufacturing values", () => {
    expect(
      ctCatalogItem({ ...row, priceValue: null, availability: "--", description: "--" })
    ).toMatchObject({
      price: undefined,
      inStock: undefined,
      stockStatus: undefined,
      description: undefined
    });
  });
});
