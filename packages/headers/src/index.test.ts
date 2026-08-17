import { describe, it, expect } from "vitest";
import { CSA_HEADERS, headerValue, readCsaContext, applyCsaHeaders } from "./index";

describe("@csa/headers", () => {
  it("headerValue normalizes array→first, string→string, undefined/empty→undefined", () => {
    expect(headerValue(["a", "b"])).toBe("a");
    expect(headerValue("x")).toBe("x");
    expect(headerValue(undefined)).toBeUndefined();
    expect(headerValue([])).toBeUndefined();
  });

  it("readCsaContext reads x-csa-* from a node-style header record (array coalesced)", () => {
    const ctx = readCsaContext({
      headers: {
        [CSA_HEADERS.projectKey]: "proj-1",
        [CSA_HEADERS.clientId]: "client-1",
        [CSA_HEADERS.requestId]: ["req-1", "req-2"],
      },
    });
    expect(ctx.projectKey).toBe("proj-1");
    expect(ctx.clientId).toBe("client-1");
    expect(ctx.requestId).toBe("req-1");
    expect(ctx.userEmail).toBeUndefined();
  });

  it("readCsaContext reads from a fetch-style Headers (.get)", () => {
    const h = new Headers();
    h.set(CSA_HEADERS.userRole, "agent");
    const ctx = readCsaContext({ headers: h });
    expect(ctx.userRole).toBe("agent");
    expect(ctx.projectKey).toBeUndefined();
  });

  it("applyCsaHeaders writes only present fields (undefined never forwarded)", () => {
    const out: Record<string, string> = {};
    applyCsaHeaders(out, { projectKey: "p", clientId: undefined, requestId: "r" });
    expect(out[CSA_HEADERS.projectKey]).toBe("p");
    expect(out[CSA_HEADERS.requestId]).toBe("r");
    expect(CSA_HEADERS.clientId in out).toBe(false);
  });

  it("round-trips apply → read across a fetch Headers", () => {
    const wire = new Headers();
    applyCsaHeaders(wire, { projectKey: "p", userEmail: "a@b.com", requestId: "rid" });
    const ctx = readCsaContext({ headers: wire });
    expect(ctx).toMatchObject({ projectKey: "p", userEmail: "a@b.com", requestId: "rid" });
    expect(ctx.clientId).toBeUndefined();
  });
});
