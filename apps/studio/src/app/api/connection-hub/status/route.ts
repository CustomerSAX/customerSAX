import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { connectionHubTransport } from "@/lib/connection-hub-transport";
import { requestLogger } from "@/lib/request-logger";

export const dynamic = "force-dynamic";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const { log, requestId } = requestLogger(request, "api/connection-hub/status");
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401, headers });
    if (!["admin", "superadmin"].includes(user.role))
      return NextResponse.json({ ok: false }, { status: 403, headers });
    if (!user.activeProjectKey || !user.activeClientId)
      return NextResponse.json({ ok: false }, { status: 409, headers });
    const config = connectionHubTransport.getConfig();
    if (!config || config.clientId !== user.activeClientId)
      return NextResponse.json({ ok: false }, { status: 403, headers });
    const response = await fetch(
      `${config.url}/v1/projects/${encodeURIComponent(user.activeProjectKey)}/bindings`,
      {
        headers: await connectionHubTransport.headers({
          config,
          requestId,
          googleAuth: process.env.CONNECTION_HUB_CATALOG_REQUIRE_GOOGLE_AUTH === "true"
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000)
      }
    );
    if (!response.ok) throw new Error("Hub status unavailable");
    const payload: unknown = await response.json();
    if (
      !record(payload) ||
      !["customersax", "connection-hub"].includes(String(payload.applicationId)) ||
      !Array.isArray(payload.bindings)
    )
      throw new Error("Invalid Hub bindings");
    const bindings = payload.bindings
      .filter(
        (item: unknown) =>
          record(item) &&
          item.tenantId === config.tenantId &&
          item.projectKey === user.activeProjectKey
      )
      .map((item: unknown) => {
        if (
          !record(item) ||
          typeof item.connectorId !== "string" ||
          typeof item.operation !== "string" ||
          typeof item.enabled !== "boolean"
        )
          throw new Error("Invalid Hub binding");
        return {
          connectorId: item.connectorId,
          operation: item.operation,
          enabled: item.enabled
        };
      });
    return NextResponse.json(
      {
        ok: true,
        clientId: user.activeClientId,
        projectKey: user.activeProjectKey,
        bindings
      },
      { headers }
    );
  } catch {
    log.error("Connection Hub status request failed", undefined, { requestId });
    return NextResponse.json(
      { ok: false, error: "Unable to check project connector status." },
      { status: 502, headers }
    );
  }
}
