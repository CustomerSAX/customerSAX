import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
  type AppLocale
} from "@csa/i18n";
import { localeFromPathname, localizePathname, stripLocalePrefix } from "./i18n/routing";
import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = process.env.AUTH_COOKIE_NAME?.trim() || "csa_session";

const infrastructurePathPrefixes = ["/auth", "/api", "/_next", "/favicon.ico"];
const publicPagePrefixes = ["/login", "/sign-in", "/select-project"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isInfrastructurePath(pathname) || hasPublicFileExtension(pathname)) {
    return NextResponse.next();
  }

  const pathLocale = localeFromPathname(pathname);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = pathLocale ??
    (cookieLocale && isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE);

  if (!pathLocale) {
    const destination = request.nextUrl.clone();
    destination.pathname = localizePathname(pathname === "/" ? "/dashboard" : pathname, locale);
    const response = NextResponse.redirect(destination);
    setLocaleCookie(response, locale);
    return response;
  }

  const appPathname = stripLocalePrefix(pathname);
  const canonicalPathname = localizePathname(appPathname, locale);
  if (pathname !== canonicalPathname) {
    const destination = request.nextUrl.clone();
    destination.pathname = canonicalPathname;
    return NextResponse.redirect(destination);
  }

  const devBypass = process.env.NODE_ENV === "development" && process.env.SKIP_AUTH === "1";
  const isPublicPage = isPublicPagePath(appPathname);
  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (!devBypass && !isPublicPage && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = localizePathname("/login", locale);
    loginUrl.search = "";
    if (appPathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return rewriteLocalizedRequest(request, appPathname, locale);
}

function rewriteLocalizedRequest(request: NextRequest, appPathname: string, locale: AppLocale) {
  const destination = request.nextUrl.clone();
  destination.pathname = appPathname;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csa-locale", locale);

  const response = NextResponse.rewrite(destination, {
    request: { headers: requestHeaders }
  });
  setLocaleCookie(response, locale);
  return response;
}

function setLocaleCookie(response: NextResponse, locale: AppLocale) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax"
  });
}

function isInfrastructurePath(pathname: string) {
  return infrastructurePathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isPublicPagePath(pathname: string) {
  return publicPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasPublicFileExtension(pathname: string) {
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$/i.test(pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
