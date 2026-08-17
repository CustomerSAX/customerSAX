import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const sessionCookieName = process.env.AUTH_COOKIE_NAME?.trim() || "csa_session";

export function authServiceUrl() {
  return process.env.AUTH_SERVICE_URL?.trim() || "http://localhost:4360";
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(sessionCookieName, token, {
    expires: new Date(expiresAt),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function currentSessionToken() {
  return cookies().get(sessionCookieName)?.value;
}
