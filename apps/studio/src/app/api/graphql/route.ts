import { NextResponse } from "next/server";
import { applyCsaHeaders } from "@csa/headers";
import { authServiceUrl, currentSessionToken, ensureDefaultProjectSelection } from "../auth/shared";

const bffUrl =
  process.env.BFF_URL?.trim() ||
  process.env.AI_COMMERCE_SERVICE_URL?.trim() ||
  "http://127.0.0.1:4000/graphql";

export async function POST(request: Request) {
  try {
    const token = await currentSessionToken();
    if (!token) return NextResponse.json({ errors: [{ message: "unauthenticated" }] }, { status: 401 });
    const sessionResponse = await fetch(`${authServiceUrl()}/sessions/current`, {
      headers: { authorization: `Bearer ${token}` }, cache: "no-store"
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) return NextResponse.json({ errors: [{ message: "unauthenticated" }] }, { status: 401 });
    session.user = await ensureDefaultProjectSelection(token, session.user);
    if (session.user?.requiresProjectSelection) {
      return NextResponse.json({ errors: [{ message: "project selection required" }] }, { status: 409 });
    }
    const headers = applyCsaHeaders({ "content-type": "application/json" } as Record<string, string>, {
      projectKey: session.user.activeProjectKey,
      clientId: session.user.activeClientId,
      userRole: session.user.role,
      userEmail: session.user.email
    });
    const requestBody = await request.text();
    const response = await fetch(bffUrl, {
      method: "POST",
      headers,
      body: requestBody,
      cache: "no-store"
    });
    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" }
    });
  } catch (err) {
    console.error("[api/graphql] Route error:", err);
    return NextResponse.json(
      { errors: [{ message: err instanceof Error ? err.message : String(err) }] },
      { status: 500 }
    );
  }
}
