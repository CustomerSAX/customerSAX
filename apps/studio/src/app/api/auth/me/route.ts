import { NextResponse } from "next/server";
import { authServiceUrl, currentSessionToken } from "../shared";

export async function GET() {
  const token = currentSessionToken();

  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const response = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));

  return NextResponse.json(payload, { status: response.status });
}
