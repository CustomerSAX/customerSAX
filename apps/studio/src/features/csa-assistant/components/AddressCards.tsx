"use client";

/**
 * Saved-address card for the CSA Assistant chat.
 *
 * Rendered straight from the address tool results in ai-assist
 * (get_customer_addresses and every address change, which all return the
 * re-read address list), so it always shows the customer record as it really
 * is. Buttons send `customer.address.*` hidden actions: the assistant then
 * shows an approval card, and nothing changes until the rep approves.
 */

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from "@csa/ui";

export type AddressBook = {
  customerId: string;
  count: number;
  addresses: Array<
    {
      id: string;
      isDefaultShipping: boolean;
      isDefaultBilling: boolean;
      usedForShipping: boolean;
      usedForBilling: boolean;
    } & Record<string, string | boolean | null>
  >;
};

const ADDRESS_TOOLS = new Set([
  "get_customer_addresses",
  "add_customer_address",
  "update_customer_address",
  "remove_customer_address",
  "set_default_customer_address"
]);

/** The address list from a tool result, or null when this isn't one (or it failed). */
export function addressBookFromToolOutput(toolName: string, output: unknown): AddressBook | null {
  if (!ADDRESS_TOOLS.has(toolName)) return null;
  const book = output as Partial<AddressBook> | null;
  if (!book || typeof book.customerId !== "string" || !Array.isArray(book.addresses)) return null;
  return book as AddressBook;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** Address lines exactly as stored — empty parts are left out, never filled in. */
function addressLines(a: AddressBook["addresses"][number]): string[] {
  const name = [text(a.firstName), text(a.lastName)].filter(Boolean).join(" ");
  const street = [text(a.streetName), text(a.streetNumber)].filter(Boolean).join(" ");
  const place = [text(a.city), [text(a.state), text(a.postalCode)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [name, text(a.company), street, text(a.additionalStreetInfo), place, text(a.country), text(a.phone)].filter(Boolean);
}

export function AddressBookCard({
  book,
  onSuggest,
  isLoading = false,
  editable = false,
  checkoutCartId
}: {
  book: AddressBook;
  onSuggest?: (prompt: string) => void;
  isLoading?: boolean;
  /** Only the newest address card is actionable; older ones are snapshots. */
  editable?: boolean;
  /** Cart being checked out in this conversation: each address can be used for it. */
  checkoutCartId?: string | null;
}) {
  const canAct = editable && !!onSuggest;
  const send = (action: Record<string, unknown>) =>
    onSuggest?.(`[hidden-action] ${JSON.stringify({ customerId: book.customerId, ...action })}`);

  return (
    <Card variant="default" className="my-2 w-full max-w-md">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon name="map-pin" size="xs" className="text-m-primary" />
          Saved addresses
          <span className="text-xs font-normal text-m-text-muted">({book.addresses.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {book.addresses.length === 0 && (
          <p className="text-xs text-m-text-muted">This customer has no saved addresses.</p>
        )}
        {book.addresses.map((a) => {
          const lines = addressLines(a);
          return (
            <div key={a.id} className="rounded-m-md border border-m-border p-3 space-y-2">
              <div className="flex flex-wrap gap-1">
                {a.isDefaultShipping && <Badge variant="primary" size="sm">Default shipping</Badge>}
                {a.isDefaultBilling && <Badge variant="primary" size="sm">Default billing</Badge>}
                {!a.isDefaultShipping && a.usedForShipping && <Badge variant="neutral" size="sm">Shipping</Badge>}
                {!a.isDefaultBilling && a.usedForBilling && <Badge variant="neutral" size="sm">Billing</Badge>}
              </div>
              <div className="text-xs text-m-text leading-relaxed">
                {lines.length > 0 ? lines.map((l, i) => <div key={i}>{l}</div>) : <span className="text-m-text-muted">No details on record</span>}
              </div>
              {canAct && checkoutCartId && (
                <Button size="sm" variant="primary" className="w-full" disabled={isLoading} leftIcon={<Icon name="truck" size="xs" />}
                  onClick={() => send({ type: "order.use_address", cartId: checkoutCartId, addressId: a.id })}>
                  Ship to this address
                </Button>
              )}
              {canAct && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="outline" disabled={isLoading} leftIcon={<Icon name="pencil" size="xs" />}
                    onClick={() => send({ type: "customer.address.edit", addressId: a.id })}>
                    Edit
                  </Button>
                  {!a.isDefaultShipping && (
                    <Button size="sm" variant="outline" disabled={isLoading}
                      onClick={() => send({ type: "customer.address.set_default", addressId: a.id, kind: "shipping" })}>
                      Default shipping
                    </Button>
                  )}
                  {!a.isDefaultBilling && (
                    <Button size="sm" variant="outline" disabled={isLoading}
                      onClick={() => send({ type: "customer.address.set_default", addressId: a.id, kind: "billing" })}>
                      Default billing
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={isLoading} aria-label="Remove address" leftIcon={<Icon name="trash-2" size="xs" />}
                    onClick={() => send({ type: "customer.address.remove", addressId: a.id })}>
                    Remove
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {canAct && (
          <Button size="sm" variant="secondary" className="w-full" disabled={isLoading} leftIcon={<Icon name="plus" size="xs" />}
            onClick={() => send({ type: "customer.address.add" })}>
            Add address
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
