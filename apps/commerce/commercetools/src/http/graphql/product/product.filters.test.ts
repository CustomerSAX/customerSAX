import { describe, expect, it } from "vitest";
import { catalogFacets, matchesCatalogFilters, selectCatalogPrice, type FilterableProduct } from "./product.filters.js";

const chair: FilterableProduct = {
  productType: { id: "furniture", name: "Furniture" },
  resolvedPrice: { centAmount: 12500, currencyCode: "USD", fractionDigits: 2 },
  masterData: { current: {
    categories: [{ id: "chairs", nameAllLocales: [{ locale: "en", value: "Chairs" }] }],
    masterVariant: { availability: { noChannel: { isOnStock: true } } },
  } },
};

describe("CT catalog filters", () => {
  it("combines groups with AND and options within a group with OR", () => {
    expect(matchesCatalogFilters(chair, { productTypes: ["clothes", "furniture"], categoryIds: ["chairs"], availability: ["inStock"], minPrice: 100, maxPrice: 150 })).toBe(true);
    expect(matchesCatalogFilters(chair, { productTypes: ["furniture"], categoryIds: ["beds"] })).toBe(false);
    expect(matchesCatalogFilters(chair, { availability: ["outOfStock"] })).toBe(false);
  });
  it("includes price boundaries and excludes unknown prices from price filters", () => {
    expect(matchesCatalogFilters(chair, { minPrice: 125, maxPrice: 125 })).toBe(true);
    expect(matchesCatalogFilters(chair, { maxPrice: 124.99 })).toBe(false);
    expect(matchesCatalogFilters({ ...chair, resolvedPrice: null }, { minPrice: 0 })).toBe(false);
    expect(matchesCatalogFilters({ ...chair, resolvedPrice: null }, {})).toBe(true);
  });
  it("does not label unknown inventory as out of stock", () => {
    expect(matchesCatalogFilters({}, { availability: ["unknown"] })).toBe(true);
    expect(matchesCatalogFilters({}, { availability: ["outOfStock"] })).toBe(false);
  });
  it("builds distinct facet values and price bounds", () => {
    const facets = catalogFacets([chair, chair, {}], "en", "USD");
    expect(facets.productTypes).toEqual([{ value: "furniture", label: "Furniture", count: 2 }]);
    expect(facets.categories).toEqual([{ value: "chairs", label: "Chairs", count: 2 }]);
    expect(facets.availability).toEqual({ inStock: 2, outOfStock: 0, unknown: 1 });
    expect(facets.price).toEqual({ min: 125, max: 125, currency: "USD" });
  });
  it("selects the lowest price in the requested (non-USD) currency", () => {
    const aud = { centAmount: 6000, currencyCode: "AUD", fractionDigits: 2 };
    const audLow = { centAmount: 4500, currencyCode: "AUD", fractionDigits: 2 };
    const eur = { centAmount: 100, currencyCode: "EUR", fractionDigits: 2 };
    expect(selectCatalogPrice([aud, eur, audLow], "AUD")).toEqual(audLow);
    expect(selectCatalogPrice([aud], "USD")).toBeNull();
    expect(selectCatalogPrice([], "AUD")).toBeNull();
  });
  it("falls back to the product's own first price currency when none is resolvable", () => {
    const aud = { centAmount: 6000, currencyCode: "AUD", fractionDigits: 2 };
    const eur = { centAmount: 100, currencyCode: "EUR", fractionDigits: 2 };
    expect(selectCatalogPrice([aud, eur], undefined)).toEqual(aud);
    expect(selectCatalogPrice([], undefined)).toBeNull();
  });
});
