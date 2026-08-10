---
paths:
  - "apps/webapp/src/features/csa-assistant/**"
---

# CSA Assistant webapp — chat/stepper parity architecture

The chat panel and the stepper panels (`CreateOrderStepper`, `CreateTicketStepper`, `ReturnStepper`) are two
views onto the same underlying conversation — never two separate data paths. Get this wrong and the two UIs
silently drift out of sync.

## The tool-stream scrape pattern

`ChatStream.tsx` has a `useEffect` (keyed on `[messages.length, isLoading]`) that is the **only** place that
derives `orderWorkflow` / `ticketWorkflow` / `returnWorkflow` / the top-level `customer` field in
`conversation-store.ts`. It re-scans every message's tool-call parts on every relevant change and rebuilds
these snapshots. Steppers read these snapshots as **read-only, derived state** — a stepper must never decide
for itself that "the order is placed" or "the return is eligible"; it only reflects what the scrape effect
already concluded from the real tool-call output. If a stepper needs a new piece of state, add the scrape
logic for it in `ChatStream.tsx`, don't invent a parallel fetch inside the stepper component.

## The "done never clears" trap

Terminal fields (`orderWorkflow.placedOrder`, `ticketWorkflow.createdTicket`, `returnWorkflow.completed`) are
deliberately **carried forward** by the scrape effect once set (`x ?? store.xWorkflow?.x ?? null`) — this is
intentional, so the "done" screen doesn't flicker away mid-stream while later messages are still being scraped.

The consequence: any "start another X" / "create another X" button that just resets the stepper's *local*
step state will immediately get overridden back to `'done'` by the stepper's own auto-advance
`useEffect` (which watches the same terminal field) in the same render tick — the button will look like it
does nothing. The fix is always the same: explicitly clear the workflow snapshot in the store before
resetting local step, e.g.:

```ts
const startNew = () => {
  setLocalDraft(() => ({ ...EMPTY_DRAFT }));
  useConversationStore.getState().setReturnWorkflow(null); // <- required
  setStep('order');
};
```

This exact bug has recurred independently in `ReturnStepper` ("Start another return") and
`CreateTicketStepper` ("Create another ticket") — check any new stepper's reset handler against this pattern
before shipping it.

## Hidden-action protocol

The stepper UI drives the assistant by sending `[hidden-action] {...json...}` as a chat message (see
`onAction` prop threaded through every stepper). The AI recognizes and maps these per the rules in
`apps/ai-assist/src/chat/system-prompt.ts`'s `buildPageContextBlock` / global hidden-action section. Never
render this raw JSON text to the rep — `ChatStream.tsx`'s `isInternalMessageText()` /
`isFullyInternalMessage()` filters exist specifically to hide it; if you add a new hidden-action type, make
sure its literal text still matches those filters.

## `/api/*` route response shapes (read before wiring a new UI list)

Routes under `apps/webapp/src/app/api/` intentionally pre-format data for direct rendering — they are not
raw BFF passthroughs:

- `/api/orders` → `totalPrice` is a formatted string (`"$9000.00"`), not a `{centAmount}` Money object;
  status is `status`, not `orderState`.
- `orderNumber` already falls back to the raw order `id` when commercetools has no `orderNumber` set — this
  is real, honest data (some orders genuinely have no order number), not a bug to "fix" by fabricating one.

Reading the wrong field shape here has caused multiple "$0.00" / blank-status bugs across both
`ReturnStepper`'s and `CreateTicketStepper`'s order lists — check the actual route's `mapOrder()`/response
shape before assuming a GraphQL-style nested object.

## Testing note

`requestAnimationFrame` does not fire in this project's automated browser testing tool (non-visually-
composited). A count-up animation or anything else gated on RAF will look broken in automated testing even
when the underlying data/logic is correct — verify the data layer directly (computed styles, DOM text,
network responses) rather than trusting a visual animation to "look right" in that tool.
