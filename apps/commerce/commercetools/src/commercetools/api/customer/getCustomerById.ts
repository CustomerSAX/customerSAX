import type { Customer } from "@csa/commerce-contract";
import { commercetoolsGraphql, commercetoolsLookup } from "../../client.js";
import { mapCustomer } from "../../mappers.js";
import type { CtCustomer } from "../../types.js";
import { customerFields } from "./customerFields.js";

const query = `#graphql
  query CustomerById($id: String!) {
    customer(id: $id) {
      ${customerFields}
    }
  }
`;

export async function getCustomerById(id: string): Promise<Customer | null> {
  return commercetoolsLookup(async () => {
    const data = await commercetoolsGraphql<{ customer: CtCustomer | null }>(query, {
      id
    });

    return mapCustomer(data.customer);
  }, `getCustomerById(${id})`);
}
