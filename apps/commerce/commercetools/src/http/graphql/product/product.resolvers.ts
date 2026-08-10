import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { mapProduct } from "./product.mapper.js";
import type { CtProduct } from "../../../commercetools/types.js";
import { getProductByIdOrKey, listProducts } from "../../../commercetools/api/index.js";
import { escapeWhere, page, paging, sort, type PagingArgs } from "../shared/paging.js";
import type { ProductSearchArgs } from "./product.types.js";

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

export const resolvers = {
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
  productSearch: async (_parent: unknown, args: ProductSearchArgs) => {
    const { limit, offset } = paging(args);
    const text = args.text?.trim();

    if (!text) {
      return productsPage(undefined, limit, offset, sort(args, "createdAt"));
    }

    const locale = normalizeLocale(args.locale);
    const exactWhere = productExactWhere(args.field, escapeWhere(text));
    const exact = await productsPage(exactWhere, limit, offset, sort(args, "createdAt"));

    if (exact.total > 0) {
      return exact;
    }

    return productTextScan(text, locale, limit, offset);
  },
  quickSearchProducts: async (_parent: unknown, args: { limit?: number; q: string }) => {
    const text = args.q.trim();

    if (!text) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
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
    )
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
