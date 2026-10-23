import { expect, it, vi } from "vitest";
import { matchCustomerEmail } from "./customer-match.js";

const contact = { id: "ct-1", email: "jen@example.uk", version: 3, targets: [{ id: "home", label: "Newmarket", phone: "1111111111" }] };

it("finds one matching customer and reads their current CT contact details", async () => {
  const query = vi.fn().mockResolvedValueOnce({ searchCustomers: { total: 1, results: [{ id: contact.id, email: contact.email }] } }).mockResolvedValueOnce({ customerContactTargets: contact });
  expect(await matchCustomerEmail(query, " jen@example.uk ")).toEqual(contact);
  expect(query.mock.calls[0][1]).toEqual({ email: "jen@example.uk" });
  expect(query.mock.calls[1][1]).toEqual({ id: "ct-1" });
});

it.each([
  { total: 0, results: [] },
  { total: 2, results: [{ id: "a", email: contact.email }, { id: "b", email: contact.email }] },
  { total: 1, results: [{ id: "a", email: "other@example.uk" }] },
  { total: 1, results: [{ id: "a", email: "another-jen@example.uk" }] }
])("rejects missing, ambiguous and partial email results", async searchCustomers => {
  const query = vi.fn().mockResolvedValue({ searchCustomers });
  expect(await matchCustomerEmail(query, contact.email)).toBeNull();
  expect(query).toHaveBeenCalledTimes(1);
});

it("rejects an email that changed between the lookup and contact read", async () => {
  const query = vi.fn().mockResolvedValueOnce({ searchCustomers: { total: 1, results: [{ id: contact.id, email: contact.email }] } }).mockResolvedValueOnce({ customerContactTargets: { ...contact, email: "changed@example.uk" } });
  expect(await matchCustomerEmail(query, contact.email)).toBeNull();
});
