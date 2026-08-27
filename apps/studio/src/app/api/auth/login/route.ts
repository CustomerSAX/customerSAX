import { NextResponse } from "next/server";
import { authServiceUrl, ensureDefaultProjectSelection, setSessionCookie } from "../shared";

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

  if (!response.ok || !payload.token || !payload.expiresAt) {
    return NextResponse.json(
      { error: payload.error ?? "Invalid response from authentication service. The backend might still be deploying." },
      { status: response.ok ? 502 : response.status }
    );
  }

  const user = await ensureDefaultProjectSelection(payload.token, payload.user);
  const nextResponse = NextResponse.json({ expiresAt: payload.expiresAt, user });
  setSessionCookie(nextResponse, payload.token, payload.expiresAt);

  return nextResponse;
}
