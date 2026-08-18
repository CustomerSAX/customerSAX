import { NextResponse } from "next/server";
import { authServiceUrl, currentSessionToken } from "../shared";

export async function POST(request: Request) {
  const token = await currentSessionToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${authServiceUrl()}/sessions/current/project`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ projectKey: body.projectKey, clientId: body.clientId }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
