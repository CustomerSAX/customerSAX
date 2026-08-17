import { NextResponse } from "next/server";
import { authServiceUrl, setSessionCookie } from "../shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const response = await fetch(`${authServiceUrl()}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password
    }),
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({ error: payload.error ?? "invalid credentials" }, { status: response.status });
  }

  const nextResponse = NextResponse.json({ expiresAt: payload.expiresAt, user: payload.user });
  setSessionCookie(nextResponse, payload.token, payload.expiresAt);

  return nextResponse;
}
