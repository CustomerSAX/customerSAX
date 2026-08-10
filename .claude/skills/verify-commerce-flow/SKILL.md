---
name: verify-commerce-flow
description: >
  Live-verification checklist for any fix touching commerce/ticketing data (order, cart, return, refund,
  shipping method, customer). Walks the fix down through every layer with real curl/browser checks instead
  of trusting that the code "should" work. Use this whenever you've just changed something in
  apps/commerce/*, apps/bff, apps/ai-assist/src/chat/tools, or a CSA Assistant stepper/chat surface in
  apps/webapp, before telling the user it's fixed.
---

# Verify a commerce/ticketing flow fix, layer by layer

Reasoning about a fix from reading the code is not sufficient in this repo — this project has repeatedly hit
bugs where the code looked correct but a layer above or below it (a resolver-aggregation omission, a stale
`contract/dist`, a stale BFF-gateway schema cache) meant the fix never actually reached production behavior.
Prove it at each layer that changed.

## 1. Rebuild anything that needs it

If you touched `apps/commerce/contract/src/**`, rebuild it and grep the output to confirm the change landed:

```bash
pnpm --filter @csa/commerce-contract build
grep -n "<newFieldOrType>" apps/commerce/contract/dist/graphql/*.js
```

If the running `tsx watch` subgraph process doesn't seem to have picked up a contract rebuild, make a
trivial edit to a file it directly watches (e.g. add/remove a comment in the relevant `*.resolvers.ts`) to
force a reload, then revert the edit once confirmed — don't leave forcing-comments in committed code.

## 2. Confirm the subgraph serves it directly

```bash
curl -s -X POST http://localhost:4310/graphql \
  -H "content-type: application/json" \
  -d '{"query":"{ <minimal query touching the change> }"}'
```

Look for the real field/value in the response, not just a 200 with no errors.

## 3. Confirm the BFF gateway serves it

```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "content-type: application/json" -H "x-csa-commerce-platform: commercetools" \
  -d '{"query":"{ <same query> }"}'
```

If this fails with "Cannot query field ..." while step 2 succeeded, the gateway's schema cache hasn't
picked it up yet — see the BFF polling gotcha in `/CLAUDE.md`. Don't work around this by restarting the BFF
manually every time; confirm `pollIntervalInMs` is still set in `apps/bff/src/server/federation.ts` and just
wait ~10s.

## 4. Exercise the real `ai-assist` tool through `/chat`

```bash
curl -s -X POST http://localhost:8080/chat \
  -H "content-type: application/json" \
  -d '{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"<realistic rep message>"}]}],
       "context":{"userEmail":"agent@csa.local","userRole":"Support Agent"}}'
```

This is an SSE stream — look for the relevant `tool-output-available` event and confirm the JSON payload has
the real, correct value (not the old/buggy one). This is the actual code path the chat UI hits.

## 5. If UI-visible, drive the real browser

Use the Browser pane tools against the running webapp (`preview_start` with the `webapp` launch config).
Reproduce the exact reported scenario, then read back real state — `get_page_text`, `read_page`, or
`javascript_tool` to inspect computed styles/DOM text — rather than assuming a code change rendered
correctly. `computer{action:"screenshot"}` may be unavailable in this environment (the pane doesn't always
composite frames for screenshots); fall back to the text/DOM-based checks above.

## 6. Mutating real test data to exercise both branches of a conditional

When verifying an eligibility/state-gated fix (e.g. return eligibility depending on `paymentState`/
`shipmentState`), it's legitimate to mutate a real test order via a genuine `updateOrder` action to exercise
both the pass and fail branch — then **revert it back to its original state** afterward so you don't leave
altered test data behind for the user's own testing.

## 7. Typecheck every touched package

```bash
pnpm --filter <pkg> typecheck
```

Only report the fix as done once steps 1–7 that apply to your change have actually been run, with real
output — quote the curl responses or DOM state you saw, not a description of what you expect them to say.
