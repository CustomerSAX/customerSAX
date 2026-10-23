import { NextRequest, NextResponse } from "next/server";
import { connectionHub, ConnectionHubError } from "../../../../lib/connection-hub";
import { requestLogger } from "../../../../lib/request-logger";

export async function POST(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/connection-hub/products");
  try {
    const config = await connectionHub.authorize();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ConnectionHubError(400);
    }
    const input = connectionHub.parseInput(body);
    const products = await connectionHub.search({ ...input, config, requestId });
    return NextResponse.json(
      { ok: true, ...products },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof ConnectionHubError ? error.status : 502;
    log.error("Product search request failed", undefined, {
      status,
      requestId,
      code: error instanceof ConnectionHubError ? error.code : "HUB_REQUEST_FAILED"
    });
    const message =
      status === 400
        ? "Enter a valid product search."
        : status === 401
          ? "Sign in to search products."
          : status === 403 || status === 404 || status === 409
            ? "Product search is not available for the selected project."
            : "Product search is temporarily unavailable. Please try again.";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
