import { afterEach, expect, it, vi } from "vitest";
vi.mock("../auth/shared", async original => ({
  ...await original<typeof import("../auth/shared")>(),
  currentSessionToken: async () => "same-session"
}));
import { POST } from "./route";

afterEach(() => vi.unstubAllGlobals());

it("forwards ticket queries with the latest project after switches handled by another instance", async () => {
  let project = "b2c-csa";
  const forwarded: Array<Record<string, string>> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith("/sessions/current")) return Response.json({ user: {
      activeClientId: "client", activeProjectKey: project, role: "admin", email: "agent@example.com", requiresProjectSelection: false
    } });
    forwarded.push(options.headers as Record<string, string>);
    return Response.json({ data: { ticketPage: { results: [] } } });
  }));
  for (const next of ["b2c-csa", "rc_b2b_shop_july_2023", "b2c-csa"]) {
    project = next;
    const response = await POST(new Request("https://studio.example/api/graphql", { method: "POST", body: JSON.stringify({ query: "{ ticketPage { results { id } } }" }) }));
    expect(response.status).toBe(200);
  }
  expect(forwarded.map(headers => headers["x-csa-project-key"])).toEqual(["b2c-csa", "rc_b2b_shop_july_2023", "b2c-csa"]);
  expect(forwarded.every(headers => headers["x-csa-client-id"] === "client")).toBe(true);
});
