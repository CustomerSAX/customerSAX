import { getCommercetoolsToken } from "../../../commercetools/auth.js";
import { resolveCommercetoolsProject } from "../../../commercetools/project-config.js";

type Address = {
  id: string;
  phone?: string;
  country: string;
  streetName?: string;
  city?: string;
  [key: string]: unknown;
};
type Customer = { id: string; email: string; version: number; addresses: Address[] };

async function customerRequest(id: string, body?: unknown): Promise<Customer> {
  const config = await resolveCommercetoolsProject();
  const token = await getCommercetoolsToken(config);
  const response = await fetch(
    `${config.apiUrl}/${config.projectKey}/customers/${encodeURIComponent(id)}`,
    {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    }
  );
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "Customer changed. Generate a new proposal before approving."
        : `CT customer request failed (${response.status}).`
    );
  return response.json() as Promise<Customer>;
}

export async function customerContactTargets(id: string) {
  const customer = await customerRequest(id);
  return {
    id: customer.id,
    email: customer.email,
    version: customer.version,
    targets: customer.addresses.map((address) => ({
      id: address.id,
      label:
        [address.streetName, address.city, address.country].filter(Boolean).join(", ") ||
        address.id,
      phone: address.phone ?? ""
    }))
  };
}

/** Version-bound update. Read the whole address so changing phone preserves every other field. */
export async function updateCustomerContactNumber(args: {
  id: string;
  addressId: string;
  expectedVersion: number;
  phone: string;
}) {
  if (
    !/^\+?[\d ()-]+$/.test(args.phone) ||
    !/^[0-9]{7,15}$/.test(args.phone.replace(/\D/g, ""))
  )
    throw new Error("Invalid contact number.");
  const customer = await customerRequest(args.id);
  if (customer.version !== args.expectedVersion)
    throw new Error("Customer changed. Generate a new proposal before approving.");
  const existing = customer.addresses.find((address) => address.id === args.addressId);
  if (!existing) throw new Error("The selected customer address no longer exists.");
  const { id: addressId, ...address } = existing;
  const updated = await customerRequest(args.id, {
    version: args.expectedVersion,
    actions: [
      { action: "changeAddress", addressId, address: { ...address, phone: args.phone } }
    ]
  });
  const actual = updated.addresses.find((item) => item.id === addressId);
  if (actual?.phone !== args.phone)
    throw new Error(
      "CT did not confirm the requested number. Check the customer before retrying."
    );
  return { id: updated.id, version: updated.version, addressId, phone: actual.phone };
}
