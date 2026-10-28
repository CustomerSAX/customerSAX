import { localeFromPathname, localeToPathSegment, stripLocalePrefix } from "../i18n/routing";

export type UrlProject = { projectKey: string; clientId?: string };
const routeRoots = new Set(["dashboard", "tickets", "customers", "orders", "products", "cart", "subscriptions", "b2b", "calendar", "reports", "knowledgebase", "csa-assistant", "agent-mode", "algolia-search", "admin", "admin-settings", "profile", "superadmin", "login", "sign-in", "select-project", "auth", "api", "organizations"]);
const unscopedRoots = new Set(["login", "sign-in", "select-project", "superadmin", "auth", "api", "organizations"]);

export function projectPath(pathname: string): { projectKey: string | null; pathname: string } {
  const path = stripLocalePrefix(pathname);
  const [first, ...rest] = path.split("/").filter(Boolean);
  if (!first || routeRoots.has(first) || !rest.length || !routeRoots.has(rest[0]) || unscopedRoots.has(rest[0])) return { projectKey: null, pathname: path };
  let projectKey: string;
  try { projectKey = decodeURIComponent(first); } catch { return { projectKey: null, pathname: path }; }
  if (!/^[a-zA-Z0-9_-]+$/.test(projectKey)) return { projectKey: null, pathname: path };
  return { projectKey, pathname: `/${rest.join("/")}` };
}

export function isProjectPage(pathname: string): boolean {
  const path = projectPath(pathname).pathname;
  return !unscopedRoots.has(path.split("/")[1]);
}

export function projectHref(href: string, project: UrlProject, projects: UrlProject[] = []): string {
  const url = new URL(href, "https://studio.invalid");
  const locale = localeFromPathname(url.pathname);
  const path = projectPath(url.pathname).pathname;
  if (!isProjectPage(path)) return `${url.pathname}${url.search}${url.hash}`;
  url.pathname = `${locale ? `/${localeToPathSegment(locale)}` : ""}/${encodeURIComponent(project.projectKey)}${path === "/" ? "/dashboard" : path}`;
  url.searchParams.delete("project");
  const clients = new Set(projects.filter(item => item.projectKey === project.projectKey).map(item => item.clientId ?? ""));
  if (project.clientId && clients.size > 1) url.searchParams.set("client", project.clientId);
  else url.searchParams.delete("client");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function projectFromUrl(projects: UrlProject[], key: string, client?: string | null): UrlProject | null {
  const matches = projects.filter(project => project.projectKey === key && (!client || project.clientId === client));
  const unique = new Map(matches.map(project => [`${project.clientId ?? ""}:${project.projectKey}`, project]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
