import { beforeEach, expect, it, vi } from "vitest";

const bffQuery = vi.hoisted(() => vi.fn());
const ctx = vi.hoisted(() => ({ userEmail: "rep@example.com" }));
vi.mock("../../commerce/graphql-client.js", () => ({ bffQuery }));
vi.mock("../system-prompt.js", () => ({ getSystemPromptContext: () => ctx }));

const { searchTicketsTool, withSlaTiming } = await import("./tickets.js");
const run = (args: Record<string, unknown>) =>
  (searchTicketsTool.execute as unknown as (a: Record<string, unknown>, o: unknown) => Promise<Record<string, unknown>>)({ limit: 10, ...args }, {});

beforeEach(() => {
  bffQuery.mockReset();
  ctx.userEmail = "rep@example.com";
});

it("searches the logged-in rep's tickets by soonest SLA deadline", async () => {
  bffQuery.mockResolvedValueOnce({ ticketPage: { results: [], total: 0 } });
  await run({ assignee: "me", sortBy: "sla" });
  expect(bffQuery.mock.calls[0][1]).toMatchObject({ assignee: "rep@example.com", sortKey: "slaDueAt", sortOrder: "asc" });
});

it("maps 'unassigned' to the queue and keeps the default order otherwise", async () => {
  bffQuery.mockResolvedValueOnce({ ticketPage: { results: [], total: 0 } });
  await run({ assignee: "unassigned" });
  expect(bffQuery.mock.calls[0][1]).toMatchObject({ assignee: "Queue" });
  expect(bffQuery.mock.calls[0][1]).not.toHaveProperty("sortKey");
});

it("refuses 'me' when the session has no real rep email instead of returning an empty list", async () => {
  ctx.userEmail = "unknown@csa.local";
  expect(await run({ assignee: "me" })).toEqual({ error: expect.stringContaining("isn't known") });
  expect(bffQuery).not.toHaveBeenCalled();
});

it("adds minutes from now to each ticket's SLA focus clock", async () => {
  const now = Date.now();
  bffQuery.mockResolvedValueOnce({
    ticketPage: {
      total: 2,
      results: [
        { id: "a", sla: { state: "breached", focus: { key: "first_response", dueAt: new Date(now - 12 * 60_000).toISOString() } } },
        { id: "b", sla: null }
      ]
    }
  });
  const result = (await run({ sortBy: "sla" })) as { results: Array<{ sla: { focus: { minutesFromNow: number } } | null }> };
  expect(result.results[0].sla?.focus.minutesFromNow).toBe(-12);
  expect(result.results[1].sla).toBeNull();
});

it("leaves tickets without a focus clock untouched", () => {
  expect(withSlaTiming({ sla: { state: "none", focus: null } })).toEqual({ sla: { state: "none", focus: null } });
});
