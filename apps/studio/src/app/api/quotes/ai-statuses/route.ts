import { NextRequest, NextResponse } from "next/server";
import { applyCsaHeaders } from "@csa/headers";
import { getCurrentUser } from "@/lib/get-current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only: returns saved AI review statuses for the visible quote rows. Never starts analysis. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to view AI status." }, { status: 401 });
  if (!user.activeClientId || !user.activeProjectKey || user.requiresProjectSelection)
    return NextResponse.json({ error: "Select a client project first." }, { status: 409 });
  if (!["agent", "admin", "superadmin"].includes(user.role))
    return NextResponse.json({ error: "AI status is not available for your role." }, { status: 403 });
  let quotes: unknown;
  try {
    quotes = ((await request.json()) as { quotes?: unknown }).quotes;
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
      `${process.env.AI_ASSIST_URL ?? "http://localhost:8080"}/quote-review/statuses`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ quotes })
      }
    );
    return NextResponse.json(await upstream.json(), {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "AI review status is unavailable." }, { status: 502 });
  }
}
