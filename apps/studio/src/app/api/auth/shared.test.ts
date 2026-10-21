import { afterEach, expect, it, vi } from "vitest";
import { getValidatedSession } from "./shared";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("reads the latest project on the same token without instance-local invalidation", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ user: { activeClientId: "client", activeProjectKey: "b2c-csa" } }))
    .mockResolvedValueOnce(Response.json({ user: { activeClientId: "client", activeProjectKey: "rc_b2b_shop_july_2023" } }))
    .mockResolvedValueOnce(Response.json({ user: { activeClientId: "client", activeProjectKey: "b2c-csa" } }));
  vi.stubGlobal("fetch", fetcher);
  expect((await getValidatedSession("same-token"))?.user.activeProjectKey).toBe("b2c-csa");
  expect((await getValidatedSession("same-token"))?.user.activeProjectKey).toBe("rc_b2b_shop_july_2023");
  expect((await getValidatedSession("same-token"))?.user.activeProjectKey).toBe("b2c-csa");
  expect(fetcher).toHaveBeenCalledTimes(3);
  for (const [, options] of fetcher.mock.calls) expect(options).toMatchObject({ cache: "no-store", headers: { authorization: "Bearer same-token" } });
});

it("does not reuse a session after Auth revokes it", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ user: { activeClientId: "first-client" } })).mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await getValidatedSession("revoked-token")).not.toBeNull();
  expect(await getValidatedSession("revoked-token")).toBeNull();
});
