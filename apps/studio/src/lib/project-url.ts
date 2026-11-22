import { localeFromPathname, localeToPathSegment, stripLocalePrefix } from "../i18n/routing";

export type UrlProject = { projectKey: string; clientId?: string };
const routeRoots = new Set([
  "dashboard",
  "tickets",
  "customers",
  "orders",
  "products",
  "cart",
  "subscriptions",
  "b2b",
  "calendar",
  "reports",
  "knowledgebase",
  "csa-assistant",
  "algolia-search",
  "admin",
  "admin-settings",
  "profile",
  "superadmin",
  "login",
  "sign-in",
  "select-project",
  "auth",
  "api",
  "organization",
  "organizations"
]);
const unscopedRoots = new Set([
  "login",
  "sign-in",
  "select-project",
  "superadmin",
  "auth",
  "api",
  "organization",
  "organizations"
]);

export function projectPath(pathname: string): { projectKey: string | null; pathname: string } {
  const path = stripLocalePrefix(pathname);
  const [first, ...rest] = path.split("/").filter(Boolean);
  if (!first || routeRoots.has(first)) return { projectKey: null, pathname: path };

  // If any segment is an unscoped root (e.g. /spotlightstores-demo/organization),
  // strip any erroneously prepended project slugs and return the clean unscoped pathname
  const allSegments = [first, ...rest];
  const unscopedIdx = allSegments.findIndex((seg) => unscopedRoots.has(seg));
  if (unscopedIdx !== -1) {
    return { projectKey: null, pathname: `/${allSegments.slice(unscopedIdx).join("/")}` };
  }

  if (!rest.length || !routeRoots.has(rest[0])) return { projectKey: null, pathname: path };
  let projectKey: string;
  try {
    projectKey = decodeURIComponent(first);
  } catch {
    return { projectKey: null, pathname: path };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(projectKey)) return { projectKey: null, pathname: path };
  return { projectKey, pathname: `/${rest.join("/")}` };
}

export function isProjectPage(pathname: string): boolean {
  const stripped = stripLocalePrefix(pathname);
  const segments = stripped.split("/").filter(Boolean);
  if (segments.some((segment) => unscopedRoots.has(segment))) {
    return false;
  }
  const path = projectPath(pathname).pathname;
  const pathSegments = path.split("/").filter(Boolean);
  if (pathSegments.some((segment) => unscopedRoots.has(segment))) {
    return false;
  }
  return true;
}

export function projectHref(href: string, project: UrlProject, projects: UrlProject[] = []): string {
  const url = new URL(href, "https://studio.invalid");
  const locale = localeFromPathname(url.pathname);
  const path = projectPath(url.pathname).pathname;
  if (!isProjectPage(url.pathname) || !isProjectPage(path)) {
    return `${locale ? `/${localeToPathSegment(locale)}` : ""}${path}${url.search}${url.hash}`;
  }
  url.pathname = `${locale ? `/${localeToPathSegment(locale)}` : ""}/${encodeURIComponent(project.projectKey)}${path === "/" ? "/dashboard" : path}`;
  url.searchParams.delete("project");
  const clients = new Set(projects.filter((item) => item.projectKey === project.projectKey).map((item) => item.clientId ?? ""));
  if (project.clientId && clients.size > 1) url.searchParams.set("client", project.clientId);
  else url.searchParams.delete("client");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function projectFromUrl(projects: UrlProject[], key: string, client?: string | null): UrlProject | null {
  const matches = projects.filter(project => project.projectKey === key && (!client || project.clientId === client));
  const unique = new Map(matches.map(project => [`${project.clientId ?? ""}:${project.projectKey}`, project]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
