import { NextResponse } from "next/server";
import { authServiceUrl, currentSessionToken } from "../shared";

export async function POST(request: Request) {
  const token = await currentSessionToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const postBody: Record<string, unknown> = { projectKey: body.projectKey };
  if (body.clientId) postBody.clientId = body.clientId;
  const response = await fetch(`${authServiceUrl()}/sessions/current/project`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(postBody),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });

}
