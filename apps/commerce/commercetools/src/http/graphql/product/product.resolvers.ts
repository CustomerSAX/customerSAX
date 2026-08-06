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
  products: (_parent: unknown, args: PagingArgs) => listProducts(args),
  productPage: async (_parent: unknown, args: PagingArgs) => {
    const items = await listProducts(args);

    return page(items, undefined, args.offset ?? 0);
  },
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
    const where = text ? productSearchWhere(args.field, text, normalizeLocale(args.locale)) : undefined;
    const data = await commercetoolsGraphql<{ products: { results: CtProduct[]; total?: number } }>(
      `#graphql
        query ProductSearch($limit: Int!, $offset: Int!, $sort: [String!], $where: String) {
          products(limit: $limit, offset: $offset, sort: $sort, where: $where) {
            total
            results { ${productFields} }
          }
        }
      `,
      { limit, offset, sort: sort(args, "createdAt"), where }
    );
    const results = data.products.results.map(mapProduct).filter(Boolean);

    return page(results, data.products.total, offset);
  },
  quickSearchProducts: async (_parent: unknown, args: { limit?: number; q: string }) => {
    const text = args.q.trim();

    if (!text) {
      return [];
    }

    const data = await commercetoolsGraphql<{ products: { results: CtProduct[] } }>(
      `#graphql
        query QuickSearchProducts($where: String!, $limit: Int!) {
          products(where: $where, limit: $limit) {
            results { ${productFields} }
          }
        }
      `,
      {
        limit: Math.min(Math.max(args.limit ?? 10, 1), 25),
        where: productSearchWhere("allFields", text, "en")
      }
    );

    return data.products.results.map(mapProduct).filter(Boolean);
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

function productSearchWhere(field: string | undefined, text: string, locale: string) {
  const value = escapeWhere(text);

  switch (field) {
    case "key":
      return `key="${value}"`;
    case "variants.sku":
      return `masterData(current(masterVariant(sku="${value}") or variants(sku="${value}")))`;
    case "description":
      return `masterData(current(description(${locale} contains "${value}")))`;
    case "name":
      return `masterData(current(name(${locale} contains "${value}")))`;
    default:
      return [
        `key="${value}"`,
        `masterData(current(name(${locale} contains "${value}")))`,
        `masterData(current(description(${locale} contains "${value}")))`,
        `masterData(current(masterVariant(sku="${value}") or variants(sku="${value}")))`
      ].join(" or ");
  }
}

function normalizeLocale(locale: string | undefined) {
  return (locale?.trim() || "en").replace(/-/g, "_");
}
