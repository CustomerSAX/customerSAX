import { NextResponse } from "next/server";
import { applyCsaHeaders } from "@csa/headers";
import { authServiceUrl, currentSessionToken } from "../auth/shared";

const bffUrl = process.env.AI_COMMERCE_SERVICE_URL?.trim() || "http://localhost:4000/graphql";

export async function POST(request: Request) {
  const token = currentSessionToken();
  if (!token) return NextResponse.json({ errors: [{ message: "unauthenticated" }] }, { status: 401 });
  const sessionResponse = await fetch(`${authServiceUrl()}/sessions/current`, {
    headers: { authorization: `Bearer ${token}` }, cache: "no-store"
  });
  const session = await sessionResponse.json().catch(() => ({}));
  if (!sessionResponse.ok) return NextResponse.json({ errors: [{ message: "unauthenticated" }] }, { status: 401 });
  if (session.user?.requiresProjectSelection) {
    return NextResponse.json({ errors: [{ message: "project selection required" }] }, { status: 409 });
  }
  const headers = applyCsaHeaders({ "content-type": "application/json" } as Record<string, string>, {
    projectKey: session.user.activeProjectKey,
    clientId: session.user.activeClientId,
    userRole: session.user.role,
    userEmail: session.user.email
  });
  const response = await fetch(bffUrl, {
    method: "POST",
    headers,
    body: await request.text(),
    cache: "no-store"
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" }
  });
}
