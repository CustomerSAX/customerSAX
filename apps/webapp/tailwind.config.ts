import type { Config } from "tailwindcss";
import { csaTailwindPreset } from "./src/ui/preset";

const config: Config = {
  presets: [csaTailwindPreset as any],
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [
    require("tailwindcss-animate"),
  ],
};

export default config;
