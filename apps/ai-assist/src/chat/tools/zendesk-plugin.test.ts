import { beforeEach, expect, it, vi } from "vitest";
import { bffQuery } from "../../commerce/graphql-client.js";
import { getSystemPromptContext } from "../system-prompt.js";
import { searchZendeskPluginTool } from "./tickets.js";
vi.mock("../../commerce/graphql-client.js", () => ({ bffQuery: vi.fn() }));
vi.mock("../system-prompt.js", () => ({ getSystemPromptContext: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSystemPromptContext).mockReturnValue({ userEmail: "agent@example.test", userRole: "CSA Agent", projectKey: "project-a", clientId: "client-a", canViewTickets: true });
});
const run = () => searchZendeskPluginTool.execute!({ query: "status:open", limit: 10 }, { toolCallId: "test", messages: [], context: {} });
it("uses the explicit plugin query instead of native ticket search", async () => {
  const results = { results: [{ id: "42", subject: "Delivery", status: "open" }], count: 1, total: 1 };
  vi.mocked(bffQuery).mockResolvedValue({ zendeskPluginTickets: results });
  expect(await run()).toEqual(results);
  expect(bffQuery).toHaveBeenCalledWith(expect.stringContaining("zendeskPluginTickets"), { query: "status:open", limit: 10 });
});
it("rejects ticket access without ACL or tenant context", async () => {
  vi.mocked(getSystemPromptContext).mockReturnValue({ userEmail: "agent@example.test", userRole: "CSA Agent", projectKey: "project-a", canViewTickets: false });
  expect(await run()).toHaveProperty("error");
  expect(bffQuery).not.toHaveBeenCalled();
});
it("does not leak upstream errors or fall back to native tickets", async () => {
  vi.mocked(bffQuery).mockRejectedValue(new Error("private-upstream-detail"));
  const result = await run();
  expect(result).toHaveProperty("error", expect.stringContaining("Do not fall back"));
  expect(JSON.stringify(result)).not.toContain("private-upstream-detail");
  expect(bffQuery).toHaveBeenCalledTimes(1);
});
