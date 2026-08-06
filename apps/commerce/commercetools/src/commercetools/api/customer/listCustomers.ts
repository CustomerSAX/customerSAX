import type { Customer } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapCustomer } from "../../mappers.js";
import type { CtCustomer } from "../../types.js";

const query = `#graphql
  query Customers($limit: Int!, $offset: Int!) {
    customers(limit: $limit, offset: $offset) {
      results {
        id
        customerNumber
        email
        firstName
        lastName
      }
    }
  }
`;

export async function listCustomers(args: {
  limit?: number;
  offset?: number;
}): Promise<Customer[]> {
  const data = await commercetoolsGraphql<{ customers: { results: CtCustomer[] } }>(
    query,
    paging(args)
  );

  return data.customers.results.map(mapCustomer).filter(isDefined);
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

