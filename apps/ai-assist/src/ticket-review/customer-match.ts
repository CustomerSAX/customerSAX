import type { ContactCustomer } from "./types.js";

type Query = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export async function matchCustomerEmail(query: Query, email: string): Promise<ContactCustomer | null> {
    // searchCustomers uses an exact email predicate first, scoped to the active
    // commerce project. Reject partial search results and ambiguous matches.
    const data = await query<{ searchCustomers: { total: number; results: Array<{ id: string; email: string }> } }>(
      `query ReviewCustomerByEmail($email: String!) {
        searchCustomers(option: "email", text: $email, limit: 2) { total results { id email } }
      }`,
      { email: email.trim() }
    );
    const matches = data.searchCustomers;
    const match = matches.results[0];
    if (matches.total !== 1 || matches.results.length !== 1 || !match || match.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
    const customer = await query<{ customerContactTargets: ContactCustomer | null }>(
      `query ReviewMatchedCustomerContact($id: ID!) { customerContactTargets(id: $id) }`,
      { id: match.id }
    );
    const contact = customer.customerContactTargets;
    return contact?.id === match.id && contact.email.trim().toLowerCase() === email.trim().toLowerCase() ? contact : null;
}
