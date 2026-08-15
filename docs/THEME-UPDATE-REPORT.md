# Studio Back-Office Re-Theme — Morning Report

**Done overnight, autonomously, per your go-ahead.** Theme: **light/bright royal blue primary + yellow accent**,
fully token-driven so a parent-level change cascades across the whole app. Verified live where possible.

## TL;DR
- **Blue is now light/bright** (`#2563EB`) — not the dark violet-blue you flagged. One token drives it.
- **The theme cascades for real now.** Root cause of the "hardcoded everywhere" feeling was fixed: a dual-token conflict + ~620 literal colors bypassing the system.
- **Verified live**: dashboard, sidebar, topbar, login all render the new theme correctly (SKIP_AUTH let me see the authed dashboard). Full webapp `tsc --noEmit` **passes clean**.
- **Uncommitted** — all changes are in the working tree, ready for you to review/branch/commit. Nothing was committed.

## What was wrong (from the deep-dive audit)
1. **Dual-token conflict** — two competing systems: shadcn `--primary` = *yellow* vs `--m-primary` = *blue*. Same intent, two answers → the inconsistency you felt.
2. **~486 raw hex + 66 stray Tailwind utilities** bypassing the tokens — almost all in `features/csa-assistant/**` (its own indigo/violet/orange palette, off-brand) and the `select-project` page.
3. **Three hand-copied palettes** (`tokens.ts`, `tokens.css`, `styles.css`) that could drift.

## What I changed
**Foundation (verified live on the login page + dashboard):**
- Re-valued the blue ramp to a bright royal blue — **`--csa-blue-500: #2563EB`** (was `#1B4BEB`). This is the **single knob** for the whole theme.
- Fixed the `--primary` conflict → **blue** everywhere (shadcn `--primary`, `--ring`, sidebar hue aligned). Yellow stays the brand accent (topbar, active nav, logo).
- Kept yellow untouched (you didn't flag it); kept Inter font.
- Added the missing **status-border tokens** (`--color-success/warning/error/info-border`) and two **overlay tokens** (`--sidebar-overlay`, `--topbar-overlay`) — closing real gaps in the system.

**Migration (3 parallel agents, each typecheck-clean):**
- **~620 hardcoded literals → tokens** across the CSA-assistant steppers, drawers, chat panels, and the `select-project` page.
- Unified **three different stepper "done" colors** (orange/green/violet) → one `--color-success`.
- De-duplicated the sentiment color tables onto shared semantic tokens.
- Rebranded the off-system `select-project` page and the small offenders (badge/status-card/order/cart/admin chips).
- Swapped the off-brand indigo conversation-header gradient → the brand blue gradient.

## Live verification
- **Dashboard** (via `SKIP_AUTH`): blue sidebar, yellow active-nav + topbar, white cards, green/red semantic status badges — all correct.
- **Login**: CTA + links now blue, logo amber. *(The login CTA went yellow→blue for consistency; see decision #2 below — one-line revert if you want it yellow.)*
- **Typecheck**: `pnpm --filter @csa/studio typecheck` → pass, zero errors.
- **Not visually QA'd**: the CSA-Assistant chat surface itself (needs a live backend/conversation to render) — it's token-migrated + typecheck-clean, using the same tokens that render correctly elsewhere.

## Decisions I made autonomously (all easily reversible)
1. **Blue = `#2563EB`.** If you want it lighter or darker, change **one line**: `--csa-blue-500` in `apps/studio/src/ui/styles/tokens.css` (and mirror in `foundation/tokens.ts`). Everything cascades.
2. **Login CTA is now blue** (was yellow) — for consistency (blue = primary action). To restore yellow, we add a `brand` button variant; say the word.
3. **`select-project` "purple" status → mapped to `info` (blue-ish)**; there's no violet brand token.

## Remaining (small, honest)
- **3 documented hardcode exceptions**: the conversation-list avatar hash palette (2 distinct hues for customer differentiation) and `ProductDetailDrawer` `stockColor` (concatenates a hex-alpha suffix `${c}40`, which CSS vars can't do). Both are deliberate.
- **Pre-existing bug** (not mine): `ui/status-card.tsx` references undefined utilities (`primary-100`, `csa-border`, `csa-muted`) — its blue/slate variants render as unstyled. Worth a quick follow-up.
- **The 3 hand-copied palettes still need to be edited in lockstep** — I kept them in sync, but the durable fix is a build step generating `tokens.css`/`styles.css` from `tokens.ts` (recommended in the audit).
- **Login still needs the backend** (auth + Mongo) to actually sign in — unchanged; that's the Mongo unblock.

## How to tune the blue (the one knob)
```
apps/studio/src/ui/styles/tokens.css →  --csa-blue-500: #2563EB;
apps/studio/src/ui/foundation/tokens.ts →  blue.500: '#2563EB'
```
Lighter option: `#3B82F6` (note: reduces white-text contrast on the sidebar). Darker: `#1D4ED8`.
