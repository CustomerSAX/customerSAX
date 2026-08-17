# @csa/ui

The CSA shared design system: foundation tokens, the Tailwind preset, primitives,
composed components, providers, hooks, and icons. Extracted from the studio so any
app in the workspace can reuse the same visual language.

This is a raw-TypeScript workspace package (consumed directly from `src/`, no build
step) — add it to a consumer with `"@csa/ui": "workspace:*"`.

## Importing

```ts
// Barrel — foundation, providers, preset, utils, icons, hooks, primitives, components
import { Button, tokens } from "@csa/ui";

// Subpaths
import { csaTailwindPreset } from "@csa/ui/preset";   // tailwind.config.ts preset
import { StatusCard } from "@csa/ui/status-card";
// plus any other module under src via "@csa/ui/<path>"
```

### Tailwind

```ts
// tailwind.config.ts
import { csaTailwindPreset } from "@csa/ui/preset";
export default { presets: [csaTailwindPreset] /* ... */ };
```

### CSS tokens

```css
/* app entry stylesheet */
@import "@csa/ui/styles/tokens.css";
```

## Design tokens are the single source of truth

Color, spacing, radius, and typography values live once in
`src/styles/tokens.css` (CSS custom properties) and `src/foundation` (TS tokens),
surfaced to Tailwind through `src/preset`. Never hardcode a hex value or one-off
inline style in a consumer — reference a token so a re-theme stays a single edit
in this package.
