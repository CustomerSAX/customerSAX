# CSA Engineering Standards — The Development Contract

> **Status:** Authoritative. This file is the contract all future development follows.
> Derived from a full verified audit of the codebase (not the docs). Where CLAUDE.md
> and this file disagree, **this file wins** and CLAUDE.md should be corrected.
>
> **North star (repo first law):** *No mock, hardcoded, or fabricated data — anywhere, ever.*
> A missing upstream value is shown honestly as null / raw-id, never as a plausible placeholder.

---

## 0. The one thing to internalize: two worlds

The codebase is **two disjoint worlds**. All new work lives in — and moves the second world toward — the first.

| | **Disciplined world** (follow this) | **Fabricated world** (do not extend; migrate off) |
|---|---|---|
| Where | `ai-assist` + BFF-backed `studio/src/app/api/*` routes + commercetools subgraph | `studio/src/features/*` admin slices (employees, companies, quotes, customers, orders, cart, reports) |
| Data | Real, via `bffQuery` / BFF; honest null fallbacks | Hardcoded `mock-*.ts` arrays, `Math.random()` business values, Unsplash stock images |
| Rule | This is the reference pattern | Every value here violates the first law — replace with the A3/A5 real-data path |

**Rule 0:** Never add a new feature by copying a `features/*` mock hook. Copy the `api/orders` / `api/customers/search` + `bffQuery` pattern instead.

---

## PART A — STANDARDS TO ENFORCE (rules + exemplar)

### A1 — Package naming `@csa/<dir>`
A package's `name` equals `@csa/` + its directory name. Exemplar: root `package.json` aliases.

### A2 — Contract → dist → subgraph build discipline
Platform-neutral GraphQL type defs live in `apps/commerce/contract/src/**/*.graphql.ts`; **every subgraph imports the built `dist/`**, never the source (`typeDefs.ts:1` re-exports `@csa/commerce-contract`).
**Rule:** after editing `contract/src`, run `pnpm --filter @csa/commerce-contract build` and confirm the field exists in `apps/commerce/contract/dist/graphql/*.js` before assuming it is live. (CLAUDE.md gotcha #2 — mechanical root: subgraph serves `dist/`, not `src/`.)

### A3 — The "ok vs error" discriminated union in studio API routes *(gold standard)*
Every BFF-backed route distinguishes *"backend reachable, genuinely empty"* from *"backend down."*
- Exemplar: `api/orders/route.ts:9` — `type BffResult = {ok:true; orders:any[]} | {ok:false; reason:string}`; genuine-empty → `{ok:true, orders:[]}`, unreachable → HTTP 502 + rep-safe message.
- Exemplar: `api/customers/search/route.ts` — with the doc comment: a caller must always tell *"doesn't exist"* apart from *"couldn't answer right now."*
**Rule:** new BFF-backed routes return this shape; malformed upstream (`!Array.isArray`) is an **error**, not an empty success.

### A4 — Absent fields are null, never fabricated
Exemplar: `customers/search/route.ts` sets `phone/orderCount/lifetimeValue = null` ("genuinely absent, not fabricated"); `orders/route.ts` uses `orderNumber || id`.
**Rule:** a missing upstream field is surfaced as `null` or a real-id fallback — never a plausible placeholder.

### A5 — `bffQuery()` is the single data path (ai-assist)
Exemplar: `apps/ai-assist/src/commerce/graphql-client.ts`. Every tool goes through it. Platform identity → `x-csa-commerce-platform`, project identity → `x-csa-project-key`; the LLM never knows the backend. `bffQuery` throws typed errors on `!res.ok`, GraphQL `errors[]`, missing `data`.
**Rule:** no tool issues its own `fetch`; every backend read/write flows through `bffQuery`. Tools return `{error}` **distinct from** `{total:0}` so a failure is never read as "no results."

### A6 — Manual resolver allowlist (commercetools)
`apps/commerce/commercetools/src/http/graphql/resolvers.ts` names every `Query`/`Mutation` field explicitly. A correct, exported resolver **silently never runs** if not listed here.
**Rule:** a new root field is added in **three** places — contract SDL → domain resolver → this allowlist. (See T1 for the guard we owe this.)

### A7 — commercetools update-action shape
Update actions are `{ actionName: { ...params } }`, never the REST `{ action:"x", ... }`. Always fetch `version` first (optimistic concurrency). Exemplars: `customer.resolvers.ts:151/166`, `order.resolvers.ts`, `cart.resolvers.ts`. `where` predicates are exact, case-sensitive (no substring without `all()/any()`).

### A8 — Never show raw errors to the rep
Internal `reason`/stack → `console.error` server-side; the rep-facing body carries only a calm generic message ("Unable to reach the commerce backend right now."). Exemplar: `orders/route.ts`.

### A9 — Zustand workflow-snapshot + tool-call-stream scrape
Steppers and free-form chat both emit the **same tool calls** through the same `/chat`; `ChatStream.tsx` scrapes the tool stream into one `ConversationStore` snapshot. This single-source-of-truth-for-dual-UX is a core design — preserve it.
**Rule:** terminal fields (`placedOrder`/`createdTicket`/`completed`) are deliberately never auto-cleared by the scrape. Any "start another X" control **must** call `useConversationStore.getState().set<X>Workflow(null)` before resetting local step (CLAUDE.md gotcha #5). *Known inconsistency: `CreateOrderStepper.startNew` delegates this reset to a parent handler instead of doing it locally like the ticket/return steppers — do not copy that; do it locally.*

### A10 — Meridian `m-*` design tokens
The design system lives at `apps/studio/src/ui/*` (aliased `@csa/ui`) — **not** a `packages/ui` (that doesn't exist; CLAUDE.md is wrong). UI uses `m-*` tokens (`m-primary`, `m-surface`, `m-text-muted`), never ad-hoc hex/Tailwind color literals.

### A11 — Shared strict TypeScript base
`configs/typescript/base.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`. Consumed as `@csa/config-typescript`.
**Rule:** never loosen per-package; extend the shared base.

### A12 — Graceful degradation for optional infra
Redis (working memory) and Mongo (episodic/sessions) are **optional**: absence degrades to null/no-op, never crashes the request path. Exemplars: `memory/working-memory.ts`, `packages/mongodb` repos.

### A13 — Secrets are env-derived and encrypted at rest
Per-tenant commerce credentials are AES-256-GCM encrypted (`packages/mongodb/src/encrypt.ts`), keyed by `SUPERADMIN_ENCRYPTION_KEY`, decrypted on demand; **prod fails closed** if the key is unset.
**Rule:** no plaintext credentials in Mongo; per-env config from env vars; prod fails closed on missing key material. *(Gaps to fix: SSO/SAML secrets currently plaintext — see SECURITY-TENANCY.md.)*

### A14 — Platform-neutral seam (do not break)
Callers speak one GraphQL contract; the backing commerce platform is selected purely by `BFF_COMMERCE_PLATFORM` / `x-csa-commerce-platform`. The LLM literally cannot name the backend.
**Rule:** never leak platform-specific types/logic above the subgraph. New platform = new subgraph implementing the contract, nothing else changes.

---

## PART B — VIOLATIONS & GAPS (ranked; each is a "do-not-repeat")

**SEV-1 — Fabricated data in `features/*` admin slices.** `mock-employees.ts`, `mock-companies.ts`, `mock-quotes.ts`, `use-customers.ts` (10 `INITIAL_*` seeds), `use-orders.ts`/`use-carts.ts` (`MOCK_AVAILABLE_DISCOUNTS`/`MOCK_SHIPPING_METHODS`/`MOCK_CATALOG_PRODUCTS` drive **live** discount/shipping logic), `use-reports.ts` (`getMockReportRows()` exported to **Excel** for the user). Migrate to A3/A5; delete the `NEXT_PUBLIC_USE_MOCK_ORDERS` flag with the mock path.

**SEV-1 — `Math.random()` for user-visible business values.** `use-orders.ts:964` randomizes *payment status*; `CustomerCreateView.tsx:78` invents a customer number; `CustomerDetailView.tsx:366` invents a cart id. Replace with real backend values. *(Contrast: minting a brand-new unique ticket/cart number is acceptable — but move those off `Math.random()` to a collision-safe source too.)*

**SEV-1 — `orders/route.ts mapOrder` breaks its own A3/A4 doctrine.** `'$45.00'` price fallback (28), hardcoded Unsplash image (29), `'SKU'` fallback (26); lesser: `'Guest'`, `state || 'Complete'`, `createdAt || now`. The reference route must not fabricate.

**SEV-2 — Hardcoded identity `agent@csa.local` fails *open*.** `system-prompt.ts:48` bakes it in with **all permissions true**; `AppShell.tsx:68` falls back to it as `role:"admin"` when session load fails. Wrong direction for enterprise — must fail closed.

**SEV-2 — No test coverage; CI green-check verifies nothing.** Zero `*.test.ts`. Root `test` = `pnpm -r --if-present test` → silently passes. `bitbucket-pipelines.yml` runs `pnpm test` = a green check that runs nothing.

**SEV-2 — Dev encryption key is a source-committed constant** (`Buffer.alloc(32,'dev-default-not-for-production-!')`), used when `NODE_ENV!=="production"`. Any non-prod deploy that forgets `NODE_ENV=production` "encrypts" with a public value. SSO OIDC secrets and SAML certs are stored **plaintext**.

**SEV-3 — Type erosion in studio** (~68 `any`; other packages ~0). **Lint is uneven** — `next lint` only in studio; for 11/12 packages "lint" == a second `tsc`. No shared ESLint ruleset.

**SEV-3 — No structured logging / tracing.** All `console.*`; no correlation id, no levels, no error sink (Sentry/OTel), no cross-hop tracing.

**SEV-4 — Config gaps.** `system-prompt.ts:53` `projectKey ?? "default"` silently targets the wrong project instead of failing. `NEXT_PUBLIC_USE_MOCK_ORDERS` should be deleted, not promoted to config.

---

---

## PART C — CONCEPTUAL INVARIANTS (same idea, different ingredients)

> **Read this correctly (owner intent, 2026-08-14):** customerSAX was built by a *different team, in a
> different construction* than the owner's personal stack — and that is kept as-is. The goal is **NOT** to make
> this code resemble any other repo or "look like the owner's." It is to keep the **conceptual layer** — concept,
> idea, thought — consistent across the portfolio, while writing **natively in customerSAX's own established idiom.**
> Same recipe-thinking; different ingredients. **The primary style guide for this repo is this repo** (Parts A/B —
> its own proven patterns). The invariants below are the cross-portfolio *concepts* to uphold, expressed through
> customerSAX's own mechanisms — never by importing another stack's mechanics. What matters is the delivered
> product and best practices, not whose kitchen it resembles.

### Stack Ruling (resolved 2026-08-14 — harden-first, standalone SaaS)
Three different constructions exist across the portfolio: (1) **metafy/journeyAX** = NestJS + REST `api/v1` + Mongoose + `{success,data}`; (2) **CT-CSA predecessor** = Next.js + MCP servers + `agent-connect` gateway; (3) **customerSAX (this repo)** = pnpm + Turborepo + Apollo GraphQL Federation + commercetools subgraph + Express `ai-assist` + `@ai-sdk`. **customerSAX keeps construction (3)** — it is a deliberate, different-team build; do not restack it toward (1). Only the **concept** transfers, honoured through customerSAX's own mechanism.

| Your house rule | customerSAX mechanism (honour the principle here) |
|---|---|
| HR-6 `{success,data,error}` envelope (REST) | GraphQL already carries `data`/`errors`; keep the studio API-route **`ok`/`error` discriminated union** (A3) as the envelope analog. Don't bolt a REST envelope onto GraphQL. |
| HR-23/25 mechanical tenant enforcement in `BaseRepository` (`orgId+projectId`, thrown if missing) | customerSAX uses **`clientId+projectKey`**. Enforce it mechanically at the data/subgraph layer, **derived from session, never the request body** (fixes S1/S3/S7). *Recommendation: keep `clientId/projectKey` naming (already threaded end-to-end); treat as the exact analog of `orgId/projectId`. Flag if you'd rather rename.* |
| HR-16/17 OpenAI-protocol provider registry, project→platform key fallback, BYO-key white-label | `ai-assist/src/llm` already does openai+anthropic; **extend to the registry shape** (per-project key → platform fallback, cache by `provider|baseURL|sha256(key)`), and add providers via the same interface. |
| HR-24 server-authoritative pricing ("LLM/client NEVER decides price"; rehydrate from source of record; `sourceOfPrice` marker) | Enforce via BFF/subgraph: money comes from commercetools, tax/discount from **project config**; unpriced SKU → `unavailable`, never guessed. (This is also A4.) |
| HR-10 "services never manage tokens; internal API key for service-to-service; circuit breaker" | Apply to the S2 fix: signed/verified inter-service propagation + an internal-call secret — not open `x-csa-*` header trust. |
| HR-11 correlation-id → request-logging → tenant-isolation middleware, order load-bearing | Add correlation IDs + structured logging (fixes SEV-3 observability). |

### Universal house principles (apply everywhere, stack-agnostic)
- **HR: Config over code — "the journey is DATA."** Tenant identity, business rules, pricing, enabled capabilities, model choice, prompt guidance load from **published project config per request**; an admin edit changes behaviour with **no deploy**. If a rule names a specific room/product/brand/phase, it belongs in config, not code.
- **HR: Graceful degradation is a requirement, not a nicety.** Every external dependency (Redis, Mongo, project-service, an LLM provider) degrades — never crashes the request path. Missing price → `unavailable`; provider key missing → fall back to platform OpenAI; config service down → base prompt.
- **HR: Mechanical tenant safety.** Isolation lives in a layer that *cannot be bypassed*, justified by "SOC2/GDPR — impossible to enforce retroactively." Tenant keys come from the authenticated session, never the body.
- **HR: Server is the source of truth against the LLM.** The model may only *arrange* real data — prices, identities, facts are rehydrated from services (ties to A4 + grounding).
- **HR: Default-deny + forced-projectKey-from-scope.** A tool/capability not explicitly allowed is never exposed; `projectKey` is always forced from the authenticated scope on forward. Multi-project users hit a **hard** `project_selection_required` refusal, not a prompt nudge.
- **HR: Strict TypeScript, `interface` for shape/DTO/config contracts, `any` only in error-normalisation glue.** Extend the shared base; never loosen per-package (= A11).
- **HR: kebab-case files with role suffixes** (`*.service.ts`, `*.controller.ts`, `*.dto.ts`, `*.schema.ts`, `*.client.ts`); Classes PascalCase, methods camelCase, DTOs `Create<X>Dto`, env vars SCREAMING_SNAKE_CASE, endpoints kebab-case.
- **HR: Comment the WHY with a war-story.** Every non-obvious decision opens with a purpose+rationale block; inline gotchas flagged `⚡ CRITICAL:` / `MANDATORY` / `NON-NEGOTIABLE`; config fields get trailing enum comments. This is your strongest fingerprint — keep it.
- **HR: PII discipline in logs.** Production logs tool **names + arg keys/result sizes only**, never values (they persist in Cloud Logging). Full values in dev only.
- **HR: Behavioral eval harness over classic unit tests for AI.** Verify agent behaviour end-to-end against running services (intent/capabilities/grounding/safety), env-configurable, CI-runnable — *this is how you "test" LLM code.* (Also addresses SEV-2's zero-coverage — start here for the agent.)
- **HR: Deploy = Cloud Run via `Dockerfile.template` + `cloudbuild.yaml`, Terraform IaC, GCP Secret Manager; frontends deploy to Vercel. `.env` at repo root wins over inherited env (`override:true`).**

---

## PART D — PREDECESSOR SAFEGUARDS TO RESTORE (from CT-CSA-Standalone)

> customerSAX was ported from CT-CSA and **regressed** on these hardened, production-grade safeguards.
> Restoring them IS the harden-first work (they map directly onto the security backlog and market P0). Ranked.

**D1 — Server-side confirmation-token flow *(restores S5; replaces the per-request boolean gate)*.** CT-CSA `curated-mcp-server/src/confirmations.ts`: destructive tools (`cancel_order`/`start_return`/`process_refund`) **never mutate on first call** — they mint `cfm_<uuid>` into Mongo `csa_ac_confirmations` with a **5-min TTL index**, return `{status:'requires_confirmation', summary, confirmationToken}`; a **single** executor `confirm_action` does `findOneAndDelete` (atomic single-use), verifies `userEmail`+`projectKey` binding, and **forces `projectKey` from the live request, never stored args**. Deliberately Mongo (not in-memory) because "a token created on one Cloud Run instance must be confirmable on another." This is the exact enterprise safeguard customerSAX weakened to a per-request in-memory `approvalGate` — trivially bypassed by prompt injection or a model that emits the write without the approval tool, and broken under autoscaling.

**D2 — The layered tool-adapter.** CT-CSA `app/api/chat/route.ts` + `agent-connect`: (a) **ACL write-tool stripping** — remove the tool entirely if the ACL lacks the permission ("even if the model ignores the prompt, it won't have the tool"); (b) **argument sanitization** — UUID-vs-orderNumber routing, store-scope stripping, **live-version refresh** before update (kills version conflicts); (c) **result truncation** tiers (4k history / 8k live / 25k list) + a `list_products` slimmer ("a single 'list all customers' returned 215k tokens"); (d) **cartId/ticketId recovery from history** so "Place order" works with empty model args; (e) **never-throw discipline** (an uncaught throw → `AI_MissingToolResultsError` crashes the turn). Directly prevents privilege bypass *and* context-window crashes.

**D3 — System-prompt discipline.** CT-CSA `lib/ai/system-prompt.ts`: static/dynamic **cache split** (~65% input-token savings), verified tool-name constants ("DO NOT guess/rename"), a 9-intent classifier, ~13 sub-playbooks with per-flow tool sequences + honesty rules, **per-outcome phrasing templates** (success/not-found/no-permission/system-error/emotional) and a **banned-jargon list** ("database, API, UUID, JSON, null, stack trace… if you wouldn't say it to a non-technical colleague, don't type it"). Restores the discipline that keeps raw CT errors/IDs from leaking to reps (ties to A8).

**D4 — 3-tier memory retention discipline.** CT-CSA `lib/memory/*`: working (Redis, 24h TTL, graceful-degrade), episodic (Mongo `csa_memory`, **atomic 30-day / 50-entry** retention pipeline, cross-agent repeat-contact awareness), semantic (Atlas Vector Search, background embedding worker). customerSAX kept working+episodic but should restore the **bounded retention** (no unbounded growth) and the semantic tier when ready.

**D5 — Default-deny source abstraction + forced-projectKey tenancy** (`agent-connect/src/sources/*`, `acl.ts`): each upstream implements `ToolSource.connect(scope) → {tools, call, close}`; two gates (context match → ACL); "a tool not listed is never exposed"; `projectKey` forced from scope; multi-project users get a hard refusal. This is the clean extension seam for adding Shopify/OMS/carrier tools later without weakening isolation.

---

## Definition of Done (every change, no exceptions)

1. **No fabricated data** reaches a user — missing = null/honest, per A3/A4.
2. **Real path exercised**, not just reasoned: curl subgraph → BFF → `/chat` for backend changes; drive the browser and read back rendered state/computed styles for UI. (CLAUDE.md: "Fixes must be verified live.")
3. **New root GraphQL field?** contract SDL + rebuild `dist/` + resolver + **allowlist** + BFF re-poll — all five (A2/A6, gotcha #3).
4. **New write action?** goes through the approval gate + a **server-authoritative** ACL check (not a client-supplied flag — see SECURITY-TENANCY.md).
5. **`pnpm typecheck` clean** for touched packages; no new `any`; extend `@csa/config-typescript`.
6. **Secrets** env-derived + encrypted at rest; fail closed in prod.
