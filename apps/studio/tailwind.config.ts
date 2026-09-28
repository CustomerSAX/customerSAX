import type { Config } from "tailwindcss";
import { csaTailwindPreset } from "@csa/ui/preset";

const config: Config = {
  presets: [csaTailwindPreset as any],
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/search/src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [],
};

export default config;
