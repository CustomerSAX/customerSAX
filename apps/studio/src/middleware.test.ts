import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { middleware } from "./middleware";

it.each([
  ["/en-us/b2c-csa/tickets", "/tickets"],
  ["/en-us/rc_b2b_shop_july_2023/b2b/quotes", "/b2b/quotes"],
  ["/fr-fr/b2c-csa/tickets/create", "/tickets/create"],
  ["/en-us/tickets", "/tickets"]
])("rewrites %s to existing app routes", (pathname, route) => {
  const response = middleware(new NextRequest(`http://localhost:3000${pathname}?status=open`, { headers: { cookie: "csa_session=token" } }));
  const rewritten = new URL(response.headers.get("x-middleware-rewrite")!);
  expect(rewritten.pathname).toBe(route);
  expect(rewritten.searchParams.get("status")).toBe("open");
});

it("keeps the full project URL as the login callback", () => {
  const response = middleware(new NextRequest("http://localhost:3000/en-us/b2c-csa/tickets?status=open"));
  const destination = new URL(response.headers.get("location")!);
  expect(destination.pathname).toBe("/en-us/login");
  expect(destination.searchParams.get("callbackUrl")).toBe("/en-us/b2c-csa/tickets?status=open");
});
