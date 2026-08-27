# customerSAX — Product & Integration Roadmap

> Concrete, architecture-grounded designs for the feature asks that are real builds (multi-session), so they're
> actionable, not hand-waved. The north star: a CSR sees the **entire customer story in one place** — order +
> customer + ticket + CRM + ERP intel — and resolves it with governed AI. Flat UI, real data (no-mock law), same
> blue/yellow theme. Prioritized; each ties to the existing adapter/BFF architecture.

## 1. CRM + ERP adapters (the "all in one place" foundation) — HIGH
The commerce **platform-neutral adapter seam** (contract → per-platform subgraph → BFF federation) is the exact
pattern to extend beyond ecommerce:
- **New contract domains** in `apps/commerce/contract` → generalize to `apps/integrations/contract` (or add `crm.graphql.ts`, `erp.graphql.ts`): `CrmContact`, `CrmAccount`, `CrmActivity`; `ErpCustomer`, `ErpInvoice`, `ErpFulfillment`.
- **New subgraph adapters** (same shape as `commercetools`): `crm-salesforce` / `crm-hubspot` / `crm-zendesk`; `erp-netsuite` / `erp-sap`. Each implements the neutral contract; selected by an env like `CRM_PLATFORM` / `ERP_PLATFORM` (mirroring `BFF_COMMERCE_PLATFORM`). Federated into the BFF exactly like commerce.
- **Unified "Customer 360" resolver** at the BFF/studio layer: one query stitching order (commerce) + tickets (ticketing) + profile/activity (CRM) + invoices/fulfillment (ERP) for a customer → the single-pane CSR view.
- Governed by the same tenant isolation (`clientId`/`projectKey` headers) + the AI tool layer (ai-assist gets `crm_*`/`erp_*` tools via `bffQuery`, same as commerce).
- **First slice:** one CRM adapter (HubSpot — good free API) + the Customer-360 aggregation, stubbing ERP.

## 2. Real dashboard (kill the fabricated KPIs) — HIGH (no-mock law)
`features/dashboard/Dashboard.tsx` currently hardcodes KPIs, the work queue, and "online" service health — a
SEV-1 no-mock violation. Replace with real aggregations:
- **Open Tickets / SLA At-Risk** → real counts from ticketing (`ticketPage` + SLA fields; 74 real tickets exist).
- **Work Queue** → real open tickets, sorted by priority/SLA.
- **Orders Reviewed / AI Resolved** → real commerce + ai-assist session metrics.
- **Service Health** → a real reachability probe (each subgraph `/health` or a BFF `__typename` ping), not a hardcoded `"online"`. Show honest `degraded`/`down`.

## 3. Notifications — MEDIUM
- A `notifications` collection (per user/tenant) + types: `sla_breach`, `ticket_assigned`, `order_exception`, `mention`, `approval_needed`.
- **Producers:** the workflow engine (SLA timers), ticket assignment, commerce exception watchers.
- **Delivery to studio:** SSE stream (reuse the proven ai-assist SSE pattern) or short-poll; the topbar bell + a dropdown. Mark-read, filters.
- Server-derived identity via the trusted proxy (same as chat) — no client-supplied user.

## 4. Workflow / resolution engine — MEDIUM (the CSR core)
The customerSAX vision's "resolution journey" made real:
- **Ticket state machine** (Open → Understand → Identify → Retrieve context → Decide → Execute → Verify → Resolve → Close) with transitions + audit (the old CT-CSA app had this vocabulary).
- **SLA timers** per priority → drive notifications + the "SLA At-Risk" KPI.
- **Routing/assignment** (round-robin / skill / load) — `agent-registry` already exists.
- **Approval gates** for sensitive actions (refunds/cancels) — the idempotency + policy layer is already built; surface it as a workflow step with the human-in-the-loop card.

## 5. Marketing site + open-source CMS — MEDIUM
- **CMS choice: Payload CMS** — open-source, self-hostable, **Next-native** (fits `apps/marketing`/Vercel), block-based content (hero, feature blocks, video, images, testimonials, integration story, trial CTA) → exactly the "fluid, push weekly" model requested. (Alternatives: Directus, Strapi, Keystone — Payload wins for Next + blocks.)
- **Integration:** Payload as a headless source; `apps/marketing` renders pages from Payload blocks; content editable daily/weekly from the Payload admin, no code deploy.
- **Content:** business-story-first (not technical) — the resolution-value narrative, integrations (ticketing/CRM/ERP/ecommerce), a **trial (7/30-day)** flow. Same blue/yellow theme + `@csa/ui` tokens; flat/fluid design (videos, images, blocks).
- **Trial/onboarding:** self-serve signup → tenant provisioning (the superadmin/project model already exists) → guided connector setup (commerce/CRM/ERP/ticketing).

## Sequencing recommendation
Real dashboard (2) + flat UI [in progress] first (visible, no-mock compliance) → CRM adapter + Customer-360 (1) [the differentiator] → workflow (4) + notifications (3) [the CSR loop] → marketing + CMS (5) [GTM]. Each behind the existing tenant-isolation + governed-write layers.

## Reality notes
- CRM/ERP adapters, workflow, notifications, and the CMS/marketing rebuild are each multi-session builds; this doc is the plan, not a claim they're done.
- Live commerce data still needs `SUPERADMIN_ENCRYPTION_KEY`; chat needs `OPENAI_API_KEY`.
