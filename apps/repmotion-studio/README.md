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

## Structure

- `src/features/repmotion/data.ts`: typed sample business data.
- `src/features/repmotion/demo-state.tsx`: shared session state and actions.
- `src/features/repmotion/components.tsx`: reusable feature-level compositions.
- `src/features/repmotion/workspace.tsx`: navigation, header, and notifications.
- `src/components/ui.ts`: focused exports from the existing CSA design system.
- `src/app/globals.css`: responsive layouts using shared semantic tokens.

Future data integration can replace fixtures with the shared BFF, using Studio's
server-side session validation and project-scoped proxy pattern. The BFF is
unchanged by this UI implementation.

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
