import { NextRequest, NextResponse } from "next/server";
import { forwardRequestId, requestLogger } from "@/lib/request-logger";

/**
 * GET /api/health
 *
 * Real reachability probe for the core backend services, used by the dashboard
 * "Core Service Health" card. No fabricated statuses: each service is reported
 * as "online" ONLY when an actual unauthenticated probe against it succeeds,
 * "offline" when the probe fails or the connection is refused, and "unknown"
 * when the probe could not be run at all.
 *
 * This replaces the previous hardcoded `serviceMap`/`fallbackGateway` list that
 * always claimed "online" regardless of whether anything was running — a
 * fabricated value that violated the project's no-mock-data rule.
 *
 * Only services with a genuinely reachable unauthenticated endpoint are probed:
 *   - Experience BFF: the Apollo Gateway answers the introspection meta-field
 *                     `{ __typename }` without auth (works in both federated and
 *                     no-federation modes; `hello` only exists in the latter).
 *   - AI Assist:      exposes an unauthenticated GET /health.
 * The ticketing / commerce subgraphs are only reachable through the federated,
 * authenticated BFF path, so they are not probed here rather than faked.
 */

const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";
const AI_ASSIST_URL = process.env.AI_ASSIST_URL ?? "http://localhost:8080";

type ServiceStatus = "online" | "offline" | "unknown";
type ServiceHealth = { name: string; status: ServiceStatus };

const PROBE_TIMEOUT_MS = 2500;

async function probeBff(requestId: string): Promise<ServiceStatus> {
  try {
    const res = await fetch(BFF_URL, {
      method: "POST",
      headers: forwardRequestId(requestId, { "content-type": "application/json" }),
      body: JSON.stringify({ query: "{ __typename }" }),
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return "offline";
    const data = (await res.json().catch(() => null)) as
      | { data?: { __typename?: string } }
      | null;
    return data?.data?.__typename ? "online" : "offline";
  } catch {
    // Connection refused / DNS / timeout — the service is genuinely unreachable.
    return "offline";
  }
}

async function probeAiAssist(requestId: string): Promise<ServiceStatus> {
  try {
    const res = await fetch(`${AI_ASSIST_URL}/health`, {
      method: "GET",
      headers: forwardRequestId(requestId),
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return "offline";
    const data = (await res.json().catch(() => null)) as
      | { status?: string }
      | null;
    return data?.status === "ok" ? "online" : "offline";
  } catch {
    return "offline";
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { log, requestId } = requestLogger(request, "api/health");

  try {
    const [bff, aiAssist] = await Promise.all([
      probeBff(requestId),
      probeAiAssist(requestId),
    ]);

    const services: ServiceHealth[] = [
      { name: "Experience BFF", status: bff },
      { name: "AI Assist", status: aiAssist },
    ];

    return NextResponse.json(
      { ok: true, services },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    // The probe orchestration itself failed — report honestly rather than
    // inventing statuses. The dashboard renders this as "status unavailable".
    log.error("health probe failed", err);
    return NextResponse.json(
      { ok: false, reason: (err as Error).message, services: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
