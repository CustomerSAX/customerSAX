import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { mapProduct } from "./product.mapper.js";
import type { CtProduct } from "../../../commercetools/types.js";
import { getProductByIdOrKey, listProducts } from "../../../commercetools/api/index.js";
import { escapeWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";
import { catalogFacets, matchesCatalogFilters, type CatalogMoney, type FilterableProduct } from "./product.filters.js";
import type { ProductSearchArgs } from "./product.types.js";

// Minimal fields for the basic Product contract type (quickSearch, product resolver).
const productFields = `#graphql
  id
  key
  masterData {
    current {
      nameAllLocales { value }
      descriptionAllLocales { value }
      slugAllLocales { value }
      masterVariant {
        sku
        images { url }
        prices { value { centAmount currencyCode fractionDigits } }
      }
    }
  }
`;

// Rich fields for the Product Directory list — includes all 12 manageable columns.
// Returned as Json! so the contract type doesn't need to change.
const richProductListFields = `#graphql
  id
  key
  createdAt
  lastModifiedAt
  taxCategory { name }
  priceMode
  productType { id name }
  masterData {
    hasStagedChanges
    current {
      nameAllLocales { locale value }
      descriptionAllLocales { locale value }
      slugAllLocales { locale value }
      categories {
        id
        nameAllLocales { locale value }
        ancestors { id nameAllLocales { locale value } }
      }
      masterVariant {
        id
        sku
        key
        images { url }
        prices { value { centAmount currencyCode fractionDigits } }
        availability {
          noChannel { isOnStock availableQuantity }
        }
      }
      allVariants {
        id
        sku
        key
        images { url }
        prices { value { centAmount currencyCode fractionDigits } }
        availability {
          noChannel { isOnStock availableQuantity }
        }
      }
    }
  }
`;

// Full detail fields for the Product Detail page — includes priceMode, taxCategory,
// categories with full ancestor chain, and all variant inventory data.
const richProductDetailFields = `#graphql
  id
  key
  priceMode
  taxCategory { name }
  masterData {
    current {
      nameAllLocales { locale value }
      descriptionAllLocales { locale value }
      categories {
        id
        nameAllLocales { locale value }
        ancestors { id nameAllLocales { locale value } }
      }
      masterVariant {
        id
        sku
        key
        images { url }
        prices { value { centAmount currencyCode fractionDigits } }
        availability {
          noChannel { isOnStock availableQuantity }
        }
      }
      allVariants {
        id
        sku
        key
        images { url }
        prices { value { centAmount currencyCode fractionDigits } }
        availability {
          noChannel { isOnStock availableQuantity }
        }
      }
    }
  }
`;

export const resolvers = {
  availableCurrencies: async () => {
    const data = await commercetoolsGraphql<{ project: { currencies?: string[] } }>(
      `#graphql
        query AvailableCurrencies {
          project { currencies }
        }
      `
    );
    return data.project.currencies ?? [];
  },
  product: (_parent: unknown, args: { id?: string; key?: string }) => getProductByIdOrKey(args),
  products: async (_parent: unknown, args: PagingArgs) => {
    const productPage = await listProducts(args);

    return productPage.results;
  },
  productPage: (_parent: unknown, args: PagingArgs) => listProducts(args),
  productBySlug: async (_parent: unknown, args: { locale?: string; slug: string }) => {
    const locale = normalizeLocale(args.locale);
    const where = `masterData(current(slug(${locale}="${escapeWhere(args.slug)}")))`;
    const data = await commercetoolsGraphql<{ products: { results: CtProduct[] } }>(
      `#graphql
        query ProductBySlug($where: String!) {
          products(where: $where, limit: 1) {
            results { ${productFields} }
          }
        }
      `,
      { where }
    );

    return mapProduct(data.products.results[0]);
  },
  productPrices: async (_parent: unknown, args: { sku: string }) => {
    const sku = args.sku.trim();
    if (!sku) return [];

    const data = await commercetoolsGraphql<{
      products: {
        results: Array<{
          masterData?: {
            current?: {
              allVariants?: Array<{ sku?: string; prices?: Array<{ value: { centAmount: number; currencyCode: string; fractionDigits: number } }> }>;
              masterVariant?: { sku?: string; prices?: Array<{ value: { centAmount: number; currencyCode: string; fractionDigits: number } }> };
            };
          };
        }>;
      };
    }>(
      `#graphql
        query ProductPrices($where: String!) {
          products(where: $where, limit: 1) {
            results {
              masterData {
                current {
                  masterVariant { sku prices { value { centAmount currencyCode fractionDigits } } }
                  allVariants { sku prices { value { centAmount currencyCode fractionDigits } } }
                }
              }
            }
          }
        }
      `,
      { where: productExactWhere("variants.sku", escapeWhere(sku)) }
    );

    const current = data.products.results[0]?.masterData?.current;
    const variant = [current?.masterVariant, ...(current?.allVariants ?? [])].find(
      (candidate) => candidate?.sku === sku
    );
    return variant?.prices?.map((price) => price.value) ?? [];
  },
  // productSearch uses richProductListFields so it returns all 12 column data as Json!
  productSearch: async (_parent: unknown, args: ProductSearchArgs) => {
    const { limit, offset } = paging(args);
    const text = args.text?.trim();

    if (args.includeFacets || args.filters) return filteredCatalogSearch(args, limit, offset);

    if (!text) {
      return productsRichPage(undefined, limit, offset, sort(args, "createdAt"));
    }

    return productRichTextScan(text, args.field, limit, offset);
  },
  quickSearchProducts: async (_parent: unknown, args: { limit?: number; q: string }) => {
    const text = args.q.trim();

    if (!text) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
    // quickSearch still uses the thin Product shape for the AI assistant
    const exact = await productsPage(productExactWhere(undefined, escapeWhere(text)), limit, 0, undefined);

    if (exact.results.length > 0) {
      return exact.results;
    }

    return (await productTextScan(text, "en", limit, 0)).results;
  },
  standalonePrices: (_parent: unknown, args: { sku: string }) =>
    commercetoolsGraphql(
      `#graphql
        query StandalonePrices($where: String!) {
          standalonePrices(where: $where) {
            total
            results {
              id
              key
              sku
              value { centAmount currencyCode fractionDigits }
              country
              customerGroup { id name }
              channel { id key }
              validFrom
              validUntil
            }
          }
        }
      `,
      { where: `sku="${escapeWhere(args.sku)}"` }
    ),
  // productDetail returns a rich Json! blob for the Product Detail page.
  productDetail: async (_parent: unknown, args: { id: string }) => {
    const data = await commercetoolsGraphql<{ product: Record<string, unknown> | null }>(
      `#graphql
        query ProductDetail($id: String!) {
          product(id: $id) {
            ${richProductDetailFields}
          }
        }
      `,
      { id: args.id }
    );
    return data.product ?? null;
  }
};

// commercetools Query Predicates do not support substring matching on
// LocalizedString fields — `name(en contains "value")` is not valid syntax
// (`contains` only takes `all (...)`/`any (...)` value lists, for Set-typed
// fields) and commercetools rejects it with a "Malformed parameter: where"
// 400 error. That means every text search that used to build this clause
// (the default/"name"/"description" branches) failed outright for *any*
// input — this is what made quickSearchProducts (the AI assistant's
// search_products tool) and productSearch 100% non-functional for text
// queries. Only key/sku support exact `where` matching; use that as a fast
// path, then fall back to an in-memory case-insensitive substring scan for
// everything else (there's no server-side substring op available short of
// commercetools' separate Product Search API).
function productExactWhere(field: string | undefined, value: string) {
  switch (field) {
    case "key":
      return `key="${value}"`;
    case "variants.sku":
      return `masterData(current(masterVariant(sku="${value}") or variants(sku="${value}")))`;
    default:
      return `key="${value}" or masterData(current(masterVariant(sku="${value}") or variants(sku="${value}")))`;
  }
}

// Thin Product type helpers (for quickSearchProducts which uses the contract Product shape).
async function productsPage(
  where: string | undefined,
  limit: number,
  offset: number,
  sortArg: string[] | undefined
) {
  const data = await commercetoolsGraphql<{ products: { results: CtProduct[]; total?: number } }>(
    `#graphql
      query ProductsPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        products(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results { ${productFields} }
        }
      }
    `,
    { limit, offset, sort: sortArg, where }
  );
  const results = data.products.results.map(mapProduct).filter(Boolean);

  return page(results, data.products.total, offset);
}

async function productTextScan(text: string, locale: string, limit: number, offset: number) {
  const needle = text.toLowerCase();
  const data = await commercetoolsGraphql<{ products: { results: CtProduct[] } }>(
    `#graphql
      query ProductsScan($limit: Int!) {
        products(limit: $limit) {
          results { ${productFields} }
        }
      }
    `,
    { limit: 500 }
  );

  const matched = data.products.results.filter((product) => productMatchesText(product, locale, needle));
  const results = matched.slice(offset, offset + limit).map(mapProduct).filter(Boolean);

  return page(results, matched.length, offset);
}

// Rich helpers for productSearch — return the full raw CT node (not the thin Product contract).
async function productsRichPage(
  where: string | undefined,
  limit: number,
  offset: number,
  sortArg: string[] | undefined
) {
  const data = await commercetoolsGraphql<{ products: { results: Record<string, unknown>[]; total?: number } }>(
    `#graphql
      query ProductsRichPage($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
        products(limit: $limit, offset: $offset, sort: $sort, where: $where) {
          total
          results { ${richProductListFields} }
        }
      }
    `,
    { limit, offset, sort: sortArg, where }
  );

  return {
    count: data.products.results.length,
    offset,
    results: data.products.results,
    total: data.products.total ?? data.products.results.length
  };
}

async function filteredCatalogSearch(args: ProductSearchArgs, limit: number, offset: number) {
  const currency = args.currency || "USD";
  const matches: Array<Record<string, unknown> & FilterableProduct> = [];
  let scanOffset = 0;
  const needle = args.text?.trim().toLowerCase();
  while (true) {
    const batch = await productsRichPage(undefined, 100, scanOffset, [...(sort(args, "createdAt") ?? []), "id asc"]);
    const candidates = batch.results.filter((product) => !needle || richProductMatchesText(product, args.field, needle));
    // Limit concurrent standalone price lookups. Resolve the same master-SKU
    // price for filtering and display so the price range matches the cards.
    for (let i = 0; i < candidates.length; i += 10) {
      matches.push(...await Promise.all(candidates.slice(i, i + 10).map(async (product) => {
        const current = (product.masterData as { current?: { masterVariant?: { sku?: string; prices?: Array<{ value: CatalogMoney }> } } })?.current;
        const master = current?.masterVariant;
        let prices = (master?.prices ?? []).map((price) => price.value);
        if (master?.sku && (product.priceMode === "Standalone" || prices.length === 0)) {
          const data = await commercetoolsGraphql<{ standalonePrices: { results: Array<{ value: CatalogMoney }> } }>(
            `query CatalogStandalonePrices($where: String!) { standalonePrices(where: $where, limit: 500) { results { value { centAmount currencyCode fractionDigits } } } }`,
            { where: `sku="${escapeWhere(master.sku)}"` }
          );
          prices = data.standalonePrices.results.map((price) => price.value);
        }
        const resolvedPrice = prices.filter((price) => price.currencyCode === currency).sort((a, b) =>
          a.centAmount / 10 ** (a.fractionDigits ?? 2) - b.centAmount / 10 ** (b.fractionDigits ?? 2))[0] ?? null;
        return { ...product, resolvedPrice };
      })));
    }
    scanOffset += batch.results.length;
    if (batch.results.length < 100 || scanOffset >= batch.total) break;
  }
  const filtered = matches.filter((product) => matchesCatalogFilters(product, args.filters ?? {}));
  const results = filtered.slice(offset, offset + limit);
  return { count: results.length, offset, total: filtered.length, results,
    facets: catalogFacets(matches, args.locale || "en", currency) };
}

async function productRichTextScan(text: string, field: string | undefined, limit: number, offset: number) {
  const needle = text.toLowerCase();
  const results: Record<string, unknown>[] = [];
  let total = 0;
  let scanOffset = 0;
  const batchSize = 100;

  // CT product predicates cannot perform substring matching. Scan every batch
  // in stable order, applying pagination to matches rather than source products.
  // Retain only the requested result page while still calculating the full total.
  while (true) {
    const batch = await productsRichPage(undefined, batchSize, scanOffset, ["id asc"]);
    for (const product of batch.results) {
      if (!richProductMatchesText(product, field, needle)) continue;
      if (total >= offset && results.length < limit) results.push(product);
      total += 1;
    }
    scanOffset += batch.results.length;
    if (batch.results.length < batchSize || scanOffset >= batch.total) break;
  }

  return { count: results.length, offset, results, total };
}

function richProductMatchesText(product: Record<string, unknown>, field: string | undefined, needle: string) {
  const masterData = product.masterData as {
    current?: {
      nameAllLocales?: Array<{ value: string }>;
      descriptionAllLocales?: Array<{ value: string }>;
      masterVariant?: { sku?: string };
      allVariants?: Array<{ sku?: string }>;
    };
  } | undefined;
  const current = masterData?.current;
  const names = (current?.nameAllLocales ?? []).map((entry) => entry.value);
  const descriptions = (current?.descriptionAllLocales ?? []).map((entry) => entry.value);
  const skus = [current?.masterVariant?.sku, ...(current?.allVariants ?? []).map((variant) => variant.sku)];
  const key = product.key as string | undefined;
  const candidates = field === "name" ? names
    : field === "description" ? descriptions
    : field === "key" ? [key]
    : field === "variants.sku" ? skus
    : [key, ...names, ...descriptions, ...skus];
  return candidates.some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
}

function productMatchesText(product: CtProduct, _locale: string, needle: string) {
  const current = product.masterData?.current;
  const sku = current?.masterVariant?.sku;
  const localizedValues = (values: Array<{ value: string }> | undefined) => (values ?? []).map((entry) => entry.value);

  const candidates = [
    product.key,
    sku,
    ...localizedValues(current?.nameAllLocales),
    ...localizedValues(current?.descriptionAllLocales)
  ];

  return candidates.filter((value): value is string => Boolean(value)).some((value) => value.toLowerCase().includes(needle));
}

function normalizeLocale(locale: string | undefined) {
  return (locale?.trim() || "en").replace(/-/g, "_");
}
