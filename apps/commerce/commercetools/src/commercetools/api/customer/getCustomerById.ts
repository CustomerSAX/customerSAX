import type { Customer } from "../../../commerce/types.js";
import { commercetoolsGraphql } from "../../client.js";
import { mapCustomer } from "../../mappers.js";
import type { CtCustomer } from "../../types.js";

const query = `#graphql
  query CustomerById($id: String!) {
    customer(id: $id) {
      id
      customerNumber
      email
      firstName
      lastName
    }
  }
`;

export async function getCustomerById(id: string): Promise<Customer | null> {
  const data = await commercetoolsGraphql<{ customer: CtCustomer | null }>(query, {
    id
  });

  return mapCustomer(data.customer);
}
