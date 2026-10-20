import { NextResponse } from "next/server";
import { applyCsaHeaders } from "@csa/headers";
import { getCurrentUser } from "@/lib/get-current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai-stats — dashboard counts of AI-assisted ticket work for the
 * signed-in user's active client project. The scope is taken from the server
 * session, never from the request, so a user only ever sees their own project.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view AI activity." }, { status: 401 });
  if (!user.activeClientId || !user.activeProjectKey || user.requiresProjectSelection)
    return NextResponse.json({ error: "Select a client project first." }, { status: 409 });

  const headers = applyCsaHeaders({} as Record<string, string>, {
    userEmail: user.email,
    userRole: user.role,
    clientId: user.activeClientId,
    projectKey: user.activeProjectKey
  });
  try {
    const upstream = await fetch(`${process.env.AI_ASSIST_URL ?? "http://localhost:8080"}/ai-stats`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    return NextResponse.json(await upstream.json(), {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "AI Assist did not respond." }, { status: 502 });
  }
}
