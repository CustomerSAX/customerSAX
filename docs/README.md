# customerSAX — Documentation Index

Authoritative, code-verified reference for building customerSAX into an enterprise, standalone multi-tenant SaaS.
These docs **supersede CLAUDE.md** where they disagree (CLAUDE.md's layout/branch/LLM claims are stale — see ARCHITECTURE §0).

| Doc | What it's for |
|---|---|
| [ROADMAP.md](ROADMAP.md) | **Start here.** The sequenced harden-first build plan (Phase 0→7), tying security + predecessor-restore + market into one execution order. |
| [engineering/STANDARDS.md](engineering/STANDARDS.md) | The development contract: the "two worlds", rules A1–A14, violations by severity, **House Rules (Part C — how the owner builds)**, **Predecessor safeguards to restore (Part D)**, Definition of Done. |
| [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Verified system model — services/ports, the contract→federation seam, the ai-assist pipeline, the scrape pattern, deployment, doc-drift corrections. |
| [architecture/SECURITY-TENANCY.md](architecture/SECURITY-TENANCY.md) | The (undocumented) auth/tenancy/authorization layer + the S1–S9 hardening backlog. |
| [product/MARKET-ANALYSIS.md](product/MARKET-ANALYSIS.md) | Competitor landscape + complaints, enterprise table-stakes, pricing thesis, P0–P3 gaps. Mission input. |

## Confirmed direction (2026-08-14)
- **Vision:** governed, cross-stack, enterprise AI **resolution** layer for commerce — "resolve, don't deflect," human-in-the-loop on financial writes, platform-agnostic, paired with JourneyAX across the lifecycle.
- **Near-term priority:** **harden the foundation first** (trust boundary, governed writes, audit, runtime RBAC, tenant isolation).
- **Audience:** standalone multi-tenant SaaS product.

## The one mental model to keep
The codebase is **two worlds**: the disciplined CSA-Assistant path (build like this) and the fabricated `features/*` admin slices (migrate off). And the **trust boundary currently lives in the browser** (ai-assist takes identity/permissions from the request body) — closing that (Phase 0) is what makes every other guarantee real.
