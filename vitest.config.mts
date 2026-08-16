import { defineConfig } from "vitest/config";

/**
 * Workspace test runner. Hermetic unit tests co-located with the source they
 * cover (`*.test.ts`) across packages/* and apps/*. No live Mongo/Redis/network —
 * infra clients degrade to their in-memory fallbacks in the test environment.
 */
export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    environment: "node",
    passWithNoTests: false,
  },
});
