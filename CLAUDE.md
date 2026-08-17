# customer-service-accelerator-monorepo

CSA (Customer Service Accelerator): an AI-assisted support console. A rep works tickets/orders/returns
either through guided steppers in the studio UI or free-form chat with an AI assistant — both paths must
produce identical real results, because they call the same backend tools.

## Layout (pnpm workspace, Turborepo)

```
apps/
  studio/                 Next.js admin console. CSA Assistant feature lives at
                           src/features/csa-assistant/ (chat UI, steppers, Zustand store).
  ai-assist/               Express service (port 8080). POST /chat (Vercel AI SDK streamText).
                           Tools in src/chat/tools/{commerce,tickets,ui-tools}.ts, all via bffQuery().
  bff/                     Apollo Gateway (port 4000). Federates the commerce subgraph + ticketing.
  commerce/
    contract/               Platform-neutral GraphQL type defs (*.graphql.ts, gql tagged templates).
                             Built via `pnpm --filter @csa/commerce-contract build` -> dist/.
                             EVERY commerce subgraph imports the built dist, not the source directly.
    commercetools/           Apollo subgraph (port 4310), the platform actually wired up in dev.
                             Wraps the real commercetools GraphQL API.
    bigcommerce/ shopify/ sfcc/   Same contract, different backend — present but not the active one here.
  ticketing/                Ticket backend.
  tickets-mcp/               Placeholder, currently empty.
packages/ui/                 "Meridian" design system (Tailwind preset + tokens in src/styles/tokens.css,
                             components use `m-*` classes: m-primary, m-surface, m-text-muted, etc.)
configs/{typescript,prettier}/  Shared tsconfig/prettier base configs.
```

## Commands

```bash
pnpm dev                                          # turbo run dev --parallel — all services
pnpm --filter @csa/studio dev                     # just the studio app (port 3000)
pnpm --filter @csa/commerce-contract build         # rebuild the shared GraphQL contract (see gotcha below)
pnpm --filter <pkg> typecheck                      # tsc --noEmit for one package
pnpm typecheck                                      # turbo run typecheck — all packages
```

Package names follow `@csa/<dir-name>` (e.g. `apps/commerce/commercetools` is `@csa/commerce-commercetools`).

## Critical gotchas (all cost real debugging time this project — don't rediscover them)

1. **Resolver aggregation is a manual allowlist.** `apps/commerce/commercetools/src/http/graphql/resolvers.ts`
   explicitly lists every `Query`/`Mutation` field by name from each domain's resolver object. A fully-implemented,
   correctly-exported resolver **silently never runs** if it isn't also added to this file — no error, it just
   returns "Cannot query field" or a null-field error that looks like a data problem, not a wiring problem.
   Always check this file after adding a new query/mutation field anywhere in the commercetools subgraph.
   See [[commercetools]].

2. **The contract's `dist/` can go stale independently of the running dev server.** `predev`/`prebuild` only
   rebuild `@csa/commerce-contract` once, when a `pnpm dev`/`pnpm build` process *starts*. If you edit a
   `.graphql.ts` file in `contract/src` while a subgraph's `tsx watch` process is already running, the subgraph
   keeps serving the OLD compiled schema until you manually re-run
   `pnpm --filter @csa/commerce-contract build`. Confirm the fix by grepping the new field name in
   `apps/commerce/contract/dist/graphql/*.js` before assuming a schema change is live.

3. **BFF gateway schema is cached, not polled, by default without the fix already applied in
   `apps/bff/src/server/federation.ts`** (`pollIntervalInMs: 10_000` on `IntrospectAndCompose`). If a subgraph
   gains a new field/query/mutation, the gateway won't serve it until its next poll (or a restart) — this bit
   `createB2bCart`'s `customerEmail` arg and the `shippingMethods` query/mutation more than once during
   development. The fix is already in place; don't remove it.

4. **commercetools' real GraphQL API is not REST-shaped.** Update actions are `{ actionName: { ...params } }`,
   never `{ action: "actionName", ...params }`. `where` predicates only do exact, case-sensitive matches on
   plain String fields (no substring/`contains` without `all()`/`any()` on Set fields). See [[commercetools]].

5. **Studio stepper "done" screens don't auto-clear.** Each stepper (`CreateOrderStepper`, `CreateTicketStepper`,
   `ReturnStepper`) derives its whole state from a Zustand workflow snapshot that `ChatStream.tsx`'s scrape
   effect rebuilds from the tool-call stream — and that snapshot's terminal field (`placedOrder` /
   `createdTicket` / `completed`) is deliberately *never* cleared by the scrape effect itself, so the "done"
   screen doesn't flicker away mid-stream. Any "start another X" button MUST explicitly call
   `useConversationStore.getState().set<X>Workflow(null)` before resetting its local step, or the auto-advance
   effect immediately flips it right back to "done" in the same tick. See [[studio-steppers]].

## Project philosophy (non-negotiable, repeatedly enforced)

**No mock, hardcoded, or fabricated data — anywhere, ever.** Every value shown to a rep (price, status, order
number, eligibility) must come from a real backend call. If an upstream field is genuinely null/missing, show
that honestly (e.g. fall back to a raw order ID when commercetools has no `orderNumber` set) — never invent a
plausible-looking placeholder. See [[no-mock-data]].

**Fixes must be verified live, not just reasoned about.** After a backend fix: curl the subgraph directly, then
the BFF, then the real `/chat` endpoint. After a UI fix: drive it in the browser pane and read back the actual
rendered state/computed styles. Never report a fix as done without having exercised the real path it fixes.

## Git conventions

- Active branch: `feature/ai-assistant` off `dev` (default branch is `master`, but this repo mainly branches
  from `dev`). Never commit straight to a default/main branch.
- Every commit trailer needs: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Commit only when explicitly asked; prefer new commits over amending.
