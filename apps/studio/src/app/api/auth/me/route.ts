import { NextResponse } from "next/server";
import { authServiceUrl, currentSessionToken, ensureDefaultProjectSelection } from "../shared";

export async function GET() {
  const token = await currentSessionToken();

  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const response = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload.user) {
    payload.user = await ensureDefaultProjectSelection(token, payload.user);
  }

  return NextResponse.json(payload, { status: response.status });
}
