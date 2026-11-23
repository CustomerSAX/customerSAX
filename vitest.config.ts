import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Standalone Merchant Center applications own their dependencies and
      // test runners, and are intentionally outside the root pnpm workspace.
      "**/merchant-center-apps/**"
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/studio/src")
    }
  }
});
