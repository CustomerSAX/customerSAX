import { NextRequest, NextResponse } from "next/server";
import { currentSessionToken, getValidatedSession } from "../../auth/shared";
import {
  connectionHubCatalog,
  HubCatalogError
} from "../../../../lib/connection-hub-catalog";
import { requestLogger } from "../../../../lib/request-logger";

export async function GET(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/connection-hub/connectors");
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const token = await currentSessionToken();
    if (!token)
      return NextResponse.json(
        { ok: false, error: "Sign in to view connectors." },
        { status: 401, headers }
      );
    const session = await getValidatedSession(token);
    if (!session?.user)
      return NextResponse.json(
        { ok: false, error: "Sign in to view connectors." },
        { status: 401, headers }
      );
    if (!["admin", "superadmin"].includes(session.user.role))
      return NextResponse.json(
        { ok: false, error: "Administrator access is required." },
        { status: 403, headers }
      );
    const connectors = await connectionHubCatalog.list();
    return NextResponse.json({ ok: true, connectors }, { headers });
  } catch (error) {
    const status = error instanceof HubCatalogError ? error.status : 502;
    log.error("Connection Hub catalog request failed", undefined, { status, requestId });
    return NextResponse.json(
      { ok: false, error: "Unable to load Connection Hub connectors. Please try again." },
      { status, headers }
    );
  }
}
