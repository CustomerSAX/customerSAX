import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/studio/src")
    }
  }
});
