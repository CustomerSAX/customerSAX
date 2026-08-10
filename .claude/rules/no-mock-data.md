---
paths:
  - "apps/**"
---

# No mock, hardcoded, or fabricated data — project-wide rule

This has been the single most repeated correction in this project's history. Treat it as a hard constraint,
not a preference:

- Every value shown to a rep — price, order status, eligibility, shipping method, customer profile field —
  must come from a real call to the real backend (commercetools via the BFF, ticketing, etc.), traced all
  the way through. "It renders something plausible" is not the bar; "it's the actual current value" is.
- If a real upstream field is genuinely null/missing, **show that honestly** — e.g. fall back to a raw
  order ID when commercetools has no `orderNumber`, or report "Unable to reach the commerce backend right
  now" on a real failure — never synthesize a plausible-looking placeholder value instead.
- Distinguish "real, reachable backend legitimately returned nothing" (e.g. `{ ok: true, orders: [] }`) from
  "the backend call itself failed" (e.g. `{ ok: false, reason: ... }`) — collapsing these into one generic
  empty state hides real outages. See the `BffResult` pattern in `apps/webapp/src/app/api/orders/route.ts`.
- When adding an eligibility/validation check (return eligibility, cart shipping, order cancellation), gate
  it on the actual current state of the actual resource (`paymentState`, `shipmentState`, real dates) — never
  on an assumption derived only from a coarser field like `orderState`. See [[commercetools]] for the
  concrete enums this applies to.
- When verifying a fix, prove it against a real resource in the real backend (curl the subgraph, curl the
  BFF, hit the real `/chat` endpoint, drive the real browser) — not just by reading the code and reasoning
  that it should work.
