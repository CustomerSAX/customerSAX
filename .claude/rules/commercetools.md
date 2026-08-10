---
paths:
  - "apps/commerce/commercetools/**"
  - "apps/commerce/contract/**"
  - "apps/bff/**"
  - "apps/ai-assist/src/chat/tools/commerce.ts"
---

# commercetools GraphQL API — real quirks, not REST assumptions

These were each discovered the hard way (a resolver that looked correct but failed against the real API).
Trust this file over instinct — commercetools' GraphQL API does not behave like a typical REST-mapped schema.

## Update actions

Every mutation that updates an existing resource (order, cart, customer) takes an array of actions shaped
`{ actionName: { ...params } }` — **not** `{ action: "actionName", ...params }`. The latter fails GraphQL
validation outright with an unhelpful error. Examples actually used in this codebase:

```graphql
updateOrder(id: $id, version: $version, actions: [
  { changeOrderState: { orderState: "Cancelled" } }
  { changePaymentState: { paymentState: "Paid" } }
  { changeShipmentState: { shipmentState: "Shipped" } }
  { addReturnInfo: { items: [...] } }
])
```

```graphql
updateCart(id: $id, version: $version, actions: [
  { setShippingMethod: { shippingMethod: { id: $shippingMethodId } } }
])
```

## Enums that actually exist

- `ShipmentState`: `Backorder | Delayed | Partial | Pending | Ready | Shipped`. Only `Shipped`/`Partial` mean
  physical goods have actually left the warehouse — gate any "has this shipped" logic on those two, not on
  order state.
- `PaymentState`: `BalanceDue | CreditOwed | Failed | Paid | Pending`. Only `Paid` means money has actually
  cleared.
- `ReturnShipmentState` (used inside `addReturnInfo` items, distinct from the two above):
  `Advised | Returned | BackInStock | Unusable`.

A real order can be `orderState: "Open"` while `paymentState`/`shipmentState` are both still `"Pending"` —
**order state alone is not sufficient to decide return/cancel eligibility.** See
`checkReturnEligibilityTool` in `apps/ai-assist/src/chat/tools/commerce.ts` for the reference implementation
that gates on all three.

## Query predicates (`where` clauses)

- Plain `String` fields only support exact, case-sensitive equality (`field="value"`) — no substring, no
  case-insensitive match, no `contains "value"`.
- `contains` only works on `Set`-typed fields, via `all(...)`/`any(...)`.
- For case-insensitive/partial search (customer name, product name), fall back to fetching a page and
  filtering client-side with `rapidfuzz`-style matching, or a dedicated text-scan helper — see
  `searchCustomers()`/`textScanCustomers()` in `customer.resolvers.ts` and `productTextScan()` in
  `product.resolvers.ts` for the established pattern.

## Field shapes worth remembering

- `orders`/`orderPage` return a paginated `{ results: [...], total }` shape when queried with `where`/paging
  args, but a **flat array** when called with just `limit` at the top-level `orders(limit)` field — check
  which resolver you're hitting before assuming a `.results` accessor exists.
- `shippingMethods` returns `{ results: [...] }` (paginated).
- `customer(id, email)` — the `email` arg only exists on this repo's platform-neutral wrapper type, not on
  commercetools' native API directly.
- `OrderCartCommand` (used by `createOrderFromCart`) accepts `orderNumber`, `paymentState`, `shipmentState`
  directly — always pass a real generated order number and an explicit initial `paymentState`/`shipmentState`
  rather than leaving them to commercetools' defaults, or every order created through this flow starts with
  no order number and null states (see `generateUniqueOrderNumber()` in `cart.resolvers.ts`).

## The resolver aggregation trap

`apps/commerce/commercetools/src/http/graphql/resolvers.ts` is a hand-maintained allowlist mapping every
schema `Query`/`Mutation` field to its resolver function. Writing a new resolver in `*.resolvers.ts` and
exporting it from that module is **not enough** — it must also be added by name to the `Query`/`Mutation`
objects in `resolvers.ts`, or it silently never executes. The failure mode looks exactly like a data-shape
bug ("Cannot return null for non-nullable field"), not a wiring bug — check this file first whenever a new
field 404s or nulls out despite the resolver code looking correct.
