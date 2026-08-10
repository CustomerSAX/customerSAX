---
description: Typecheck every workspace package touched by uncommitted changes, contract-first.
---

Uncommitted changes:
!`git status --porcelain`

From the file paths above, determine which workspace packages (under `apps/*`, `apps/commerce/*`,
`packages/*`) have uncommitted changes. Then:

1. If `apps/commerce/contract` is among them (or if any `apps/commerce/*` subgraph is touched, since they
   all depend on contract's built `dist/`), run `pnpm --filter @csa/commerce-contract build` **first**,
   before typechecking anything else.
2. Run `pnpm --filter <pkg> typecheck` for each affected package (map directory → package name via that
   package's own `package.json` `name` field, e.g. `apps/webapp` → `@csa/webapp`).
3. Report pass/fail per package. If any package fails, show the real `tsc` error output — don't summarize
   it away.

If nothing is uncommitted, say so and stop — don't typecheck the whole monorepo unless asked.
