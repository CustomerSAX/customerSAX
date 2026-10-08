import { NextRequest, NextResponse } from "next/server";
import { applyCsaHeaders } from "@csa/headers";
import { getCurrentUser } from "@/lib/get-current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (
    (request.headers.get("origin") &&
      request.headers.get("origin") !== request.nextUrl.origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 }
    );
  }
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to review ticket actions." },
      { status: 401 }
    );
  if (!user.activeClientId || !user.activeProjectKey || user.requiresProjectSelection)
    return NextResponse.json(
      { error: "Select a client project first." },
      { status: 409 }
    );
  if (!["agent", "admin", "superadmin"].includes(user.role))
    return NextResponse.json(
      { error: "You cannot approve customer changes." },
      { status: 403 }
    );
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid body");
    body = value;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const headers = applyCsaHeaders(
    { "content-type": "application/json" } as Record<string, string>,
    {
      userEmail: user.email,
      userRole: user.role,
      clientId: user.activeClientId,
      projectKey: user.activeProjectKey
    }
  );
  try {
    const upstream = await fetch(
      `${process.env.AI_ASSIST_URL ?? "http://localhost:8080"}/ticket-review`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(70000),
        body: JSON.stringify({
          operation: body.operation,
          ticketId: body.ticketId,
          revision: body.revision,
          refresh: body.refresh,
          addressId: body.addressId,
          resolutionNotes: body.resolutionNotes
        })
      }
    );
    return NextResponse.json(await upstream.json(), {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "AI Assist did not respond. Reload the proposal to check its status before trying again."
      },
      { status: 502 }
    );
  }
}
