/**
 * Customer address management (commerce customer record, not the CRM).
 *
 * Reads run freely; every change needs the rep's approval, enforced by the
 * write guard. Two commercetools behaviours shape these tools:
 *  - `changeAddress` REPLACES the whole address, so update_customer_address
 *    merges the changed fields into the current address — "change the postcode"
 *    must never wipe the street, phone or email.
 *  - The mutations return only part of each address, so every tool re-reads
 *    the full list afterwards: what the rep sees is always the real state.
 * The studio renders the address card straight from these results.
 */

import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@csa/logger";
import { bffQuery } from "../../commerce/graphql-client.js";
import { instrumentTools } from "./instrument.js";
import { guardWriteTools } from "./write-guard.js";

const log = createLogger("ai-assist").child({ module: "tools/addresses" });

type RawAddress = Record<string, string | null | undefined> & { id: string };
type RawAddressBook = {
  addresses: RawAddress[];
  defaultShippingAddressId: string | null;
  defaultBillingAddressId: string | null;
  shippingAddressIds: string[];
  billingAddressIds: string[];
};

const ADDRESS_KEYS = [
  "firstName", "lastName", "company", "streetName", "streetNumber", "additionalStreetInfo",
  "building", "apartment", "postalCode", "city", "region", "state", "country", "phone", "mobile", "email"
] as const;

/** Address fields the rep can set. Empty strings mean "not given" (the model fills every field). */
const addressInput = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  streetName: z.string().optional().describe("Street and house details, e.g. '7609 Mckinley Ave'"),
  streetNumber: z.string().optional().describe("Number / unit, e.g. 'apt 48'"),
  additionalStreetInfo: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional().describe("Two-letter ISO country code, e.g. US, DE"),
  phone: z.string().optional(),
  email: z.string().optional()
});

/** Drops empty values so they are never sent as real data. */
function given(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && v.trim()) out[k] = k === "country" ? v.trim().toUpperCase() : v.trim();
  }
  return out;
}

/** The address as commercetools expects it: only real fields, no id/key. */
function toAddressDraft(address: Record<string, unknown>): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const k of ADDRESS_KEYS) {
    const v = address[k];
    if (typeof v === "string" && v.trim()) draft[k] = v;
  }
  return draft;
}

async function readAddressBook(customerId: string): Promise<RawAddressBook> {
  const data = await bffQuery<{ customerAddresses: RawAddressBook }>(
    `query CustomerAddresses($id: ID!) { customerAddresses(id: $id) }`,
    { id: customerId }
  );
  return data.customerAddresses;
}

/** Card-ready address list. Values come straight from commercetools; nothing is filled in. */
function presentAddressBook(customerId: string, book: RawAddressBook) {
  return {
    customerId,
    count: book.addresses.length,
    defaultShippingAddressId: book.defaultShippingAddressId,
    defaultBillingAddressId: book.defaultBillingAddressId,
    addresses: book.addresses.map((a) => ({
      id: a.id,
      ...Object.fromEntries(ADDRESS_KEYS.map((k) => [k, a[k] ?? null])),
      isDefaultShipping: a.id === book.defaultShippingAddressId,
      isDefaultBilling: a.id === book.defaultBillingAddressId,
      usedForShipping: book.shippingAddressIds.includes(a.id),
      usedForBilling: book.billingAddressIds.includes(a.id)
    }))
  };
}

const customerIdInput = z.string().min(1).describe("commercetools customer id from find_customer in this conversation");

export function buildAddressTools(approvalGate?: { pending: boolean }) {
  const getCustomerAddresses = tool({
    description:
      "List a customer's saved addresses with their default shipping / billing flags. The studio shows them as an address card " +
      "with Edit / Set default / Remove / Add buttons, so don't repeat the addresses in text.",
    inputSchema: z.object({ customerId: customerIdInput }),
    execute: async ({ customerId }) => {
      try {
        return presentAddressBook(customerId, await readAddressBook(customerId));
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  const addCustomerAddress = tool({
    description:
      "Add a new address to a customer. ALWAYS require action_approval first. A country (2-letter code) and at least a street or city are required. " +
      "use = shipping or billing; makeDefault also makes it the default for that use. (To make it the default for the other use too, " +
      "follow up with set_default_customer_address.)",
    inputSchema: z.object({
      customerId: customerIdInput,
      address: addressInput,
      use: z.enum(["shipping", "billing"]).default("shipping"),
      makeDefault: z.boolean().default(false)
    }),
    execute: async ({ customerId, address, use, makeDefault }) => {
      const draft = given(address);
      if (!draft.country || !/^[A-Z]{2}$/.test(draft.country)) {
        return { error: "A two-letter country code (e.g. US) is required to add an address." };
      }
      if (!draft.streetName && !draft.city) return { error: "At least a street or a city is required to add an address." };
      try {
        const before = await readAddressBook(customerId);
        await bffQuery(
          `mutation AddCustomerAddress($id: ID!, $address: Json!, $addressType: String) {
            addCustomerAddress(id: $id, address: $address, addressType: $addressType)
          }`,
          { id: customerId, address: draft, addressType: use }
        );
        const after = await readAddressBook(customerId);
        const added = after.addresses.find((a) => !before.addresses.some((b) => b.id === a.id));
        if (added && makeDefault) {
          await bffQuery(
            `mutation SetDefaultAddress($id: ID!, $addressId: ID!, $kind: String!) {
              setDefaultCustomerAddress(id: $id, addressId: $addressId, kind: $kind)
            }`,
            { id: customerId, addressId: added.id, kind: use }
          );
        }
        log.info("write:add_customer_address", { targetId: customerId, ok: Boolean(added) });
        const book = presentAddressBook(customerId, await readAddressBook(customerId));
        return { added: added?.id ?? null, ...book };
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  const updateCustomerAddress = tool({
    description:
      "Change fields of one of a customer's existing addresses. ALWAYS require action_approval first. Pass ONLY the fields that change — " +
      "everything else is kept from the current address.",
    inputSchema: z.object({
      customerId: customerIdInput,
      addressId: z.string().min(1).describe("Address id from get_customer_addresses"),
      changes: addressInput
    }),
    execute: async ({ customerId, addressId, changes }) => {
      const updates = given(changes);
      if (Object.keys(updates).length === 0) return { error: "No changed fields were given." };
      if (updates.country && !/^[A-Z]{2}$/.test(updates.country)) return { error: "Country must be a two-letter code (e.g. US)." };
      try {
        const current = (await readAddressBook(customerId)).addresses.find((a) => a.id === addressId);
        if (!current) return { error: "That address isn't on this customer's record (it may have been removed)." };
        // changeAddress replaces the whole address — merge so unchanged fields survive.
        const merged = { ...toAddressDraft(current), ...updates };
        await bffQuery(
          `mutation UpdateCustomerAddress($id: ID!, $addressId: ID!, $address: Json!) {
            updateCustomerAddress(id: $id, addressId: $addressId, address: $address)
          }`,
          { id: customerId, addressId, address: merged }
        );
        log.info("write:update_customer_address", { targetId: customerId, ok: true });
        return { updated: addressId, changedFields: Object.keys(updates), ...presentAddressBook(customerId, await readAddressBook(customerId)) };
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  const removeCustomerAddress = tool({
    description: "Remove one of a customer's addresses. ALWAYS require action_approval first.",
    inputSchema: z.object({ customerId: customerIdInput, addressId: z.string().min(1) }),
    execute: async ({ customerId, addressId }) => {
      try {
        await bffQuery(
          `mutation RemoveCustomerAddress($id: ID!, $addressId: ID!) { removeCustomerAddress(id: $id, addressId: $addressId) }`,
          { id: customerId, addressId }
        );
        log.info("write:remove_customer_address", { targetId: customerId, ok: true });
        return { removed: addressId, ...presentAddressBook(customerId, await readAddressBook(customerId)) };
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  const setDefaultCustomerAddress = tool({
    description: "Make one of a customer's addresses their default shipping or billing address. ALWAYS require action_approval first.",
    inputSchema: z.object({
      customerId: customerIdInput,
      addressId: z.string().min(1),
      kind: z.enum(["shipping", "billing"])
    }),
    execute: async ({ customerId, addressId, kind }) => {
      try {
        await bffQuery(
          `mutation SetDefaultAddress($id: ID!, $addressId: ID!, $kind: String!) {
            setDefaultCustomerAddress(id: $id, addressId: $addressId, kind: $kind)
          }`,
          { id: customerId, addressId, kind }
        );
        log.info("write:set_default_customer_address", { targetId: customerId, ok: true });
        return { defaultSet: { addressId, kind }, ...presentAddressBook(customerId, await readAddressBook(customerId)) };
      } catch (err) {
        return { error: String(err) };
      }
    }
  });

  return instrumentTools(
    guardWriteTools(
      {
        get_customer_addresses: getCustomerAddresses,
        add_customer_address: addCustomerAddress,
        update_customer_address: updateCustomerAddress,
        remove_customer_address: removeCustomerAddress,
        set_default_customer_address: setDefaultCustomerAddress
      },
      approvalGate
    ),
    log
  );
}
