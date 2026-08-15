# customerSAX — Engineering Refactor Backlog

> Compiled from a full folder-by-folder audit (logging, hardcoding/reuse, infra/config, per-app structural).
> Goal (owner): **centralize, reuse, modular, consistent** — no hardcoded logic anywhere; proper logging +
> exception handling everywhere; documented; all scenarios covered; refactor **without impacting current flow**.
> Standing rules: work on branch `customerSAX-redesign-v1`, commit each step, do not push. (Product backlog lives in root `BACKLOG.md`.)

## Guiding principle
The single biggest theme across all four audits: **service plumbing is copy-pasted, not shared.** The fix is a
**shared-foundation layer of packages** every service composes — that delivers the centralization, reuse,
modularity, and consistency the whole codebase is asking for.

---

## P0 — Shared-foundation packages (the centerpiece)

Create these `packages/*` (source-ESM, like `@csa/mongodb`; extend `@csa/config-typescript`), then migrate every service to them. Each migration behavior-preserving + typecheck + live-verified + committed.

1. **`@csa/logger`** — Winston-based structured logger (house style, per Metafy's `@metafy/logger`), but native `AsyncLocalStorage` (not cls-hooked, since not NestJS). Levels via `LOG_LEVEL`, JSON in prod / colorized in dev, `child({module})` bound context, `safeStringify` cycle guard, **PII-safe defaults** (log sizes/keys, never values). Per-server-style helpers for node:http (auth) / Express (ai-assist) / Apollo (bff, subgraphs). `x-request-id` correlation threaded through the existing `x-csa-*` header forwarding. Replaces **95 raw `console.*` calls**. Fix the 2 PII leaks in the same pass (`auth/http/auth.ts:84` raw email; `packages/mongodb` SMTP error bodies). *(Full design: logging audit.)*
2. **`@csa/config`** (env) — one `loadEnv({extraPaths?})` replacing **5 duplicated `load-env.ts`** (~254 lines) + ai-assist's inline dotenv; absorb `env`/`requiredEnv` (from `@csa/mongodb/connection.ts`) and `envInt` (from `ai-assist/config.ts`).
3. **`@csa/headers`** — typed `CSA_HEADERS` constants + `readCsaContext(req)` / `applyCsaHeaders(headers, ctx)`, replacing **~30 stringly-typed `x-csa-*` sites** (bff, subgraphs, ai-assist, ~13 webapp routes). Most error-prone duplication in the identity path.
4. **`@csa/service-bootstrap`** — `startSubgraph({schema, port, readContext})` + `headerValue()` + a shared `/health` handler, replacing the Apollo bootstrap copy-pasted 4× (bff, ticketing, admin, commercetools) and the `headerValue` copied 3×. Adds `/health` to admin/bff/ticketing (only auth has one today).
5. **Consolidate ai-assist commerce clients** — merge `graphql-client.ts` + `client.ts` into one; fix the `AI_COMMERCE_SERVICE_URL` fallback mismatch (`""` vs `localhost:4000`); a shared `graphqlFetch()` error-shaping helper (used by ai-assist + `@csa/mongodb` test-connection). Decide if the legacy `/assist` route is still needed.

Also: **the docs app (`apps/documentation`) and marketing must consume `@csa/ui`** for theming — no separate palettes.

---

## P0 — Correctness / security bugs (found during audit)

- **auth & ticketing Dockerfiles miss the `@csa/mongodb` COPY** → image builds likely fail (admin does it right). Fix both to mirror admin.
- **`infra/gcp/main.tf:82,108` reference undefined `local.compute_sa_email`** → `terraform apply` broken. Define it from `var.project_number`.
- **admin trusts spoofable `x-csa-*` headers** (`index.ts:61`) → confirm the subgraph is private/identity-gated; document the trust boundary. (Ties to the top security finding in SECURITY-TENANCY.md: the whole trust boundary lives in the browser for ai-assist.)
- **auth login has no brute-force protection** (`http/auth.ts:15`) on a public Cloud Run service → add per-IP/account throttling + lockout.
- **ticketing silently loses data** to an in-memory fallback when `MONGO_URI` unset (`repository.ts:245`) → loud warn / hard-fail in prod.
- **admin `superadminOnly` allowlist fails open** (`index.ts:67`) → invert to default-deny / per-field capability.

---

## P1 — No-mock-data & hardcoding

- **`trackingUrlGenerator.ts:2`** `tracking.example.com` fake (dead code) — *cleanup task already spawned.*
- **`bff/local-schema.ts:16`** fabricates `status:"online"` for 8 services — remove or real probe.
- **ticketing `createdBy: "Current Agent"`** (`repository.ts:62`) fabricated actor → derive from context or null.
- **marketing CTA `mailto:hello@customersax.example`** (`Cta.tsx:4`) dead `.example` domain → real address/form.
- **`ORD-RC-` order prefix** hardcoded (`cart.resolvers.ts:210`) → project config (per-tenant).
- **Hardcoded `en-US` locale** in payment query (`order.resolvers.ts:79`) + currency format (`ai-assist/graphql-client.ts:65`) → derive from context.
- **Magic `limit: 500/50` caps** bypass `paging.ts` constants (`product/customer.resolvers.ts`) → name/document.
- **~12 webapp routes hardcode `'commercetools'`** instead of `BFF_COMMERCE_PLATFORM`.

---

## P1 — Infra / CI

- **Two competing Terraform stacks** — monolithic `infra/gcp` (wired to CI) vs **10 orphaned `apps/*/terraform`** (never applied). **Decide one**, then extract a shared `modules/cloud-run-service` (the per-app dirs are the blueprint) and `for_each` it. Do not keep both.
- **Fake multi-env** — everything hardcodes `csa-dev-*` regardless of branch; "prod" deploys to dev resources. Parametrize `NAME_PREFIX="csa-${ENVIRONMENT}"` or document single-env.
- **`pnpm test` is a green no-op** (no tests exist) — misleading CI signal.
- **Bitbucket CI is effectively dead** (branch triggers don't match real branches); **no PR validation on GitHub**. Delete `bitbucket-pipelines.yml` (if GitHub is SoT) and add a GitHub `ci.yml` (typecheck+lint+build on PRs).
- **4 tsconfigs bypass shared config** (`ai-assist`, `bff`, `webapp`, `marketing`) → `extends @csa/config-typescript` + local overrides.
- Minor: parametrize region/registry/commercetools-URLs in `scripts/*`; drop unused `firestore.googleapis.com` API; per-app `.dockerignore`.

---

## P1 — Testing (none exists)

Introduce a test runner + coverage, starting with pure logic: `bff selectCommerceService`/`parseFederatedServices`, `auth toPublicUser`/`projectsForUser`, `ticketing mapper` normalizers, `admin authorize`, `@csa/mongodb encrypt` round-trip, `commercetools mappers`. Add a behavioral eval harness for the ai-assist agent (house style). Wire into `ci.yml` so `pnpm test` stops lying.

---

## P2 — Structure / docs / consistency

- **admin `schema.ts` (~480 lines)** — split per domain (clients/projects/smtp/users/roles/ai) to match the repo layout.
- **marketing** — replace boilerplate README + `CLAUDE.md`; rename package `marketing` → `@csa/marketing`; prune create-next-app dead assets; **adopt `@csa/ui`** instead of its own CSS.
- Trim irrelevant "ported from ct-csa-standalone" provenance comments (`encrypt.ts:11`, `resolve-send-email-post-url.ts:5`).
- **`webapp → studio` rename** (owner request) — rename `apps/webapp` → `apps/studio`, package `@csa/webapp` → `@csa/studio`, update all references; verify build. (Wide mechanical rename — do as a discrete verified step.)
- Exception-handling consistency pass — ensure every service has uniform try/catch → rep-safe message + structured `logger.error`, and covers malformed input (e.g. auth malformed JSON → 400 not 500), upstream failures, and infra-down degradation.

---

## Done this session (for reference)
- Theme: light royal blue `#2563EB` + yellow, ~620 hardcoded colors → tokens (committed).
- `packages/ui` extracted; ai-assist LLM factory + config; `@csa/mongodb` collection-accessor factory + single decrypt + canonical `MONGO_URI`; commerce adapter docs. (committed)
- Removed dead Firebase config + 4 one-shot scratch scripts. (committed)
- `apps/documentation` (Fumadocs docs portal, consuming `@csa/ui`) — in progress.

## Execution order
P0 shared packages (1→5) → P0 correctness/security → P1 no-mock/hardcoding → P1 infra/CI decision → P1 testing → P2. Each behavior-preserving, verified live, committed to `customerSAX-redesign-v1`.
