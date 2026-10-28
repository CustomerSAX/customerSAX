import { expect, it } from "vitest";
import { isProjectPage, projectFromUrl, projectHref, projectPath } from "./project-url";

it("adds the selected project between locale and page", () => {
  expect(projectHref("/en-us/tickets", { projectKey: "b2c-csa" })).toBe("/en-us/b2c-csa/tickets");
  expect(projectHref("/en-us/b2c-csa/tickets?status=open#results", { projectKey: "rc_b2b_shop_july_2023" })).toBe("/en-us/rc_b2b_shop_july_2023/tickets?status=open#results");
  expect(projectHref("/fr-fr/orders/123", { projectKey: "b2c-csa" })).toBe("/fr-fr/b2c-csa/orders/123");
});

it("preserves native B2B route detection and ticket detail IDs", () => {
  expect(projectPath("/en-us/rc_b2b_shop_july_2023/b2b/orders")).toEqual({ projectKey: "rc_b2b_shop_july_2023", pathname: "/b2b/orders" });
  expect(projectPath("/en-us/b2c-csa/tickets/zendesk%3Aaccount%3A42").pathname).toBe("/tickets/zendesk%3Aaccount%3A42");
  expect(projectPath("/en-us/tickets/create")).toEqual({ projectKey: null, pathname: "/tickets/create" });
  expect(projectPath("/en-us/orders/123").projectKey).toBeNull();
  expect(projectPath("/en-us/b2c-csa/agent-mode")).toEqual({ projectKey: "b2c-csa", pathname: "/agent-mode" });
  expect(projectHref("/en-us/agent-mode", { projectKey: "b2c-csa" })).toBe("/en-us/b2c-csa/agent-mode");
  expect(projectHref("/en-us/b2c-csa/agent-mode", { projectKey: "b2c-csa" })).toBe("/en-us/b2c-csa/agent-mode");
});

it("keeps login and organization administration outside project URLs", () => {
  expect(isProjectPage("/en-us/login")).toBe(false);
  expect(isProjectPage("/en-us/superadmin/clients")).toBe(false);
  expect(projectHref("/en-us/login?callbackUrl=abc", { projectKey: "b2c-csa" })).toBe("/en-us/login?callbackUrl=abc");
});

it("disambiguates identical project keys across clients without duplicating prefixes", () => {
  const projects = [{ clientId: "one", projectKey: "store" }, { clientId: "two", projectKey: "store" }];
  expect(projectFromUrl(projects, "store")).toBeNull();
  expect(projectFromUrl(projects, "store", "two")).toEqual(projects[1]);
  expect(projectHref("/en-us/store/tickets", projects[1], projects)).toBe("/en-us/store/tickets?client=two");
  expect(projectFromUrl([projects[0], projects[0]], "store")).toEqual(projects[0]);
  expect(projectFromUrl(projects, "unauthorized")).toBeNull();
});
