# CSA Studio

Standalone Next.js app (the CSA Studio back-office) using Apollo Client and Tailwind.

## Run Independently

```bash
pnpm install
pnpm dev
```

This folder has its own `package.json`, `tsconfig.json`, Tailwind config, PostCSS config, and `Dockerfile`. It does not depend on monorepo-only packages.

## Required Env

- `NEXT_PUBLIC_GRAPHQL_URL`

See `.env.example` in this folder.

## Zoom and narrow viewport support

Studio reflows using CSS viewport breakpoints, including when desktop browser zoom
reduces the available CSS width. The target is 320 CSS pixels (a 1280px viewport
at 400% zoom); see [WCAG 1.4.10 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow).
Do not disable browser zoom or shrink fonts to compensate for it.

At narrow widths, navigation becomes an inline disclosure, the header wraps and
scrolls with the page, forms stack, and action groups and tabs wrap. The assistant
workspace stacks its conversation, chat, and context panels below 1280px. Data
tables retain their two-dimensional layout inside focusable horizontal scroll
regions. Keep native scrollbars visible so these regions are discoverable.

### Verification

Check both a 320px-wide viewport and actual browser zoom at 400% from a 1280px
viewport. Include a short viewport (320 × 256 CSS pixels), desktop widths, and
long customer names, IDs, translations, and validation messages.

- Open and close navigation with the keyboard; select a route and verify focus
  returns to the navigation toggle when the menu closes.
- Reach project selection, language, user menu, and global search.
- Exercise list filters, pagination, detail tabs, create/edit forms, and errors.
- Tab into a wide table and scroll it horizontally. The page itself should not
  require horizontal scrolling.
- Open dialogs and drawers and reach their heading, fields, close button, and
  footer actions, including when the viewport is short.
- Use all three assistant panels and verify chat input and quick actions remain
  reachable. Check the calendar and subscription workflows with populated data.

Implementation checks: Studio and shared UI TypeScript checks and the UI
architecture tests. A headless Chrome fixture using the shared header, actions,
tabs, input, table, and pagination was checked at 320, 375, 768, and 1280px widths
with a 256px height: no document or main-content horizontal overflow; wide tables
scrolled within their own region. This fixture does not replace authenticated
end-to-end workflow testing or establish full WCAG conformance.

Tickets list follow-up: rendered the actual `TicketListView` with fixture ticket
data and mocked routing at widths 1280, 1024, 853, 640, 512, 427, 366, and 320px
(the 100–400% zoom equivalents for a 1280px viewport). All checks passed for
page width, single-line identifiers/dates, a focusable table scroll region, and
horizontal access to the final column. Subjects wrap in a bounded column.
This was a browser viewport test, not an authenticated live-browser zoom test.
