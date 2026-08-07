import type { Config } from "tailwindcss";
import { meridianTailwindPreset } from "@csa/ui/preset";

const config: Config = {
  presets: [meridianTailwindPreset as any],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}"
  ],
  plugins: []
};

export default config;
