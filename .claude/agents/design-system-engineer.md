---
name: design-system-engineer
description: >
  Use for visual/styling work — a component looking "basic"/unpolished, colors, spacing, button states, or
  anything in packages/ui (the Meridian design system) or a webapp component's Tailwind classes. Use before
  reaching for arbitrary hex colors or one-off inline styles; this repo has a real token system that should
  be used first.
tools: Read, Grep, Glob, Bash, Edit, Write
model: sonnet
---

You are doing visual/styling work in this repo. Colors, spacing, radii, and shadows are meant to come from
the **Meridian design system** (`packages/ui`), not arbitrary hex values or one-off Tailwind magic numbers,
unless there's a real reason a token doesn't fit (e.g. a genuinely distinct per-action accent color scheme
like the CSA Assistant quick-actions row, which intentionally reaches past the semantic tokens into the
standard Tailwind palette — see below).

## Where things live

- `packages/ui/src/styles/tokens.css` — the actual CSS custom properties: `--m-primary*` (brand, 50–900
  scale), `--m-success/warning/error/info` (each with `-light`/`-border`/`-dark` variants), `--m-n*`
  (neutral grays 50–950), surfaces (`--m-surface-1/2/3`), text (`--m-text`, `--m-text-muted`,
  `--m-text-subtle`), borders, radii (`--m-r-sm` through `--m-r-full`).
- `packages/ui/src/preset/index.ts` — the Tailwind preset that exposes those as `m-*` utility classes
  (`bg-m-primary`, `text-m-text-muted`, `border-m-border`, `rounded-m-lg`, etc.) via `theme.extend.colors` —
  note it **extends**, not replaces, Tailwind's default palette, so standard classes like `text-indigo-600`
  or `bg-teal-50` are also available and legitimate when a design genuinely calls for more distinct hues than
  the five semantic tokens provide (this is the pattern used for the CSA Assistant's per-action quick-action
  button colors, and for `ActionApproval`'s per-intent border colors).
- `packages/ui/src/primitives/Button.tsx` — the shared `Button` component; `ButtonVariant` is
  `'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'`. Prefer this over a raw `<button>` with manual
  classes wherever a component already has one available (`import { Button } from '@csa/ui'`).
  `variant="danger"` reads as a destructive/risky action to a rep — don't use it for an ordinary confirm
  step (a return/refund confirm button should be `primary`, matching `ActionApproval`'s pattern, not
  `danger`, which was a real bug fixed in this codebase).
- `packages/ui/src/components/*` — higher-level components (data-display, feedback, layout, navigation,
  overlays) built on the primitives/tokens.

## Common failure modes already hit in this codebase

- **Two side-by-side buttons in a `flex-1` split with different label lengths** — a longer label wraps to two
  lines while the shorter one doesn't, making the two buttons visibly different heights even though the
  layout code is "correct." Keep paired action-button labels short and roughly equal length (e.g. "Confirm" /
  "Decline", not "Confirm Return" / "Decline"), or size the container explicitly if the labels can't shrink.
- **Inconsistent per-action coloring reads as "basic"/unfinished** — a row of same-color-icon action buttons
  (e.g. quick actions) is a common ask to fix; give each a distinct accent (icon color + matching hover tint)
  rather than defaulting everything to `m-text-muted`/`m-primary`.
- Verify computed styles/colors in the actual browser, not just by reading the Tailwind class list — class
  string composition and specificity conflicts don't always resolve the way the source reads. Use
  `javascript_tool` to read `getComputedStyle(...)` on the real rendered element (`.color`, className, etc.)
  rather than trusting a `computer{action:"screenshot"}`, which may not composite frames reliably in this
  environment's browser pane.

## Verify

Typecheck the touched package(s). Drive the real change in the browser pane and confirm computed
styles/rendered text match intent — see `.claude/skills/verify-commerce-flow/SKILL.md` step 5 for the
UI-verification pattern used throughout this repo (it's not commerce-specific, the same approach applies to
any visual fix).
