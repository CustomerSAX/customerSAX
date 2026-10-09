import { NextResponse } from "next/server";
import { currentSessionToken, ensureDefaultProjectSelection, enrichUserWithOrganizationTheme, getValidatedSession } from "../shared";

export async function GET() {
  const token = await currentSessionToken();

  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const session = await getValidatedSession(token);
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const payload: Record<string, any> = { ...session };
  payload.user = await ensureDefaultProjectSelection(token, payload.user);
  payload.user = await enrichUserWithOrganizationTheme(payload.user);

  return NextResponse.json(payload, { status: 200 });
}


