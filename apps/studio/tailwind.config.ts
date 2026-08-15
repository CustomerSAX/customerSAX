import type { Config } from "tailwindcss";
import { csaTailwindPreset } from "@csa/ui/preset";

const config: Config = {
  presets: [csaTailwindPreset as any],
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [],
};

export default config;
