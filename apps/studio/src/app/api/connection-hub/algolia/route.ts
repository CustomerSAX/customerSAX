import { NextRequest, NextResponse } from "next/server";
import { algoliaPlugin, AlgoliaPluginError } from "@/lib/algolia-plugin";
import { requestLogger } from "@/lib/request-logger";
export const dynamic = "force-dynamic";
async function handle(
  request: NextRequest,
  operation: "status" | "connect" | "disconnect"
) {
  const { log, requestId } = requestLogger(request, "api/connection-hub/algolia");
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const origin = request.headers.get("origin");
    if (operation !== "status" && (!origin || origin !== request.nextUrl.origin))
      throw new AlgoliaPluginError(403, "Use the connection form in CSA Studio.");
    const input: unknown =
      operation === "status"
        ? undefined
        : await request.json().catch(() => {
            throw new AlgoliaPluginError(400, "Enter valid connection details.");
          });
    const result =
      operation === "status"
        ? await algoliaPlugin.status()
        : await algoliaPlugin[operation](input);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    const failure = algoliaPlugin.message(error);
    log.error("Algolia plugin request failed", undefined, {
      requestId,
      status: failure.status
    });
    return NextResponse.json(
      { ok: false, error: failure.message },
      { status: failure.status, headers }
    );
  }
}
export const GET = (request: NextRequest) => handle(request, "status");
export const POST = (request: NextRequest) => handle(request, "connect");
export const DELETE = (request: NextRequest) => handle(request, "disconnect");
