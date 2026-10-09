import { NextResponse } from "next/server";
import {
  authServiceUrl,
  currentSessionToken,
  ensureDefaultProjectSelection,
  enrichUserWithOrganizationTheme
} from "../shared";

export async function GET() {
  const token = await currentSessionToken();

  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const response = await fetch(`${authServiceUrl()}/sessions/current`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.user) {
      payload.user = await ensureDefaultProjectSelection(token, payload.user);
      payload.user = await enrichUserWithOrganizationTheme(payload.user);
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[api/auth/me] Auth service error:", error);
    return NextResponse.json({ error: "Failed to communicate with auth service" }, { status: 502 });
  }
}
