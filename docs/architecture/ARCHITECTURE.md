# CSA (customerSAX) — Architecture Reference

> **Status:** Authoritative, verified against source (not docs). Supersedes CLAUDE.md's Layout section.
> pnpm workspace + Turborepo · Node 20 / pnpm 9.6.0.

## 0. Doc-vs-reality drift (correct these mental models first)

| CLAUDE.md / README says | Reality |
|---|---|
| Active branch `feature/ai-assistant` | Working branch has been `main` and `customerSAX-deploy` at different times — **branch hygiene is messy**; confirm before committing. |
| Layout omits them | **`apps/admin`** (`@csa/admin`, :4370) and **`apps/auth`** (`@csa/auth`, :4360) exist and are load-bearing. |
| `packages/ui` = Meridian design system | **No `packages/ui`.** Design system lives at `apps/webapp/src/ui/*`, aliased `@csa/ui`. Only workspace package is `packages/mongodb`. |
| `apps/tickets-mcp` placeholder | Does not exist. |
| AI Assist uses a "Vercel AI Gateway / CSA provider router"; supports grok/xai | Direct `@ai-sdk/openai` + `@ai-sdk/anthropic` with `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`. **No gateway. `LlmProvider` = `"openai" | "anthropic"` only — grok/xai not implemented.** |

CLAUDE.md's **gotchas** remain accurate and verified; its **layout/branch/LLM** claims are stale.

## 1. Service inventory (verified)

| App | Package | Port | Framework | Role |
|---|---|---|---|---|
| webapp | `@csa/webapp` | 3000 | Next.js App Router | Rep console + proxy layer (`app/api/*`) |
| ai-assist | `@csa/ai-assist` | 8080 | Express | LLM chat orchestration, tools, memory |
| bff | `@csa/bff` | 4000 | Apollo Gateway | Federated GraphQL supergraph |
| auth | `@csa/auth` | 4360 | **plain `node:http`** | Login, sessions, project selection (REST, not federated) |
| admin | `@csa/admin` | 4370 | Apollo subgraph | Superadmin: clients, projects, roles, AI settings, audit |
| ticketing | `@csa/ticketing` | 4350 | Apollo subgraph | Mongo-backed tickets |
| commerce/contract | `@csa/commerce-contract` | — lib | `tsc`→`dist/` | Platform-neutral GraphQL SDL + TS types |
| commerce/commercetools | `@csa/commerce-commercetools` | 4310 | Apollo subgraph | **Only implemented** commerce adapter |
| commerce/{shopify,bigcommerce,sfcc} | … | 4320/4330/4340 | Apollo subgraph | **Schema-only placeholders** |
| packages/mongodb | `@csa/mongodb` | — lib | raw TS | Shared Mongo repos + field encryption |

Every backend binds `0.0.0.0` under Cloud Run (`K_SERVICE` set), else `127.0.0.1`.

## 2. Runtime call graph (a real chat request)

```
Browser (@ai-sdk/react useChat)
  └─ POST http://localhost:8080/chat   ⚠️ DIRECT to ai-assist, bypassing the Next proxy
        ai-assist  routes/chat.ts  streamText loop (contextStorage.run)
          ├─ bffQuery ─► BFF :4000/graphql  (x-csa-commerce-platform + x-csa-project-key)
          │                └─ ApolloGateway → subgraph: commercetools:4310 | ticketing:4350 | admin:4370
          ├─ Redis   (working memory)
          └─ MongoDB (chat session + episodic memory)
```

**Critical asymmetry:** the **chat stream POST goes browser → ai-assist directly** (`use-csa-chat.ts:54`, `NEXT_PUBLIC_AI_ASSIST_URL`), so ai-assist receives identity/ACL/projectKey from the **client body**. All *other* data (`/api/orders`, `/api/tickets`, history, memory) proxies through the Next server, which injects server-derived session identity the browser can't forge. This split is the root of the top security finding — see SECURITY-TENANCY.md.

## 3. The commerce contract pattern (the platform-neutral seam)

- Contract is **build-only**: `src/graphql/*.graphql.ts` (`gql`-tagged, federation-annotated SDL) → `dist/`. Subgraphs import `@csa/commerce-contract` → resolves to `dist/index.js`. **Subgraph serves `dist/`, not `src/`** → mechanical root of gotcha #2.
- **Gotcha #1 — manual resolver allowlist:** `commercetools/src/http/graphql/resolvers.ts` names every root field explicitly. Unlisted resolver silently never binds.
- **Gotcha #2 — dist staleness:** editing `contract/src` under a running `tsx watch` keeps the old SDL until `pnpm --filter @csa/commerce-contract build`. Verify by grepping `contract/dist/graphql/*.js`.
- **Gotcha #3 — BFF poll:** `IntrospectAndCompose({ pollIntervalInMs: 10_000 })` in `bff/src/server/federation.ts`. Without it, new subgraph fields are unreachable until restart. Keep it.
- **A new root field touches 5 places:** contract SDL → rebuild dist → domain resolver → allowlist → BFF re-poll. (Then: ai-assist tool GraphQL string, webapp proxy mapper / ChatStream scrape.)

## 4. BFF federation

`buildGateway` (`federation.ts`): parses `FEDERATED_SERVICES` (default = commercetools + ticketing + admin). `selectCommerceService` keeps all non-commerce subgraphs + **exactly one** commerce subgraph matching `BFF_COMMERCE_PLATFORM` (so multiple adapters can be declared without schema collision; `salesforce↔sfcc` aliased). `RemoteGraphQLDataSource.willSendRequest` stamps `x-csa-commerce-platform`, `x-csa-project-key`, `x-csa-client-id`, `x-csa-user-role`, `x-csa-user-email` onto every subgraph call from `GatewayContext`.

**⚠️ Risk:** `ai-assist/.env.example` sets `AI_COMMERCE_SERVICE_URL=http://localhost:4310/graphql` (the subgraph), while `bffQuery` defaults to `:4000` (BFF). Configured per the example, the LLM **bypasses federation** (loses ticketing/admin) and only works because the commercetools subgraph serves the same field names. The webapp's `api/tickets/route.ts` explicitly forbids calling subgraphs directly. **Resolve to always go through the BFF.**

## 5. ai-assist `POST /chat` lifecycle (`routes/chat.ts:63`)

1. Destructure `{messages, context, sessionId, provider}`. ACL defaults least-privilege (reads `true`, **writes `false`**).
2. Rate limit by `userEmail` — **in-process** sliding window 60/hr (⚠️ doesn't survive multiple Cloud Run instances).
3. `loadOrCreateSession` (Mongo, non-fatal). Inject Redis working memory.
4. **Two-block prompt:** Block 1 = `STATIC_SYSTEM_PROMPT` (~420 lines) with Anthropic `cacheControl: ephemeral` (prompt-cache savings); Block 2 = `buildDynamicPrompt` (user, role, ACL block, page-context, working memory) — never cached.
5. `buildChatTools()` = commerce (20 tools) + ui-tools (11 render-only) + tickets (7), sharing a per-request `approvalGate`.
6. `streamText` inside `contextStorage.run(sessionCtx)` so tools read ACL/projectKey via `AsyncLocalStorage`. `stopWhen`: `stepCountIs(20)` OR any step whose results include `action_approval`.
7. `onFinish`: first `update_ui_state` → Redis working memory (24h); user+assistant turns → Mongo `csa_chat_sessions`.

**Approval gate (defense-in-depth, two layers):** (1) same-step — `action_approval` sets `approvalGate.pending=true`; write tools bail with `APPROVAL_GATE_ERROR`; (2) cross-step — `stopWhen` ends the request after an approval card, so the write happens only on the **next** user turn after the rep clicks Approve (`[approved-action]` message). **Caveat:** the gate is wired to ticket tools; commerce destructive tools (`place_order`/`cancel_order`/`start_return`) rely on prompt instruction + the `stopWhen` loop-break, not a hard in-execute gate. ACL is checked inside each write tool — but from the **client-supplied** `ctx` (see SECURITY-TENANCY.md §4).

## 6. Memory tiers

- **Working** — Redis hash `session:wm:{sessionId}`, live goal/intent/sentiment/strategy, 24h TTL, degrades to no-op without `REDIS_URL`.
- **Episodic** — Mongo `csa_memory`, one doc per `(userEmail, projectKey)`, 30-day / 50-entry cap. Repeat-contact awareness.
- **Chat sessions** — Mongo `csa_chat_sessions`, powers History panel; in-memory fallback without `MONGO_URI`.

## 7. Webapp

- **Proxy layer** (`app/api/*`): every browser data call goes through a Next route that injects server-side session identity (`projectScopedBffFetch` fetches `auth/sessions/current`, requires an active project, sets project/client headers). `api/graphql` is the generic BFF passthrough. Policy: **never call a subgraph directly — always via BFF.**
- **csa-assistant feature:** `useChat` transport → ai-assist; sessionId in localStorage; approvals prefixed `[approved-action]`.
- **The scrape pattern (core design):** `ChatStream.tsx` walks the tool-call stream and reconstructs one `ConversationStore` snapshot (`orderWorkflow`/`ticketWorkflow`/`returnWorkflow`). **Guided steppers and free-form chat emit the same tools through the same `/chat`; the scrape rebuilds the same snapshot regardless of which drove it — one execution path, one state shape.** Steppers derive their whole visible state from the snapshot.
- **Gotcha #5:** terminal fields never auto-clear; "start another X" must null the workflow first. `CreateOrderStepper.startNew` delegates this to a parent handler (fragile) — ticket/return steppers do it locally (correct).

## 8. Deployment & infra

- **CI (`bitbucket-pipelines.yml`):** node:20, install → parallel `test / typecheck / lint / build`. Triggers: all PRs + pushes to `main`/`develop`. **No deploy stage. `test` runs nothing (see STANDARDS §B).** Branch names in the pipeline don't match the actual working branches — gate coverage is suspect.
- **Hosting:** webapp on **Firebase Hosting** (Next SSR, `us-central1`). Backends on **Cloud Run** (each has its own `Dockerfile` + `terraform/`). `infra/gcp` Terraform declares Cloud Run, Secret Manager, Cloud SQL, Firestore, Cloud Storage, BigQuery (starter-grade). Commerce adapters deploy as separate Cloud Run services.
- **Data:** MongoDB (`csa-admin`, `csa-agents`, `csa-tickets`, chat/memory), Redis (working memory), commercetools SaaS.

## 9. Assessment

**Strengths:** clean platform-neutral seam (LLM can't name the backend); single source of truth for dual UX (steppers + chat via one tool path); defense-in-depth approval model; uniformly graceful degradation; prompt-cache-aware system prompt; server-side identity injection on the *proxied* paths.

**Risks (feed the roadmap):**
1. Manual resolver allowlist — silent-failure foot-gun, no compile/test guard → **owe a schema-diff test** (every contract root field has a bound resolver).
2. `dist/` staleness — ship both `src/` and `dist/`; fragile manual rebuild → project-reference build or contract `tsc --watch`.
3. ai-assist→subgraph vs →BFF inconsistency (§4).
4. **Chat stream bypasses the proxy → ai-assist trusts client-supplied identity/ACL** (top security issue).
5. In-process rate limiting won't scale horizontally.
6. Stepper reset inconsistency (gotcha #5, order stepper).
7. Significant doc drift.
8. Three placeholder commerce adapters — multi-platform is architecturally real but only commercetools is built.

**Load-bearing seams to bookmark:** `commercetools/.../resolvers.ts` (allowlist), `bff/src/server/federation.ts` (selection+poll), `ai-assist/src/routes/chat.ts` (orchestration), `ai-assist/src/chat/system-prompt.ts` (agent behavior), `webapp/.../ChatStream.tsx` (scrape/state).
