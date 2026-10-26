import { NextRequest, NextResponse } from "next/server";
import { connectionHubTeams, TeamsHubError } from "../../../../lib/connection-hub-teams";
import { requestLogger } from "../../../../lib/request-logger";

export async function POST(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/connection-hub/teams");
  try {
    const config = await connectionHubTeams.authorize();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new TeamsHubError(400);
    }
    const input = connectionHubTeams.parseInput(body);
    const result = await connectionHubTeams.execute({ input, config, requestId });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof TeamsHubError ? error.status : 502;
    log.error("Microsoft Teams request failed", undefined, { status, requestId });
    const message =
      status === 400
        ? "Enter a valid Teams request."
        : status === 401
          ? "Sign in to access Microsoft Teams."
          : [403, 404, 409].includes(status)
            ? "Microsoft Teams is not available for the selected project."
            : "Microsoft Teams is temporarily unavailable. Please try again.";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
