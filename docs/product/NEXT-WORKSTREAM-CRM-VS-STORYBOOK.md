# Next Workstream: CRM Capability vs Storybook

> **Purpose:** help the team decide which of two candidate workstreams to pick up next.
> **Date:** 2026-09-29 · **Branch with CRM Phase 1:** `feature/crm-capability` (uncommitted, kept as-is).
> Effort figures are rough engineer-day estimates for planning, not commitments.

## TL;DR

| | CRM capability | Storybook |
|---|---|---|
| What it is | Let each client plug in their own CRM (Salesforce first) and see it in CSA and the AI assistant | A workshop to build, view and test `@csa/ui` components in isolation, across all UI libraries |
| Where it stands | **Phase 1 done** (backend, registry, Salesforce adapter, admin API, AI tools, design doc) | **Nothing exists yet** — no Storybook config or stories anywhere in the repo |
| Blocked on | A Salesforce Developer Edition org for live testing; studio UI | Nothing — can start today |
| Remaining effort | ~6–9 days for a usable, deployed, UI-complete CRM | ~3–4 days for a solid foundation; more if the full component library is covered |
| Who benefits | Clients / sales (visible product capability) | Engineers + design (speed, quality, UI consistency) |

**Recommendation:** the two aren't mutually exclusive, and they help each other. Start the **Storybook
foundation now** (it's unblocked and small) while someone sets up the Salesforce org, then build the **CRM studio
screens in Storybook first** (CRM Phase 2). If only one can be staffed, pick **CRM** when a client or demo needs it
soon; pick **Storybook** if UI quality and the multi-library work are the current pain.

---

## Option A — CRM capability

### What it is
The composable-platform proposal's CRM slice: a provider-neutral CRM contract, one CRM service that picks each
tenant's CRM from a Provider Registry, and a Salesforce adapter. Full design:
[docs/architecture/CRM-CAPABILITY.md](../architecture/CRM-CAPABILITY.md).

### Done (Phase 1)
- `@csa/crm` service on :4390 (contacts, accounts, activities), structured like `apps/ticketing`.
- Per-project CRM settings on the project record (like ticketing), superadmin admin API and Superadmin "CRM" panel.
- Salesforce adapter (OAuth client credentials, SOQL/SOSL, injection-safe escaping, 8 unit tests).
- BFF wiring; AI tools `find_crm_contact`, `get_crm_contact_details`, `log_crm_activity`, `update_crm_contact`.
- Verified: typecheck/tests, real Mongo, the real Salesforce OAuth endpoint, the real BFF, the AI tool gates.

### Remaining

| Item | Est. | Notes |
|---|---|---|
| Live Salesforce verification | 0.5–1 d | Needs a Developer Edition org + app credentials (setup in CRM doc §11) |
| Studio: "Connect a CRM" form (superadmin) | 1–2 d | Provider dropdown, fields, "Test connection" |
| Studio: CRM panel (customer view + assistant context panel) | 2–3 d | Contact, account, owner, recent activity, deep link |
| Deployment (Terraform, Cloud Run, CI deploy list, secrets) | 1–2 d | Mirrors ticketing's Terraform |
| Full `/chat` end-to-end check | 0.5 d | |
| **Subtotal to "usable in production"** | **~6–9 d** | |
| Later: Customer 360, HubSpot/Dynamics adapters, CSA Native CRM | per item | Each adapter ≈ 2–3 d |

### Value
- The proposal's differentiator: *"CSA becomes the experience layer over the client's existing systems."*
- A visible, demo-able capability for enterprise prospects who already run Salesforce.
- It proves the Provider Registry pattern, which ticketing (the proposal's own recommended first POC) can reuse unchanged.

### Risks
- Can't be fully proven until a Salesforce org exists.
- Carries the platform's known header-trust / client-supplied permission gaps (SECURITY-TENANCY.md) — fine
  for demos, must be fixed before multi-tenant production.
- Adding `crm` to the BFF's default services means `pnpm dev:studio` now also has to run the CRM service
  (already added to the root scripts).

---

## Option B — Storybook

### What it is
[Storybook](https://storybook.js.org/) is a dev tool that renders each UI component on its own ("stories") with
controls to change props, plus addons for accessibility checks, interaction tests and docs. It ships as a static
site the whole team (including design/product) can browse.

### Current state of the UI code (researched)
- **No Storybook** — no config, no `*.stories.*` files, no dependency, nothing in git history.
- `@csa/ui` ("Meridian") is a raw-TS package: ~40 components (`primitives/`, `components/*`), tokens in
  `src/styles/tokens.css`, a Tailwind preset.
- **Pluggable multi-UI architecture (PR #85):** a 38-component contract (`CSAUIComponentMap`) with four adapters —
  `csa-custom`, `mantine` (678 lines), `mui` (788 lines), and `zcm` (a documented scaffold that falls back to
  csa-custom because the real ZCM library hasn't been identified).
- **Key finding — the adapters barely reach the studio.** Mantine and MUI implement all 38 contract components,
  but only **4** shared components actually switch with the active library (`Button`, `Input`, `Select`,
  `Badge` call `useUI()`). Everything else the studio imports (`Card`, `Modal`, `Table`, `Tabs`, `Skeleton`…)
  always renders the CSA version. Switching a tenant to Mantine or MUI today therefore changes very little of
  the UI. Nobody can currently *see* this, because there's no place to view the adapters side by side.
- Studio: Next.js 16.3, React 19.2, Tailwind 3.4; 76 of 122 `.tsx` files import `@csa/ui`.

### What Storybook would give this repo
1. **See all adapters side by side:** a toolbar switch (CSA / Mantine / MUI / ZCM) that wraps every story in the
   existing `UIProvider`, making the 38-contract parity visible and reviewable.
2. **Faster UI work:** build components (e.g. the CRM panel, stepper cards) without logging in, picking a
   project and reaching the right screen in the running app.
3. **Accessibility checks** (`@storybook/addon-a11y`) — the multi-UI spec explicitly asks for keyboard, focus and
   loading/error-state verification.
4. **Tests from stories:** Storybook's Vitest addon runs stories as tests; the repo already uses Vitest 4
   (`pnpm test`), which Storybook 10 supports.
5. **Living docs** for the design system that non-engineers can browse.

### Proposed scope

| Phase | Content | Est. |
|---|---|---|
| **S1 Foundation** | Storybook 10 in `packages/ui` (`@storybook/react-vite`); preview loads `tokens.css`, Tailwind (via the existing preset) and Mantine CSS; global "UI library" toolbar → `UIProvider`; a11y addon; `pnpm storybook` / `build-storybook` scripts | 1–1.5 d |
| **S2 Contract stories** | One story per contract component (38) with key states (variants, sizes, disabled, loading, error, empty) | 1.5–2 d |
| **S3 Tests + CI** | Vitest addon wired into `pnpm test`; `build-storybook` in CI | 0.5–1 d |
| **S4 Publish** | Static Storybook on Vercel (the frontends are already there) | 0.5 d |
| **Foundation total (S1–S4)** | | **~3–4 d** |
| Later: studio domain components | Needs `@storybook/nextjs-vite` in `apps/studio` + mocks for `next/navigation`, `next-intl`, Auth0 | 2–3 d |
| Later: visual regression | Chromatic (paid SaaS) or Playwright screenshots of stories | 1–2 d |
| Follow-on (not Storybook itself) | Make the other ~34 shared components delegate to the active adapter | Separate UI task; Storybook makes it measurable |

### Technical notes / risks
- **Node version:** Storybook 10 is ESM-only and needs Node **20.16+, 22.19+ or 24+**. `.nvmrc` pins 24.14 (fine) and
  CI uses Node 20 (fine if it resolves to ≥20.16), but at least one local machine runs **22.16**, which is too old —
  developers need to switch to the `.nvmrc` version.
- **Styling:** `@csa/ui` has no Tailwind config of its own — Storybook needs one (using `csaTailwindPreset`) with content
  paths over `packages/ui/src`.
- **`'use client'`** directives and the Next-only pieces are harmless in a Vite Storybook for `packages/ui`;
  studio components that use `next/*` need the Next framework variant (later phase).
- **No-mock-data policy:** stories need sample props. That's normal for a dev-only component workshop, but it
  touches the project's strict "no fabricated data" rule. **Proposed rule for the team to confirm:** fixtures live only in
  `*.stories.tsx`, are never imported by app code, and are excluded from app builds.
- **Upkeep:** stories rot if nobody owns them. Make "new/changed `@csa/ui` component ⇒ story" part of review.

---

## Side-by-side

| Criterion | CRM | Storybook |
|---|---|---|
| Client-visible value | **High** — new capability | Low directly; indirect via UI quality |
| Team productivity | Neutral | **High** for all UI work |
| Readiness | Blocked on Salesforce org for live proof | **Unblocked** |
| Size to a useful milestone | ~6–9 d | **~3–4 d** |
| Risk | Medium (external system, security gaps) | Low (dev tooling, easy to remove) |
| Strategic fit | Core of the composable-platform proposal | Supports the pluggable-UI initiative (PR #85) |
| Synergy | CRM UI panels can be built in Storybook | Gets a real first consumer (CRM panel) |

## Suggested sequence (if both are wanted)

1. **Week 1:** Storybook S1–S3. In parallel, get a Salesforce Developer Edition org and run the CRM live check.
2. **Week 2:** CRM Phase 2 — build the "Connect a CRM" form and CRM panel as stories first, then wire them into the studio; deploy the CRM service.
3. **After:** Storybook S4 publish; start closing the adapter-delegation gap (34 components) with Storybook as the checklist.

## Decisions needed from the team

1. Which workstream first — or both in parallel (who owns each)?
2. Is there a client or demo date that makes CRM time-critical?
3. Confirm the Storybook fixture exception to the no-mock-data rule (dev-only, stories only).
4. Is visual regression (Chromatic, paid) wanted, or Playwright screenshots only?
5. Who creates the Salesforce Developer Edition org (needs a real person's email)?

## Sources
- Storybook install requirements: <https://storybook.js.org/docs/get-started/install>
- Storybook 10 release (ESM-only, Node 20.16+/22.19+/24+, Next 16 and Vitest 4 support): <https://storybook.js.org/blog/storybook-10/>
- Storybook 10 migration guide: <https://storybook.js.org/docs/releases/migration-guide>
- In-repo: `packages/ui/src/{contracts,adapters,provider,primitives}`, `csa-pluggable-ui-architecture-antigravity.md`,
  `docs/architecture/CRM-CAPABILITY.md`.
