import type { Customer } from "@csa/commerce-contract";
import { commercetoolsGraphql, commercetoolsLookup, escapeWhere } from "../../client.js";
import { mapCustomer } from "../../mappers.js";
import type { CtCustomer } from "../../types.js";
import { customerFields } from "./customerFields.js";

// commercetools' native GraphQL API does NOT accept an `email` argument on
// the singular `customer` query field (only id/key/emailToken/passwordToken)
// — passing one fails schema validation with an HTTP 400. Email lookups have
// to go through the `customers(where: ...)` query instead, same as
// searchCustomers does.
const query = `#graphql
  query CustomerByEmail($where: String!) {
    customers(where: $where, limit: 1) {
      results {
        ${customerFields}
      }
    }
  }
`;

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  return commercetoolsLookup(async () => {
    const data = await commercetoolsGraphql<{ customers: { results: CtCustomer[] } }>(query, {
      where: `email="${escapeWhere(email)}"`
    });

    return mapCustomer(data.customers.results[0] ?? null);
  }, `getCustomerByEmail(${email})`);
}
