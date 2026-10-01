import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../commercetools/client.js", () => ({ commercetoolsGraphql: vi.fn() }));
vi.mock("../../../commercetools/api/index.js", () => ({ getProductByIdOrKey: vi.fn(), listProducts: vi.fn() }));
vi.mock("./product.mapper.js", () => ({ mapProduct: vi.fn() }));

import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { resolvers } from "./product.resolvers.js";

function product(id: number, name = "Unrelated product") {
  return {
    id: String(id),
    key: `product-${id}`,
    masterData: {
      current: {
        nameAllLocales: [{ locale: "en", value: name }],
        descriptionAllLocales: [{ locale: "en", value: "Outdoor equipment" }],
        masterVariant: { sku: `MASTER-${id}` },
        allVariants: [{ sku: `MASTER-${id}` }, { sku: `SECONDARY-${id}` }]
      }
    }
  };
}

function catalog(products: ReturnType<typeof product>[]) {
  vi.mocked(commercetoolsGraphql).mockImplementation(async (_query, variables = {}) => {
    const offset = Number(variables.offset ?? 0);
    const limit = Number(variables.limit ?? 20);
    return { products: { total: products.length, results: products.slice(offset, offset + limit) } };
  });
}

describe("CT product directory search", () => {
  beforeEach(() => vi.resetAllMocks());

  it("finds a partial name beyond the first 50 and 100 products", async () => {
    const products = Array.from({ length: 199 }, (_, index) => product(index));
    products[198] = product(198, "SkyNet Camping Hammock");
    catalog(products);

    const result = await resolvers.productSearch(null, { text: "skyne", field: "allFields" });
    expect(result.total).toBe(1);
    expect(result.results).toEqual([products[198]]);
    expect(vi.mocked(commercetoolsGraphql).mock.calls.map((call) => call[1]?.offset)).toEqual([0, 100]);
  });

  it("paginates matched products and counts matches across the whole catalog", async () => {
    const products = Array.from({ length: 205 }, (_, index) => product(index, index % 2 === 0 ? "SkyNet Hammock" : "Tent"));
    catalog(products);
    const result = await resolvers.productSearch(null, { text: "SKYNE", limit: 20, offset: 40 });
    expect(result.total).toBe(103);
    expect(result.count).toBe(20);
    expect(result.offset).toBe(40);
    expect(result.results).toEqual(products.filter((_, index) => index % 2 === 0).slice(40, 60));
  });

  it("honors the selected field instead of matching an unrelated field", async () => {
    catalog([product(1, "SkyNet Camping Hammock")]);
    expect((await resolvers.productSearch(null, { text: "skyne", field: "description" })).total).toBe(0);
    expect((await resolvers.productSearch(null, { text: "skyne", field: "name" })).total).toBe(1);
    expect((await resolvers.productSearch(null, { text: "product-1", field: "name" })).total).toBe(0);
    expect((await resolvers.productSearch(null, { text: "product-", field: "key" })).total).toBe(1);
  });

  it.each(["allFields", "variants.sku"])("matches partial secondary-variant SKUs through %s", async (field) => {
    catalog([product(1)]);
    const result = await resolvers.productSearch(null, { text: "secondary", field });
    expect(result.total).toBe(1);
  });

  it("returns an empty page with the correct total for an offset beyond matches", async () => {
    catalog([product(1, "SkyNet Hammock")]);
    const result = await resolvers.productSearch(null, { text: "skyne", offset: 20 });
    expect(result).toEqual({ count: 0, offset: 20, results: [], total: 1 });
  });

  it("propagates a later batch failure rather than returning incomplete search results", async () => {
    catalog(Array.from({ length: 199 }, (_, index) => product(index, "SkyNet")));
    vi.mocked(commercetoolsGraphql).mockImplementationOnce(async () => ({
      products: { total: 199, results: Array.from({ length: 100 }, (_, index) => product(index)) }
    })).mockRejectedValueOnce(new Error("CT unavailable"));
    await expect(resolvers.productSearch(null, { text: "skyne" })).rejects.toThrow("CT unavailable");
  });
});

it("filters the full catalog before pagination and retains full facet counts", async () => {
  const products = Array.from({ length: 205 }, (_, index) => {
    const base = product(index, "Chair");
    return { ...base, productType: { id: index >= 195 ? "furniture" : "other", name: "Type" },
      masterData: { current: { ...base.masterData.current,
        categories: [{ id: "chairs", nameAllLocales: [{ locale: "en", value: "Chairs" }] }],
        masterVariant: { sku: `MASTER-${index}`, prices: [{ value: { centAmount: 12500, currencyCode: "USD", fractionDigits: 2 } }], availability: { noChannel: { isOnStock: true } } },
      } } };
  });
  catalog(products);
  const result = await resolvers.productSearch(null, { browse: true, includeFacets: true, filters: { productTypes: ["furniture"], minPrice: 100, maxPrice: 130 }, limit: 2, offset: 5 });
  expect(result.total).toBe(10);
  expect(result.results.map((p) => p.id)).toEqual(["200", "201"]);
  expect(result).toHaveProperty("facets.categories.0.count", 205);
});

it("uses standalone prices in the selected currency for filtering and display", async () => {
  const base = product(1);
  catalog([{ ...base, priceMode: "Standalone" } as ReturnType<typeof product>]);
  const fetchCatalog = vi.mocked(commercetoolsGraphql).getMockImplementation()!;
  vi.mocked(commercetoolsGraphql).mockImplementation(async (query, variables) => {
    if (query.includes("CatalogStandalonePrices")) return { standalonePrices: { results: [
      { value: { centAmount: 500, currencyCode: "EUR", fractionDigits: 2 } },
      { value: { centAmount: 9900, currencyCode: "USD", fractionDigits: 2 } },
    ] } };
    return fetchCatalog(query, variables);
  });
  const result = await resolvers.productSearch(null, { includeFacets: true, currency: "USD", filters: { minPrice: 90, maxPrice: 100 } });
  expect(result.total).toBe(1);
  expect(result.results[0]).toHaveProperty("resolvedPrice.centAmount", 9900);
  expect(result).toHaveProperty("facets.price.min", 99);
});
