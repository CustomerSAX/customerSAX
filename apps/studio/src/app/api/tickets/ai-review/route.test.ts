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
  new NextRequest("http://localhost:3000/api/tickets/ai-review", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
beforeEach(() => getCurrentUser.mockResolvedValue(user));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ticket review authenticated proxy", () => {
  it("rejects unauthenticated approval", async () => {
    getCurrentUser.mockResolvedValue(null);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await POST(request({ operation: "approve", ticketId: "t1" }))).status).toBe(
      401
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects cross-origin approval", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await POST(
          request({ operation: "approve", ticketId: "t1" }, "https://other.example")
        )
      ).status
    ).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects unknown roles and missing project selection", async () => {
    getCurrentUser.mockResolvedValue({ ...user, role: "viewer" });
    expect((await POST(request({ operation: "approve", ticketId: "t1" }))).status).toBe(
      403
    );
    getCurrentUser.mockResolvedValue({ ...user, activeProjectKey: undefined });
    expect((await POST(request({ operation: "approve", ticketId: "t1" }))).status).toBe(
      409
    );
  });
  it("uses session identity and strips client-supplied actions and identity", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ review: { status: "pending" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST(
      request({
        operation: "approve",
        ticketId: "t1",
        revision: "saved-revision",
        userEmail: "attacker@example.com",
        clientId: "other-client",
        phone: "9999999999",
        action: { customerId: "other-customer" }
      })
    );
    expect(response.status).toBe(200);
    const init = fetcher.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({
      operation: "approve",
      ticketId: "t1",
      revision: "saved-revision"
    });
    expect(new Headers(init.headers).get("x-csa-client-id")).toBe("client-1");
    expect(new Headers(init.headers).get("x-csa-user-email")).toBe("agent@example.com");
  });
});
