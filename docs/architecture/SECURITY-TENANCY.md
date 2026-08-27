# CSA — Security, Multi-Tenancy & Authorization Model

> **Status:** Authoritative, verified against source. This layer (`apps/auth`, `apps/admin`, `packages/mongodb`)
> is **entirely undocumented in CLAUDE.md**. For an enterprise SaaS product these findings are the gating work —
> and they map 1:1 onto the market's enterprise table-stakes (see MARKET-ANALYSIS.md §4). **Security hardening = the moat.**

## 1. Identity (`apps/auth`, :4360)

Dependency-free `node:http` server. Opaque **bearer session tokens** (`randomBytes(32).base64url`, stored SHA-256-hashed), bcrypt passwords, Mongo `csa_sessions` with a TTL index, revoke via `revokedAt`, 8h default. Sound design. Endpoints: `POST /sessions` (login), `GET /sessions/current`, `POST /sessions/current/project` (select active project), `DELETE /sessions/current`.

**Studio consumption is correct:** browser never sees the auth service; Next routes proxy it, token in an httpOnly cookie `csa_session` (`secure` in prod), and `projectScopedBffFetch`/`getCurrentUser` re-derive identity server-side per call. **This path's identity is real.**

## 2. Control plane (`apps/admin`, :4370)

Apollo subgraph, federated. `secureAdminResolvers()` wraps every `admin*` field: `superadmin` → unrestricted; `admin` → must match `clientId`/`projectKey`/`userEmail`, blocked from a `superadminOnly` allowlist (client/project CRUD, connection tests), may only touch **its own** `clientId`; else denied. Mutations audit-logged. **This is the only place in the system with real server-side authorization** — but it trusts `x-csa-user-role`/`x-csa-client-id` **headers** (safe only because the sole legitimate caller derives them from the session; see §5).

## 3. Tenant model (logical isolation only)

- **Client/tenant** = `CsaClient` (`csa-admin.csa_clients`): name, slug, status, `ssoConfig`.
- **Project** = `CsaProject` (`csa-admin.csa_projects`, keyed `{clientId, projectKey}`): `platform` + **encrypted** commerce credentials.
- **User** = `csa-agents.csa_users`: `projects: [{clientId, projectKey, role}]` membership (a user may span clients).

**Scoping path (studio):** session `activeProjectKey/activeClientId` → `projectScopedBffFetch` sets `x-csa-project-key`/`x-csa-client-id` → BFF forwards → commercetools subgraph reads headers into `AsyncLocalStorage` → `resolveCommercetoolsProject` → `findStoredCommercetoolsProject(clientId, projectKey)` → decrypts secret → connects to that tenant's commercetools.

**Encryption at rest:** AES-256-GCM (`packages/mongodb/src/encrypt.ts`, format `iv:authTag:ciphertext`), keyed by `SUPERADMIN_ENCRYPTION_KEY`; applied to CT client secret, Shopify/BigCommerce tokens, SMTP passwords. **Prod fails closed** if key unset. Two duplicated decrypt paths (`encrypt.ts` + `project-store.ts`) must stay key-compatible.

## 4. Authorization — modeled but NOT enforced

- **Rich RBAC exists as dead data.** `admin/src/roles/repository.ts` defines per-client+project roles with a 13-module × view/create/update/delete matrix. It is **CRUD-managed via the admin API and never read by any runtime check.** Aspirational.
- **Runtime ACL is coarse & client-derived.** `csa-assistant/index.tsx:59` — `isWriter = role ∈ {agent,admin,superadmin}` → sets *every* `can*` flag true. Role collapses to `agent|admin|superadmin`.
- **The AI write-gate trusts client input.** `tickets.ts` checks `ctx.canCreateTickets` — but `ctx` is populated from the **request body** the browser supplies (`use-csa-chat.ts` sends the whole `sessionContext`). The "server-side" permission check reads a client-controlled value.

## 5. Tenant isolation — real gaps (ranked)

1. **`ai-assist` has NO authentication.** Browser calls it directly with `userEmail`/`role`/`projectKey`/ACL flags in the body. → **tenant impersonation** (any `projectKey`), **privilege escalation** (all `can*` true, or the fail-open `agent@csa.local` default granting all perms), **IDOR on history** (`GET /chat`,`/sessions` keyed on an unauthenticated `userEmail` query param → read anyone's conversations).
2. **Services trust `x-csa-*` headers unverified.** BFF + every subgraph read tenant identity **and role** from headers. Anyone reaching :4000/:4310/:4370 can send `x-csa-user-role: superadmin` for a victim `clientId`. No mTLS, signed header, or shared secret.
3. **AI path silently breaks isolation.** `bffQuery` forwards `x-csa-project-key` but **not** `x-csa-client-id`; `findStoredCommercetoolsProject` requires `clientId` → provisioned tenants fall back to the single **env** project. Correctness *and* isolation failure.
4. **`AsyncLocalStorage.enterWith`** (not scoped `run`) in the Apollo context risks tenant context bleed across concurrent requests on a reused execution context.
5. **Logical, not physical, isolation.** All tenants share Mongo DBs and one `MongoClient`; separation is a `clientId` filter. `findProjectById`/`deleteProject` take a bare `id` with **no clientId scoping** — cross-tenant hole if the caller isn't otherwise constrained.

## 6. Secrets & config gaps

- **SSO OIDC `clientSecret` and SAML `idpCertPem` stored PLAINTEXT** (`clients/repository.ts` writes `ssoConfig` unencrypted). Inconsistent with the rest; real secret-at-rest gap.
- **Dev key is a source-committed constant** (`Buffer.alloc(32,'dev-default-not-for-production-!')`) when `NODE_ENV!=="production"`. Any non-prod deploy forgetting `NODE_ENV=production` "encrypts" with a public value.
- Arbitrary-length keys silently padded/truncated to 32 bytes (weak keys accepted).
- `SEED_SECRET=csa-seed-2024` in `auth/.env.example` — guessable seeding pattern.

## 7. Audit — thin

Only admin-subgraph mutations logged (`audit/repository.ts`), actor from a **forgeable header**. No audit for logins, project switches, commerce/ticket writes, or **AI actions** — the last is the one an agentic financial-write product most needs, and is a hard market table-stake.

---

## Enterprise-hardening backlog (this is the P0 spine of the roadmap)

| # | Gap | Fix | Market driver |
|---|---|---|---|
| S1 | ai-assist unauthenticated & client-trusting | Put ai-assist behind the session boundary (proxy via a Next route, or verify the session Bearer server-side); derive `userEmail`/`role`/ACL/`projectKey`/`clientId` from the **session**, never the body | Tenant isolation; the whole trust story |
| S2 | Inter-service header trust | Signed/verified propagation (mTLS, gateway-only shared secret, or a verifiable token) — not network hope | Tenant isolation |
| S3 | RBAC modeled but dead | Wire the `csa_roles` matrix into an **authoritative server-side** check on every write | RBAC table-stake |
| S4 | No audit of AI/commerce/financial actions | **Immutable, replayable action log**: action + reasoning + data accessed + guardrail fired + approver | Compliance artifact **and** potential billing source-of-truth |
| S5 | Ungoverned commerce writes | Hard in-execute approval gate + **per-action policy limits** (refund ceilings, manager sign-off) enforced at runtime; rollback/circuit-breaker | HITL on money-moving actions — the #1 agentic failure mode |
| S6 | Encryption gaps | Encrypt SSO/SAML secrets; fail closed on missing key in **any** non-dev env; unify decrypt paths | SOC2 / secret-at-rest |
| S7 | Isolation correctness | Propagate `clientId` on the AI path; scope `findProjectById`/`deleteProject` by `clientId`; replace `enterWith` with scoped `run` | Tenant isolation |
| S8 | Fail-open identity | Remove `agent@csa.local` all-perms default; **fail closed** on missing identity | Least privilege |
| S9 | In-process rate limit | Move to shared store (Redis) for horizontal correctness | Availability/abuse |

**PCI note:** the moment refunds/payments are executed, keep customerSAX **out of raw card scope** — tokenized calls through the payment stack only.
