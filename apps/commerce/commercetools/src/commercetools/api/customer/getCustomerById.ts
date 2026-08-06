import type { Customer } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
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
  const data = await commercetoolsGraphql<{ customer: CtCustomer | null }>(query, {
    id
  });

  return mapCustomer(data.customer);
}
