import type { Config } from "tailwindcss";
import { meridianTailwindPreset } from "./src/ui/preset";

const config: Config = {
  presets: [meridianTailwindPreset as any],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  plugins: []
};

export default config;
