import type { Customer } from "@csa/commerce-contract";
import { commercetoolsGraphql } from "../../client.js";
import { mapCustomer } from "../../mappers.js";
import type { CtCustomer } from "../../types.js";
import { customerFields } from "./customerFields.js";

const query = `#graphql
  query CustomerByEmail($email: String!) {
    customer(email: $email) {
      ${customerFields}
    }
  }
`;

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const data = await commercetoolsGraphql<{ customer: CtCustomer | null }>(query, {
    email
  });

  return mapCustomer(data.customer);
}
