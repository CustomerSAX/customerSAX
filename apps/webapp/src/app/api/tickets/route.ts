import { NextRequest, NextResponse } from "next/server";

const TICKETING_URL =
  process.env.TICKETING_GRAPHQL_URL ?? "http://127.0.0.1:4350/graphql";

const LIST_QUERY = `
  query ListTickets($status: String, $limit: Int, $offset: Int) {
    ticketPage(status: $status, limit: $limit, offset: $offset, sortKey: "lastModifiedAt", sortOrder: "desc") {
      total
      results {
        id
        ticketNumber
        customerName
        customerEmail
        subject
        status
        priority
        category
        assignee
        createdAt
        lastModifiedAt
      }
    }
  }
`;

async function gql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(TICKETING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    // Short timeout so the webapp doesn't hang if ticketing is down
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Ticketing ${res.status}`);
  const { data, errors } = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };
  if (errors?.length) throw new Error(errors[0].message);
  return data;
}

/**
 * GET /api/tickets
 *
 * Query params:
 *   status  — "open" | "closed" | "in_progress" | "resolved" | "" (all)
 *   limit   — max rows (default 50)
 *   offset  — pagination offset (default 0)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  // Map UI tab names to DB status values
  const statusMap: Record<string, string> = {
    assigned_to_me: "open",
    open: "open",
    closed: "closed",
    resolved: "resolved",
  };
  const dbStatus = statusMap[status] ?? "";

  try {
    const data = await gql(LIST_QUERY, {
      status: dbStatus || null,
      limit,
      offset,
    });

    const page = (data as { ticketPage: { total: number; results: unknown[] } }).ticketPage;

    return NextResponse.json({
      results: page.results,
      total: page.total,
    });
  } catch (err) {
    console.error("[api/tickets] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tickets", results: [], total: 0 },
      { status: 502 }
    );
  }
}
