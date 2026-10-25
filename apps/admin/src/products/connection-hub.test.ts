import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@csa/mongodb", () => ({ assertProjectProductsScope: vi.fn() }));
vi.mock("@csa/connection-hub", () => ({
  algoliaHub: { forProject: vi.fn(), search: vi.fn() }
}));
import { assertProjectProductsScope } from "@csa/mongodb";
import { algoliaHub } from "@csa/connection-hub";
import { projectConnectionHubProducts } from "./connection-hub.js";
const identity = {
  clientId: "client-a",
  projectKey: "project-a",
  userEmail: "agent@example.test",
  userRole: "CSA Agent"
};
beforeEach(() => {
  vi.resetAllMocks();
});
it("checks project ownership before resolving the selected connector", async () => {
  vi.mocked(assertProjectProductsScope).mockRejectedValue(new Error("foreign project"));
  await expect(projectConnectionHubProducts(null, {}, identity)).rejects.toThrow();
  expect(algoliaHub.forProject).not.toHaveBeenCalled();
});
it("returns a Native routing signal only when Algolia is not selected", async () => {
  vi.mocked(algoliaHub.forProject).mockResolvedValue(undefined);
  expect(await projectConnectionHubProducts(null, {}, identity)).toEqual({
    selected: false,
    results: [],
    total: null
  });
  expect(algoliaHub.search).not.toHaveBeenCalled();
});
it("does not turn a Hub outage into a Native routing signal", async () => {
  vi.mocked(algoliaHub.forProject).mockRejectedValue(new Error("secret-upstream"));
  await expect(projectConnectionHubProducts(null, {}, identity)).rejects.toThrow(
    "Algolia search is unavailable"
  );
});
it("rejects anonymous and missing project context before connector lookup", async () => {
  await expect(projectConnectionHubProducts(null, {}, {})).rejects.toThrow();
  expect(assertProjectProductsScope).not.toHaveBeenCalled();
  expect(algoliaHub.forProject).not.toHaveBeenCalled();
});

it("executes using the verified project's scope and preserves provider records", async () => {
  const config = {url: "http://localhost:3100", apiKey: "synthetic-execution", tenantId: "workspace", clientId: "client-a", production: false, privateHub: false};
  const scope = {config, projectKey: "project-a", bindings: []};
  vi.mocked(algoliaHub.forProject).mockResolvedValue(scope);
  vi.mocked(algoliaHub.search).mockResolvedValue({results: [{objectID: "external-42", title: "Actual provider field"}], total: 1});
  expect(await projectConnectionHubProducts(null, {query: "shoes", limit: 5}, identity)).toEqual({selected: true, results: [{objectID: "external-42", title: "Actual provider field"}], total: 1});
  expect(algoliaHub.search).toHaveBeenCalledWith({scope, query: "shoes", limit: 5});
});
