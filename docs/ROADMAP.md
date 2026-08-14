# customerSAX — Enterprise Hardening & Build Roadmap

> **Status:** Authoritative execution plan. **Confirmed with the product owner (2026-08-14):**
> vision = *governed, cross-stack, enterprise AI resolution layer for commerce* (spot-on);
> near-term priority = **harden the foundation first**; audience = **standalone multi-tenant SaaS product**.
>
> Read with: [STANDARDS.md](engineering/STANDARDS.md) (how we build + house rules + predecessor safeguards D1–D5),
> [SECURITY-TENANCY.md](architecture/SECURITY-TENANCY.md) (S1–S9), [MARKET-ANALYSIS.md](product/MARKET-ANALYSIS.md) (P0–P3), [ARCHITECTURE.md](architecture/ARCHITECTURE.md).

## The thesis in one line
The security-hardening backlog **is** the market moat. For a product that executes *financial* writes, governance (audit, HITL, runtime RBAC, tenant isolation) is simultaneously the compliance gate for standalone-SaaS deals **and** the differentiation none of Gorgias/Sierra/Decagon fully own. So harden-first is not a detour from the product — it is the product's spine.

## Sequencing principle
Foundation → Governance → Discipline → Truth → Enterprise table-stakes → Wedge features. Each phase leaves the system shippable and closes named gaps (S# security, D# predecessor-restore, P# market, SEV# standards-violation). Nothing here requires restacking off GraphQL/pnpm (Stack Ruling, STANDARDS Part C).

---

## Phase 0 — Close the trust boundary *(the one that makes everything else meaningful)*
The whole security story fails while identity/permissions live in the browser. Do this first.
- **P0.1 Put `ai-assist` behind the session boundary** — proxy the chat stream through a Next route (or verify the session Bearer server-side); derive `userEmail`/`role`/ACL/`projectKey`/`clientId` from the **session, never the request body**. *(S1; ARCHITECTURE §2 asymmetry)*
- **P0.2 Fail closed on identity** — remove the `agent@csa.local` all-permissions default; no identity ⇒ refuse, not admin. *(S8; SEV-2)*
- **P0.3 Propagate `clientId` on the AI commerce path** so provisioned tenants stop silently falling back to the shared env project. *(S7 correctness+isolation)*
- **Exit:** a client cannot impersonate a tenant, escalate permissions, or read another user's history by editing the request body. Verified live (curl with forged body → rejected).

## Phase 1 — Governed writes + audit *(D1 + the agentic table-stake)*
- **P1.1 Restore the server-side confirmation-token flow (D1).** Mongo-backed, single-use (`findOneAndDelete`), 5-min TTL, `userEmail`+`projectKey`-bound; destructive commerce tools return `requires_confirmation` and never mutate on first call; a single `confirm_action` executor forces `projectKey` from the live request. Replaces the per-request `approvalGate`. *(S5; P0.3-market; SEV in ARCHITECTURE §5)*
- **P1.2 Per-action policy limits** enforced at runtime (refund ceilings, order-value thresholds, manager sign-off) — policy middleware validating each proposed write. *(S5; market P0.3)*
- **P1.3 Immutable, replayable action audit log** — every AI/commerce/financial action: actor (from session, not header), reasoning, data accessed, tool + args, guardrail fired, approver, outcome. Doubles as the compliance artifact **and** the future billing source-of-truth. *(S4; market P0.2 + pricing thesis)*
- **Exit:** no financial write executes without a redeemed token + policy check, and every write is on an immutable ledger.

## Phase 2 — Inter-service trust + runtime RBAC *(S2, S3)*
- **P2.1 Stop trusting `x-csa-*` headers** — signed/verified propagation (gateway-only shared secret or verifiable token; mTLS later); apply your HR-10 "internal API key + circuit breaker." *(S2)*
- **P2.2 Wire the dead RBAC matrix into an authoritative server-side check** on every write — the `csa_roles` 13-module matrix currently exists but is never read; collapse the client-side `isWriter` boolean into a real session-derived permission decision. *(S3)*
- **P2.3 Restore the layered tool-adapter (D2)** — ACL write-tool stripping (tool absent if unpermitted), argument sanitization + live-version refresh, result-truncation tiers, never-throw discipline. *(D2; prevents both bypass and context-window crashes)*

## Phase 3 — Agent discipline + memory *(D3, D4)*
- **P3.1 Restore system-prompt discipline (D3)** — static/dynamic cache split, per-outcome phrasing templates, banned-jargon enforcement (no raw errors/IDs to reps), verified tool-name constants. *(A8; ~65% token savings)*
- **P3.2 Restore bounded memory retention (D4)** — atomic 30-day/50-entry episodic pipeline; keep graceful Redis degradation; add the semantic (Atlas Vector) tier when justified.
- **P3.3 Behavioral eval harness** for the agent (intent/capabilities/grounding/safety), CI-runnable — begins closing the zero-test gap the house-style way. *(SEV-2; HR eval)*

## Phase 4 — Kill the fabricated world *(SEV-1 — the first-law breach)*
Migrate every `features/*` admin slice off mock data onto the real BFF path (A3/A5). Priority order by user-visible harm:
- **P4.1** `use-orders.ts`/`use-carts.ts` — `MOCK_*` discount/shipping/catalog tables drive **live logic**; random payment status; `mapOrder` `'$45.00'`/Unsplash/`'SKU'` fabrications. Replace with BFF reads + honest nulls; delete `NEXT_PUBLIC_USE_MOCK_ORDERS`.
- **P4.2** `use-reports.ts` — stop exporting fabricated rows to Excel.
- **P4.3** employees/companies/quotes/customers seeds → real data or explicitly-labelled empty states.
- **Exit:** no fabricated value reaches a rep or a customer anywhere. *(First law satisfied repo-wide.)*

## Phase 5 — Enterprise table-stakes for standalone SaaS *(market P0/P2)*
- **P5.1 Encryption completeness (S6)** — encrypt SSO OIDC secrets + SAML certs; fail closed on missing key in **any** non-dev env; unify the two decrypt paths; kill the source-committed dev key for staging.
- **P5.2 SSO (SAML/OIDC) + SCIM provisioning; harden sessions** (CSRF beyond `sameSite`, idle timeout, rotation on privilege/project change). *(market P0.1)*
- **P5.3 Tenant-isolation correctness (S7)** — scope `findProjectById`/`deleteProject` by `clientId`; replace `AsyncLocalStorage.enterWith` with scoped `run`.
- **P5.4 Shared rate-limit store (S9)**, structured logging + correlation IDs + error sink (SEV-3), and a **real CI test gate** (the current `pnpm test` runs nothing). *(SEV-2/3)*
- **P5.5 Compliance posture** — SOC 2 Type II controls, GDPR/CCPA DPA, data residency, PCI scope isolation (tokenized payment calls only, never raw card data). *(market P0.1/P0.4)*
- **P5.6 Contract/resolver safety** — a schema-diff test asserting every contract root field has a bound resolver (kills the silent-allowlist foot-gun, gotcha #1); fix contract `dist/` build fragility (gotcha #2).

## Phase 6 — The wedge: deep, governed, cross-stack commerce *(market P1)*
- **P6.1 Implement a second commerce adapter** (Shopify or an OMS) against the existing contract — proves the platform-agnostic story that Gorgias (Shopify-only) can't match. Use the D5 default-deny source abstraction as the extension seam.
- **P6.2 Deep pre-built commerce actions** across the full stack (returns/refunds/reships/address-change/cancel + carriers + loyalty), each governed by the D1 token + P1.2 policy.
- **P6.3 Trust-first metering** — platform fee + transparent, **capped/alerted, action-confirmed** usage, billed off the P1.3 audit ledger; publish honest per-intent action-success rates (never inflated "resolution" claims).
- **P6.4 Clean context-preserving escalation/handoff** as a designed path (avoid the deflection-loop complaint).

## Phase 7 — Expansion (moat)
Omnichannel (email/chat/voice/WhatsApp/SMS/social); buyer-configurable model choice + hallucination/PII controls; **JourneyAX lifecycle bundle** (same engine pre-/post-purchase — land-and-expand). *(market P2/P3)*

---

## What "done" looks like per phase
Every phase ends **verified live** (curl subgraph → BFF → `/chat`; drive the browser for UI) per the repo's "fixes must be verified live" law — never reasoned-only. No phase ships fabricated data. Every new write goes through the D1 token + a session-derived RBAC check.

## Open decisions (non-blocking; my default in bold, override anytime)
1. **Tenant field naming:** keep **`clientId+projectKey`** (already threaded end-to-end) as the analog of your house `orgId+projectId`, vs. rename to match house style. *Default: keep.*
2. **Confirmation-token home:** restore D1 as an **in-`ai-assist` Mongo-backed store** (customerSAX has no MCP-server layer like CT-CSA), vs. reintroduce a curated-MCP-server. *Default: in-`ai-assist`, same mechanism.*
3. **Second adapter for P6.1:** **Shopify** (largest market, direct Gorgias contrast) vs. an OMS. *Default: Shopify.*
