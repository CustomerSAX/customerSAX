import { NextRequest, NextResponse } from "next/server";
import { zendeskConnector } from "@/lib/zendesk-connector";
import { ZendeskPluginError } from "@/lib/zendesk-plugin";
import { requestLogger } from "@/lib/request-logger";

export const dynamic = "force-dynamic";
async function handle(
  request: NextRequest,
  operation: "status" | "connect" | "disconnect"
) {
  const { log, requestId } = requestLogger(
    request,
    "api/connection-hub/zendesk/connector"
  );
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const origin = request.headers.get("origin");
    if (operation !== "status" && origin && origin !== request.nextUrl.origin)
      throw new ZendeskPluginError(403, "Use the connection form in CSA Studio.");
    let input: unknown;
    if (operation !== "status") {
      try {
        input = await request.json();
      } catch {
        throw new ZendeskPluginError(400, "Enter valid connection details.");
      }
    }
    const result =
      operation === "status"
        ? await zendeskConnector.status()
        : await zendeskConnector[operation](input);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    const status = error instanceof ZendeskPluginError ? error.status : 502;
    log.error("Zendesk connector request failed", undefined, { status, requestId });
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof ZendeskPluginError
            ? error.message
            : "Unable to update Zendesk. Some project actions may have changed. Refresh its status and retry."
      },
      { status, headers }
    );
  }
}
export const GET = (request: NextRequest) => handle(request, "status");
export const POST = (request: NextRequest) => handle(request, "connect");
export const DELETE = (request: NextRequest) => handle(request, "disconnect");
