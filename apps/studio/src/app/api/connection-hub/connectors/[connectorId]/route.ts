import { NextRequest, NextResponse } from "next/server";
import {
  connectionHubManagement,
  HubManagementError
} from "@/lib/connection-hub-management";
import { requestLogger } from "@/lib/request-logger";

export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectorId: string }> }
) {
  const { log, requestId } = requestLogger(
    request,
    "api/connection-hub/connectors/connect"
  );
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      throw new HubManagementError(403, "Use the connector controls in CSA Studio.");
    const input: unknown = await request.json().catch(() => {
      throw new HubManagementError(400, "Invalid connector connection request.");
    });
    const { connectorId } = await context.params;
    const result = await connectionHubManagement.connect(connectorId, input);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    const status = error instanceof HubManagementError ? error.status : 502;
    log.error("Connector connection failed", undefined, { status, requestId });
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof HubManagementError
            ? error.message
            : "Unable to connect this service. Some actions may have changed. Refresh and retry."
      },
      { status, headers }
    );
  }
}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ connectorId: string }> }
) {
  const { log, requestId } = requestLogger(
    request,
    "api/connection-hub/connectors/remove"
  );
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      throw new HubManagementError(403, "Use the connector controls in CSA Studio.");
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new HubManagementError(400, "Invalid connector removal request.");
    }
    const { connectorId } = await context.params;
    const result = await connectionHubManagement.remove(connectorId, input);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    const status = error instanceof HubManagementError ? error.status : 502;
    log.error("Connector removal failed", undefined, { status, requestId });
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof HubManagementError
            ? error.message
            : "Unable to finish removal. Some actions may have changed. Refresh the connector status and retry."
      },
      { status, headers }
    );
  }
}
