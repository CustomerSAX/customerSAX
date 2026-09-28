# CSA Studio --- Pluggable Multi-UI Architecture

## Prompt for Antigravity

You are working on Customer CX / CSA, specifically `customerSAX Studio`.

Your task is to design and implement a flexible, plug-and-play UI
architecture that allows CSA to use a different UI implementation for
each customer, tenant, or project without rewriting business logic or
duplicating the entire application.

The initial supported UI options are:

1.  `csa-custom` --- the existing CSA custom component library,
    currently implemented with Tailwind CSS.
2.  `mantine` --- Mantine React component library.
3.  `mui` --- Material UI.
4.  `zcm` --- the fourth UI option selected by the product team. Treat
    this as a replaceable adapter name and verify the exact package,
    documentation, license, and component APIs before implementation. Do
    not assume its identity or install an unverified package.

## Main Requirement

When a user logs in or selects a project/customer, CSA must resolve that
customer's configured UI library and render the application using that
library.

Example:

-   Customer A → Mantine
-   Customer B → MUI
-   Customer C → CSA Custom UI
-   Customer D → ZCM

The application must not render all four libraries together. Only the
selected implementation should be active for the current
customer/project.

The architecture must support adding a fifth library later without
rewriting the Studio application.

## Scope

Primary scope:

-   `apps/studio`
-   `packages/ui`

Do not modify backend services unless a small configuration contract is
required and explicitly approved.

Preserve existing business logic, routes, permissions, API calls, data
fetching, state management, and domain workflows.

## Architectural Principle

Use a stable CSA UI contract with replaceable adapters.

Application and domain components should import from the CSA UI layer:

``` tsx
import { Button, Input, Modal, Table } from '@csa/ui';
```

They must not directly import Mantine, MUI, ZCM, or library-specific
Tailwind components.

The CSA UI layer resolves the active adapter:

``` text
Customer / Project Configuration
        ↓
UI Provider / UI Registry
        ↓
Selected Adapter
        ↓
Mantine / MUI / ZCM / CSA Custom Components
        ↓
Rendered Studio UI
```

## Recommended Package Structure

Create a structure similar to:

``` text
packages/ui/
  src/
    contracts/
      button.ts
      input.ts
      select.ts
      modal.ts
      table.ts
      feedback.ts
      layout.ts
      index.ts

    adapters/
      csa-custom/
        components/
        theme/
        index.ts

      mantine/
        components/
        theme/
        index.ts

      mui/
        components/
        theme/
        index.ts

      zcm/
        components/
        theme/
        index.ts

    provider/
      UIProvider.tsx
      UIRegistry.ts
      UIConfig.ts
      useUIConfig.ts

    components/
      domain/
        EntityDetail/
        PageHeader/
        PageShell/
        AppShell/
        ColumnManager/

    theme/
      tokens.ts
      resolveTheme.ts
      types.ts

    index.ts
```

The exact structure may be adjusted after inspecting the current
repository, but the separation between contracts, adapters, provider,
and domain components is required.

## UI Contract

Define library-neutral component contracts for the common CSA component
set.

Initial contract list:

-   Button
-   IconButton / ActionIcon
-   Input
-   Textarea
-   Select
-   Checkbox
-   Radio / RadioGroup
-   Switch
-   SearchBar
-   Label
-   FormField
-   Separator
-   Text / Heading
-   Modal
-   Drawer
-   Dropdown / Menu
-   Popover
-   Tooltip
-   Toast / Notification
-   Table
-   Pagination
-   Badge
-   Avatar
-   Card
-   Skeleton
-   Loader
-   EmptyState
-   Tabs
-   Breadcrumbs
-   Accordion
-   PageHeader
-   PageShell
-   Panel
-   Toolbar
-   StickyActionBar
-   AppShell

Keep the current `@csa/ui` public API and component signatures
compatible wherever practical. Existing Studio screens should not need
to know which library is active.

For props that cannot be represented identically across libraries,
create a CSA-level prop contract and translate it inside each adapter.

Example:

``` tsx
type CSAButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

type CSAButtonProps = {
  variant?: CSAButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
};
```

Do not leak Mantine-specific props, MUI-specific props, or ZCM-specific
props into shared application code.

## Runtime Selection

The product requirement is customer/project-specific UI selection.

Implement a central configuration model:

``` ts
type UILibrary =
  | 'csa-custom'
  | 'mantine'
  | 'mui'
  | 'zcm';

type UIConfig = {
  library: UILibrary;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    brandColor?: string;
    fontFamily?: string;
    radius?: string;
  };
};
```

The configuration source should be isolated behind a resolver:

``` ts
resolveUIConfig({
  customerId,
  projectId,
  user
});
```

The resolver may initially use build-time or environment configuration
if that is how the current deployment model works. However, design the
interfaces so that a future tenant/project configuration service can
provide the value without changing component code.

Important:

-   Validate the library identifier.
-   Provide a safe fallback to `csa-custom`.
-   Never leave the application in a partially initialized UI state.
-   Do not dynamically import every library into the initial bundle if
    avoidable.
-   Prefer lazy-loading the selected adapter where the framework
    supports it.
-   Avoid loading Mantine, MUI, and ZCM CSS globally at the same time.
-   Ensure the selected adapter is initialized before rendering the main
    Studio shell.
-   Persist selection at the customer/project level, not as an
    accidental browser-only preference.

## Provider Design

Create one top-level provider in Studio:

``` tsx
<UIProvider config={uiConfig}>
  <StudioApp />
</UIProvider>
```

The provider should:

1.  Resolve the active library.
2.  Load the selected adapter.
3.  Apply the selected library provider/theme.
4.  Expose the CSA component contract.
5.  Expose shared theme tokens.
6.  Handle loading and fallback states.
7.  Prevent provider duplication and conflicting CSS.
8.  Support switching projects without requiring a full application
    rewrite.

If switching between projects in the same browser session is supported,
make sure the UI provider and theme are refreshed safely. If a full
reload is required initially, document that limitation and keep the
architecture ready for later hot switching.

## Adapter Requirements

### 1. CSA Custom Adapter

This adapter wraps the existing Tailwind-based `@csa/ui` implementation.

Do not rewrite it unnecessarily. Preserve its current behavior and use
it as the fallback implementation.

Move or expose its components behind the same CSA contracts used by the
other adapters.

### 2. Mantine Adapter

Use official Mantine packages and documentation.

Likely packages:

-   `@mantine/core`
-   `@mantine/hooks`
-   `@mantine/form`
-   `@mantine/notifications`
-   `@mantine/dates` only where required

Use `MantineProvider` and a dedicated CSA Mantine theme.

Map existing components as follows:

-   Button → `Button` / `ActionIcon`
-   Input → `TextInput`
-   Select → `Select` / `NativeSelect` / `Combobox`
-   Textarea → `Textarea`
-   Checkbox → `Checkbox`
-   Radio → `Radio` / `Radio.Group`
-   Switch → `Switch`
-   Modal → `Modal`
-   Drawer → `Drawer`
-   Dropdown → `Menu`
-   Popover → `Popover`
-   Tooltip → `Tooltip`
-   Toast → Mantine notifications
-   Table → `Table`
-   Pagination → `Pagination`
-   Badge → `Badge`
-   Avatar → `Avatar`
-   Card → `Card` / `Paper`
-   Skeleton → `Skeleton`
-   Loader → `Loader`
-   Tabs → `Tabs`
-   Breadcrumbs → `Breadcrumbs`
-   Accordion → `Accordion`

Use Mantine hooks only inside the Mantine adapter or library-specific
integration layer. Keep shared hooks library-neutral where possible.

### 3. MUI Adapter

Use `@mui/material` and the official MUI theme/provider model.

Likely packages:

-   `@mui/material`
-   `@mui/icons-material` only if required
-   `@emotion/react`
-   `@emotion/styled`

Use `ThemeProvider` and `createTheme`.

Map CSA contracts to MUI equivalents:

-   Button → `Button` / `IconButton`
-   Input → `TextField`
-   Select → `Select` / `Autocomplete`
-   Textarea → `TextField multiline`
-   Checkbox → `Checkbox`
-   Radio → `Radio` / `RadioGroup`
-   Switch → `Switch`
-   Modal → `Dialog`
-   Drawer → `Drawer`
-   Dropdown → `Menu`
-   Popover → `Popover`
-   Tooltip → `Tooltip`
-   Toast → `Snackbar` / `Alert`
-   Table → `Table`
-   Pagination → `Pagination`
-   Badge → `Chip` or a CSA wrapper
-   Avatar → `Avatar`
-   Card → `Card`
-   Skeleton → `Skeleton`
-   Loader → `CircularProgress`
-   Tabs → `Tabs`
-   Breadcrumbs → `Breadcrumbs`
-   Accordion → `Accordion`

Do not expose MUI `sx`, `SxProps`, or MUI-specific component props
through the shared CSA contract unless there is a carefully isolated
escape hatch.

### 4. ZCM Adapter

Before implementation:

-   Identify the exact ZCM library/package intended by the product team.
-   Confirm whether it is a React component library, a Tailwind-based
    component set, or another type of UI system.
-   Confirm official documentation, package name, version, license,
    theming model, accessibility support, and SSR compatibility.
-   Record the findings in the implementation notes.
-   Do not install or invent a package based only on the name `ZCM`.

Then implement the same CSA contracts as the other adapters.

If ZCM is not yet available or cannot satisfy a contract, create a
clearly marked adapter scaffold with explicit unsupported-component
handling and keep the fallback behavior safe.

## Domain Components

Domain-specific components must remain CSA-owned and library-neutral.

Examples:

-   EntityDetail compound suite
-   DetailPage
-   EntityHeader
-   StatusPill
-   SummaryGrid
-   SummaryCard
-   ContentGrid
-   SectionCard
-   InfoList
-   InfoRow
-   QuickActions
-   Timeline
-   PageHeader
-   PageShell
-   AppShell
-   ColumnManager

These components may use the CSA UI contract internally, but must not
contain separate business implementations for every library.

For example:

``` tsx
<EntityDetail>
  <EntityHeader />
  <SummaryGrid />
  <SectionCard />
</EntityDetail>
```

The domain component should behave consistently while its underlying
primitives change according to the active adapter.

## Theme Architecture

Create shared, library-neutral design tokens:

``` ts
type CSATokens = {
  colors: {
    primary: string;
    secondary: string;
    brand: string;
    background: string;
    text: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    baseFontSize: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
  };
  spacing: Record<string, string>;
}
```

Each adapter translates the shared tokens into its own theme system:

-   Mantine → `createTheme` / `MantineProvider`
-   MUI → `createTheme` / `ThemeProvider`
-   CSA Custom → CSS variables and Tailwind tokens
-   ZCM → its documented theme mechanism

Future customer branding should be possible through configuration:

``` ts
{
  library: 'mantine',
  theme: {
    primaryColor: '#2563EB',
    secondaryColor: '#9A6BFF',
    brandColor: '#F5A624'
  }
}
```

Theme configuration is a second-stage capability, but the architecture
must not prevent it.

## Dependency and Bundle Rules

-   Do not import all library providers into every screen.
-   Keep adapter dependencies isolated.
-   Avoid circular dependencies between `packages/ui`, adapters, and
    Studio.
-   Keep business/domain components independent from third-party
    libraries.
-   Ensure unused adapters can be excluded or lazy-loaded.
-   Avoid global CSS collisions between Mantine, MUI, Tailwind, and ZCM.
-   Document CSS injection order and reset behavior.
-   Confirm SSR, hydration, and routing behavior in the current Studio
    framework.

## Migration Strategy

Implement incrementally:

### Phase 1 --- Audit and Contracts

-   Inspect the current `apps/studio` and `packages/ui`.
-   Inventory existing components, props, exports, hooks, styles, and
    consumers.
-   Define the CSA contracts.
-   Add the UI library enum and configuration resolver.
-   Preserve current behavior through the CSA Custom adapter.

### Phase 2 --- Provider and Registry

-   Add `UIProvider`.
-   Add adapter registry.
-   Add safe fallback behavior.
-   Add a temporary development selector or environment variable for
    testing.
-   Ensure the current application works unchanged with `csa-custom`.

### Phase 3 --- Mantine

-   Add Mantine dependencies.
-   Implement the Mantine adapter.
-   Add Mantine provider and theme.
-   Migrate component-by-component behind the shared contracts.
-   Verify all major Studio screens.

### Phase 4 --- MUI

-   Add MUI dependencies.
-   Implement the MUI adapter.
-   Add MUI provider and theme.
-   Verify all major Studio screens.

### Phase 5 --- ZCM

-   Verify the exact ZCM package and documentation.
-   Implement the adapter or a documented scaffold.
-   Verify supported and unsupported components.

### Phase 6 --- Project/Customer Selection

-   Connect the resolver to the actual customer/project configuration
    source.
-   Ensure login/project selection resolves the correct library.
-   Add safe loading, fallback, and error handling.
-   Confirm that changing projects changes the UI implementation without
    affecting business data or permissions.

### Phase 7 --- Verification and Cleanup

Run:

``` bash
pnpm --filter @csa/studio typecheck
pnpm --filter @csa/ui typecheck
pnpm --filter @csa/studio lint
pnpm --filter @csa/studio build
```

Also verify:

-   Sign-in page
-   Dashboard
-   Customers
-   Orders
-   Cart
-   Tickets
-   Ticket creation modal
-   Entity detail pages
-   Settings
-   Column Manager
-   AppShell and navigation
-   Responsive behavior
-   Keyboard navigation
-   Focus states
-   Loading and error states
-   Toasts/notifications
-   SSR and hydration
-   Switching between customers/projects
-   Fallback when an invalid library is configured

Test matrix:

``` text
Customer A + CSA Custom
Customer B + Mantine
Customer C + MUI
Customer D + ZCM
Invalid configuration → CSA Custom fallback
```

## Required Deliverables

Antigravity must produce:

1.  Architecture notes and dependency decisions.
2.  UI contract definitions.
3.  Adapter registry and provider.
4.  CSA Custom adapter.
5.  Mantine adapter.
6.  MUI adapter.
7.  ZCM adapter or a clearly documented scaffold after verifying the
    exact library.
8.  Customer/project UI configuration resolver.
9.  Shared theme token model.
10. Migration notes for existing components.
11. Automated typecheck/lint/build results.
12. Browser verification results.
13. A list of unsupported or intentionally deferred components.
14. A short guide explaining how to add a future UI library.

## Non-Negotiable Constraints

-   Do not duplicate the Studio application for each UI library.
-   Do not rewrite business logic for each adapter.
-   Do not import third-party UI libraries directly throughout Studio
    screens.
-   Do not break the existing CSA Custom UI while adding adapters.
-   Do not assume ZCM's identity or APIs without verification.
-   Do not make the UI selection browser-only if the customer/project
    configuration is available from the application.
-   Do not silently fall back without logging or exposing a diagnosable
    reason.
-   Do not complete only a visual mockup; implement the actual
    architecture and working adapter path.
