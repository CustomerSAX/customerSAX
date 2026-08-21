import { commercetoolsGraphql } from "../../../commercetools/client.js";
import { resolvers as cartResolvers } from "../cart/cart.resolvers.js";
import { resolvers as orderResolvers } from "../order/order.resolvers.js";
import { page, paging, sort } from "../shared/paging.js";
import { mapCompany } from "./company.mapper.js";
import { sampleCompanies } from "./company.sample.js";
import type { CompanySearchArgs, CtCompany } from "./company.types.js";

const companyFields = `#graphql
  id
  key
  name
  status
  unitType
  associateMode
  approvalRuleMode
  storeMode
  contactEmail
  createdAt
  lastModifiedAt
  parentUnit { id key name }
  addresses {
    id key streetName streetNumber city state postalCode country company email phone firstName lastName
  }
  associates {
    customer { id email firstName lastName }
    associateRoleAssignments { associateRole { key name } }
  }
`;

export const resolvers = {
  createCompany: async (
    _parent: unknown,
    args: { draft: Record<string, unknown> }
  ) => {
    const data = await commercetoolsGraphql<{ createBusinessUnit: CtCompany | null }>(
      `#graphql
        mutation CreateBusinessUnit($draft: BusinessUnitDraft!) {
          createBusinessUnit(draft: $draft) { ${companyFields} }
        }
      `,
      { draft: args.draft }
    );

    return data.createBusinessUnit ? mapCompany(data.createBusinessUnit) : null;
  },
  companies: async (_parent: unknown, args: CompanySearchArgs) => {
    try {
      return await queryCompanies(args);
    } catch (error) {
      console.warn(`[commercetools] businessUnits query failed; returning sample companies: ${message(error)}`);
      return sampleCompanyPage(args);
    }
  },
  company: async (_parent: unknown, args: { id?: string; key?: string }) => {
    if (!args.id && !args.key) return null;

    try {
      return await queryCompany(args);
    } catch (error) {
      console.warn(`[commercetools] businessUnit lookup failed; returning sample company: ${message(error)}`);
      return sampleCompanies
        .map(mapCompany)
        .find((company) => company.id === args.id || company.key === args.key) ?? null;
    }
  },
  companyCarts: (_parent: unknown, args: { companyKey: string; limit?: number; offset?: number; sortKey?: string; sortOrder?: string }) =>
    cartResolvers.b2bCarts(_parent, { ...args, businessUnitKey: args.companyKey }),
  companyOrders: (_parent: unknown, args: { companyKey: string; limit?: number; offset?: number; sortKey?: string; sortOrder?: string }) =>
    orderResolvers.b2bOrders(_parent, { ...args, businessUnitKey: args.companyKey })
};

async function queryCompany(args: { id?: string; key?: string }) {
  const data = await commercetoolsGraphql<{ businessUnit: CtCompany | null }>(
    `#graphql
      query BusinessUnit($id: String, $key: String) {
        businessUnit(id: $id, key: $key) { ${companyFields} }
      }
    `,
    args
  );

  return data.businessUnit ? mapCompany(data.businessUnit) : null;
}

async function queryCompanies(args: CompanySearchArgs) {
  const { limit, offset } = paging(args);
  const data = await commercetoolsGraphql<{ businessUnits: { results: CtCompany[]; total?: number } }>(
    `#graphql
      query BusinessUnits($limit: Int!, $offset: Int!, $sort: [String!]) {
        businessUnits(limit: $limit, offset: $offset, sort: $sort) {
          total
          results { ${companyFields} }
        }
      }
    `,
    { limit, offset, sort: sort(args, "lastModifiedAt") }
  );

  const results = filterCompanies(data.businessUnits.results, args).map(mapCompany);

  return page(results, args.searchText ? results.length : data.businessUnits.total, offset);
}

function sampleCompanyPage(args: CompanySearchArgs) {
  const { limit, offset } = paging(args);
  const filtered = filterCompanies(sampleCompanies, args);
  return page(filtered.slice(offset, offset + limit).map(mapCompany), filtered.length, offset);
}

function filterCompanies(companies: CtCompany[], args: CompanySearchArgs) {
  const text = args.searchText?.trim().toLowerCase();
  if (!text) return companies;

  const field = args.searchField?.trim();

  return companies.filter((company) => {
    const haystack =
      field === "key"
        ? [company.key]
        : field === "name"
          ? [company.name]
          : [company.name, company.key, company.contactEmail, company.unitType, company.status];

    return haystack.filter((value): value is string => Boolean(value)).some((value) => value.toLowerCase().includes(text));
  });
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
