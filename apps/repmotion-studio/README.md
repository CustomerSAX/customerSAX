# RepMotion Studio

A Next.js frontend adapting the supplied RepMotion / White Cap POC to the CSA
shared design system. Uses `@csa/ui` buttons, cards, metrics, badges, tabs, tables,
inputs, switches, modals, icons, the Tailwind preset, and semantic CSS tokens.

From the repository root:

```bash
pnpm install
pnpm dev:repmotion-studio
```

Open http://localhost:3002 and choose a demo persona.

| Route              | Screen                                                          |
| ------------------ | --------------------------------------------------------------- |
| `/`                | Persona selection                                               |
| `/today`           | Customer priorities, search, and readiness filters              |
| `/accounts/summit` | Meeting brief, approval, orders, service history, commitments   |
| `/commitments`     | Shared commitments across the sample portfolio                  |
| `/service`         | Service queue and the Summit resolution workflow                |
| `/manager`         | Source readiness, illustrative controls, workload, and outcomes |
| `/demo-flow`       | Interactive five-step cross-role journey                        |

Account sections support direct links with `#brief`, `#business`, `#service`, and
`#commitments`. The sample's `#opportunities` and `#history` aliases also work.

## Demo behavior

All accounts and figures are fictional fixtures adapted from
`RepMotion-WhiteCap-POC-Demo-2026-10-06.zip`. This is a UI demo, not authentication
or live White Cap integration. Persona selection changes the demonstration view.
No environment variables or backend services are required.

Approvals, new commitments, service handoffs, notifications, and policy switch
states are shared across routes in a React provider. They reset on a full browser
reload. Capture a commitment from an account or the commitments page to see it
appear in customer care and the manager console. Service actions record demo
state; they never send messages. Manager controls illustrate configuration and
do not enforce live policies. Refresh updates the displayed sample refresh time,
not the underlying fixtures. Summary KPIs and success measures are sample values.

## Architecture and Foundations

RepMotion Studio follows the architecture and conventions established in Customer CX Studio (`apps/studio`):

### 1. Unified Shared UI System (`@csa/ui`)
- All components consume the shared `@csa/ui` design system and component contracts.
- Imports can be made directly from `@csa/ui` or via `@/components/ui`.
- Uses `csaTailwindPreset` and `@csa/ui/styles/tokens.css`.

### 2. Multi-UI & Organization Theming
- Root layout wraps the app with `AppProviders` (`src/app/providers.tsx`).
- `MeridianProvider` manages theme modes (`light`, `dark`, `system`).
- `UIProvider` dynamically resolves the organization's configured UI library (`mantine`, `mui`, `csa-custom`) using `resolveUIConfig({ customerId, projectId, organizationId, organizationName, user })`.
- Organization themes saved in Customer CX Studio are automatically respected in RepMotion Studio. URL previews (`?ui=mantine`) and dev overrides (`csa_dev_ui_override`) work identically.

### 3. API Integration Foundation
- **Client**: Apollo Client (`src/graphql/client.ts`) configured with `uri: "/api/graphql"` and `credentials: "same-origin"`.
- **Route Handler**: Next.js route `/api/graphql` validates the `csa_session` cookie with the Auth service, injects multi-tenant headers (`applyCsaHeaders` from `@csa/headers`), and proxies to the BFF gateway (`process.env.BFF_URL || "http://127.0.0.1:4000/graphql"`).
- **Session & Identity**: `/api/auth/me`, `useCurrentUser` (`src/lib/use-current-user.ts`), and `getCurrentUser` (`src/lib/get-current-user.ts`).
- **Backend Communication**: `projectScopedBffFetch` (`src/lib/project-scoped-bff.ts`) for server-side authenticated requests.

### 4. Feature Folder Convention
Features should be structured identically to Customer CX Studio features:
```text
src/features/<feature-name>/
├── api/          # GraphQL queries/mutations (e.g. queries.ts)
├── components/   # Presentation and container components
├── hooks/        # Data-fetching and state management hooks (useQuery/useMutation)
└── types/        # TypeScript types and interfaces
```
See `src/features/orders/` for a reference implementation.

## Structure

- `src/features/repmotion/`: Existing demo screens, fixture data, and workspace layout.
- `src/features/orders/`: Reference feature showing established GraphQL, types, and hooks pattern.
- `src/graphql/`: Shared Apollo client singleton.
- `src/lib/`: Session lookup, auth hooks, and project-scoped BFF request utilities.
- `src/app/api/`: Next.js route handlers for auth and GraphQL BFF proxying.
- `src/components/ui.ts`: Unified re-exports from `@csa/ui`.
- `src/app/providers.tsx`: Providers composing Meridian, UI, Apollo, and demo state.
- `src/app/globals.css`: Responsive layouts using shared semantic tokens.

## Validation

```bash
pnpm app:repmotion-studio build
pnpm app:repmotion-studio lint
pnpm app:repmotion-studio typecheck
```

Review each route at desktop and 320px widths. Wide data tables scroll inside a
focusable region. Check keyboard tab navigation, Escape and focus return in
modals, persona links, target search, approval, commitment capture, and the
customer-care handoff into the sales brief.
