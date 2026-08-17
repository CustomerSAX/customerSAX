import { describe, it, expect, beforeEach } from "vitest";
import { getOrSet, del, ctProjectConfig, ctToken } from "./index.js";

// No REDIS_URL in the test env → the cache degrades to its in-memory fallback,
// which is exactly the behavior we want to assert (single-flight + hit/miss).
describe("@csa/cache getOrSet (in-memory fallback)", () => {
  beforeEach(async () => {
    await del("t:key");
  });

  it("calls the loader on a miss and caches the result (hit skips the loader)", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { v: calls };
    };
    const first = await getOrSet("t:key", 60, loader);
    expect(first).toEqual({ v: 1 });
    const second = await getOrSet("t:key", 60, loader);
    expect(second).toEqual({ v: 1 }); // cached — loader not called again
    expect(calls).toBe(1);
  });

  it("single-flight: concurrent misses collapse to ONE loader call", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    };
    const results = await Promise.all([
      getOrSet("t:key", 60, loader),
      getOrSet("t:key", 60, loader),
      getOrSet("t:key", 60, loader),
    ]);
    expect(calls).toBe(1);
    expect(results).toEqual([1, 1, 1]);
  });

  it("does not cache a null loader result (transient miss isn't pinned)", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return null;
    };
    await getOrSet("t:key", 60, loader);
    await getOrSet("t:key", 60, loader);
    expect(calls).toBe(2); // null not cached → loader runs again
  });

  it("namespaced key helpers produce stable, collision-safe keys", () => {
    const k = ctProjectConfig("clientA", "projX");
    expect(k).toContain("clientA");
    expect(k).toContain("projX");
    expect(k).toBe(ctProjectConfig("clientA", "projX")); // stable
    expect(k).not.toBe(ctProjectConfig("clientB", "projX")); // collision-safe on clientId
    expect(ctToken("projX", "clientA")).toContain("projX");
  });
});
