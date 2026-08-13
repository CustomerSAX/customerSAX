import { NextResponse } from "next/server";
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
  const response = await fetch(bffUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(session.user.activeProjectKey ? { "x-csa-project-key": session.user.activeProjectKey } : {}),
      ...(session.user.activeClientId ? { "x-csa-client-id": session.user.activeClientId } : {}),
      ...(session.user.role ? { "x-csa-user-role": session.user.role } : {}),
      ...(session.user.email ? { "x-csa-user-email": session.user.email } : {})
    },
    body: await request.text(),
    cache: "no-store"
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" }
  });
}
