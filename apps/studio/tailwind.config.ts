import type { Config } from "tailwindcss";
import { csaTailwindPreset } from "@csa/ui/preset";

const config: Config = {
  presets: [csaTailwindPreset as unknown as Config],
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // Scan the shared @csa/ui design-system source too. Its component class
    // strings (e.g. `csa-topbar`) live only here; without this glob Tailwind
    // tree-shakes those hand-authored `@layer components` rules out of the
    // build, which is what made the yellow topbar render white on some routes.
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [],
};

export default config;
