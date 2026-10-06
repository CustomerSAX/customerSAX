import { beforeEach, expect, it, vi } from "vitest";
const resolve = vi.hoisted(() => vi.fn());
vi.mock("@csa/mongodb", () => ({ resolveProjectProducts: resolve }));
import { projectProductsConfiguration } from "./configuration.js";
beforeEach(() => vi.clearAllMocks());
it("uses trusted context and ignores caller-supplied tenant arguments", async () => {
  resolve.mockResolvedValue({ provider: "commercetools" });
  await expect(
    projectProductsConfiguration(
      null,
      { clientId: "other", projectKey: "other" },
      {
        clientId: "client",
        projectKey: "project",
        userEmail: "agent@example.test"
      }
    )
  ).resolves.toEqual({ provider: "commercetools" });
  expect(resolve).toHaveBeenCalledWith("client", "project");
});
it.each([
  {},
  { clientId: "client", projectKey: "project" },
  { clientId: "client", userEmail: "agent@example.test" },
  { projectKey: "project", userEmail: "agent@example.test" }
])("rejects incomplete authenticated project identity", async (context) => {
  await expect(projectProductsConfiguration(null, {}, context)).rejects.toThrow(
    "authenticated active project"
  );
  expect(resolve).not.toHaveBeenCalled();
});
