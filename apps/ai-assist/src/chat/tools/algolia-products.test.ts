import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../commerce/graphql-client.js", () => ({
  bffQuery: vi.fn(),
  formatMoney: vi.fn()
}));
vi.mock("../system-prompt.js", () => ({
  getSystemPromptContext: vi.fn(),
  contextStorage: {}
}));
vi.mock("@csa/mongodb", () => ({ withIdempotency: vi.fn() }));
import { bffQuery } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { searchProductsTool, listProductsTool } from "./commerce.js";
const options = { toolCallId: "test", messages: [], context: {} };
const search = () =>
  searchProductsTool.execute!({ query: "shoes", currency: "USD", limit: 10 }, options);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSystemPromptContext).mockReturnValue({
    userEmail: "agent@example.test",
    userRole: "CSA Agent",
    clientId: "client-a",
    projectKey: "project-a",
    canViewProducts: true
  });
});
it("routes selected Algolia to read-only records without commerce cards or invented IDs", async () => {
  const records = [{ objectID: "external-42", title: "From index", price: 17 }];
  vi.mocked(bffQuery).mockResolvedValue({
    projectConnectionHubProducts: { selected: true, results: records, total: 1 }
  });
  const result = await search();
  expect(result).toMatchObject({ source: "algolia", records, total: 1 });
  expect(result).not.toHaveProperty("products");
  expect(bffQuery).toHaveBeenCalledTimes(1);
  expect(bffQuery).toHaveBeenCalledWith(
    expect.stringContaining("projectConnectionHubProducts"),
    { query: "shoes", limit: 10 }
  );
});
it("keeps the native search and card response when Algolia is not selected", async () => {
  vi.mocked(bffQuery)
    .mockResolvedValueOnce({
      projectConnectionHubProducts: { selected: false, results: [], total: null }
    })
    .mockResolvedValueOnce({ productSearch: { results: [], total: 0 } });
  expect(await search()).toMatchObject({ products: [], total: 0, currency: "USD" });
  expect(bffQuery).toHaveBeenLastCalledWith(expect.stringContaining("productSearch("), {
    text: "shoe",
    browse: false,
    currency: "USD",
    limit: 10,
    offset: 0
  });
});
it("reports Hub failures and never substitutes the native catalog or upstream secrets", async () => {
  vi.mocked(bffQuery).mockRejectedValue(new Error("secret-upstream"));
  const result = await search();
  expect(result).toHaveProperty("error");
  expect(JSON.stringify(result)).not.toContain("secret-upstream");
  expect(bffQuery).toHaveBeenCalledTimes(1);
});
it("preserves unknown browse totals and honest empty search results", async () => {
  vi.mocked(bffQuery).mockResolvedValue({
    projectConnectionHubProducts: { selected: true, results: [], total: null }
  });
  expect(
    await listProductsTool.execute!({ currency: "USD", limit: 10, offset: 0 }, options)
  ).toMatchObject({ source: "algolia", records: [], count: 0, total: null });
});
it("does not fall back for unsupported Hub pagination", async () => {
  vi.mocked(bffQuery).mockResolvedValue({
    projectConnectionHubProducts: { selected: true, results: [], total: null }
  });
  expect(
    await listProductsTool.execute!({ currency: "USD", limit: 10, offset: 10 }, options)
  ).toHaveProperty("error");
  expect(bffQuery).toHaveBeenCalledTimes(1);
});
it("enforces Products permissions before requesting data", async () => {
  vi.mocked(getSystemPromptContext).mockReturnValue({
    userEmail: "agent@example.test",
    userRole: "CSA Agent",
    clientId: "client-a",
    projectKey: "project-a",
    canViewProducts: false
  });
  expect(await search()).toHaveProperty("error");
  expect(bffQuery).not.toHaveBeenCalled();
});
