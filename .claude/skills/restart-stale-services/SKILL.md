---
name: restart-stale-services
description: >
  Use when a schema/code change appears correct in source but the running dev services (studio, ai-assist,
  bff, commerce/commercetools) don't reflect it yet — a new GraphQL field 404s despite being in the resolver,
  a UI component doesn't show a recent edit, or "it works when I test the function directly but not through
  the app." This is almost always one of three specific staleness sources in this repo, not a mystery bug.
---

# Diagnose and fix a stale-dev-server symptom

This repo has three independent places state can go stale without an error, in order of how often they've
actually caused a real bug in this project:

## 1. `apps/commerce/contract/dist/` didn't rebuild

`predev`/`prebuild` only rebuild `@csa/commerce-contract` once, at the moment a `pnpm dev`/`pnpm build`
process *starts*. Editing `apps/commerce/contract/src/**` after that point does nothing to the already-running
subgraph until you manually rebuild:

```bash
pnpm --filter @csa/commerce-contract build
grep -n "<the field/type you just added>" apps/commerce/contract/dist/graphql/*.js   # confirm it landed
```

If the commercetools subgraph's `tsx watch` process still doesn't reflect it (dist changes alone don't
always trigger its own watch to reload), make a trivial edit to a file it directly watches — e.g. add then
remove a comment in the relevant `apps/commerce/commercetools/src/http/graphql/**/*.resolvers.ts` — to force
a restart.

## 2. BFF gateway hasn't re-polled the subgraph's schema

`apps/bff/src/server/federation.ts` sets `pollIntervalInMs: 10_000` on `IntrospectAndCompose` specifically to
fix this — a brand-new subgraph field/query/mutation should become reachable through the BFF within ~10
seconds without a restart. If it's been longer than that and the BFF still 404s a field the subgraph itself
serves correctly (confirm with a direct curl to `http://localhost:4310/graphql` first), check that this
setting hasn't been removed, then just wait — don't restart the BFF as a first resort.

## 3. Resolver aggregation allowlist wasn't updated

`apps/commerce/commercetools/src/http/graphql/resolvers.ts` explicitly lists every `Query`/`Mutation` field
by name. A resolver that's fully implemented and exported from its own `*.resolvers.ts` module still won't
run if it's missing from this file — the symptom looks like a data bug ("Cannot return null for non-nullable
field"), not a wiring bug. Grep the new field name in this file; if it's not there, add it.

## Verification order

Always confirm which layer is actually stale before touching anything, cheapest check first:

```bash
grep -n "<field>" apps/commerce/contract/dist/graphql/*.js                    # (1) did the build pick it up?
curl -s -X POST http://localhost:4310/graphql -d '{"query":"{ <field> }"}'    # is the subgraph serving it?
curl -s -X POST http://localhost:4000/graphql -d '{"query":"{ <field> }"}'    # is the BFF serving it?
```

Whichever curl fails first tells you which of the three sources above to fix — don't guess or restart
everything speculatively.
