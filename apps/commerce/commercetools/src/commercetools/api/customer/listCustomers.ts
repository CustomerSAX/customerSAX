import type { Customer, Page } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapCustomer } from "../../mappers.js";
import type { CtCustomer } from "../../types.js";
import { customerFields } from "./customerFields.js";

const query = `#graphql
  query Customers($limit: Int!, $offset: Int!) {
    customers(limit: $limit, offset: $offset) {
      total
      count
      offset
      results {
        ${customerFields}
      }
    }
  }
`;

export async function listCustomers(args: {
  limit?: number;
  offset?: number;
}): Promise<Page<Customer>> {
  const data = await commercetoolsGraphql<{
    customers: { count?: number; offset?: number; results: CtCustomer[]; total?: number };
  }>(
    query,
    paging(args)
  );

  const results = data.customers.results.map(mapCustomer).filter(isDefined);

  return {
    count: data.customers.count ?? results.length,
    offset: data.customers.offset ?? args.offset ?? 0,
    results,
    total: data.customers.total ?? results.length
  };
}

function paging(args: { limit?: number; offset?: number }) {
  return {
    limit: args.limit ?? 20,
    offset: args.offset ?? 0
  };
}

function isDefined<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
