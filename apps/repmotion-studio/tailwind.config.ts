import { csaTailwindPreset } from "@csa/ui/preset";

const config = {
  presets: [csaTailwindPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"]
};

export default config;
