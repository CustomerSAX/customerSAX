import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = process.env.AUTH_COOKIE_NAME?.trim() || "csa_session";

const publicPathPrefixes = [
  "/login",
  "/api/auth",
  "/_next",
  "/favicon.ico"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || hasPublicFileExtension(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (hasSession) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);

  if (pathname !== "/") {
    loginUrl.searchParams.set("callbackUrl", pathname);
  }

  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasPublicFileExtension(pathname: string) {
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$/i.test(pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
