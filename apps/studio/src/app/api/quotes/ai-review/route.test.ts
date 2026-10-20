import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser }));
import { POST } from "./route";

const user = {
  email: "agent@example.com",
  role: "agent",
  activeClientId: "client-1",
  activeProjectKey: "project-1"
};
const request = (body: unknown, origin = "http://localhost:3000") =>
  new NextRequest("http://localhost:3000/api/quotes/ai-review", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
beforeEach(() => getCurrentUser.mockResolvedValue(user));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("quote review authenticated proxy", () => {
  it("rejects unauthenticated and cross-origin approval", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    getCurrentUser.mockResolvedValueOnce(null);
    expect((await POST(request({ operation: "approve", quoteId: "q1" }))).status).toBe(401);
    expect(
      (await POST(request({ operation: "approve", quoteId: "q1" }, "https://other.example"))).status
    ).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects unknown roles and missing project selection", async () => {
    getCurrentUser.mockResolvedValue({ ...user, role: "viewer" });
    expect((await POST(request({ operation: "approve", quoteId: "q1" }))).status).toBe(403);
    getCurrentUser.mockResolvedValue({ ...user, activeProjectKey: undefined });
    expect((await POST(request({ operation: "approve", quoteId: "q1" }))).status).toBe(409);
  });
  it("uses session identity and strips client-supplied state and identity", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ review: { status: "pending" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(
      request({
        operation: "approve",
        quoteId: "q1",
        revision: "saved-revision",
        state: "Accepted",
        expectedVersion: 99,
        userEmail: "attacker@example.com",
        clientId: "other-client"
      })
    );
    expect(response.status).toBe(200);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain("/quote-review");
    expect(JSON.parse(init.body)).toEqual({
      operation: "approve",
      quoteId: "q1",
      revision: "saved-revision"
    });
    expect(new Headers(init.headers).get("x-csa-client-id")).toBe("client-1");
    expect(new Headers(init.headers).get("x-csa-user-email")).toBe("agent@example.com");
  });
});
