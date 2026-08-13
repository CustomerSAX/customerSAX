import { NextRequest, NextResponse } from "next/server";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";

// Route all ticketing queries through the BFF (Apollo Federation gateway) —
// the ticketing service is a federated subgraph and must not be called directly.
// Direct calls to port 4350 bypass federation, auth headers, and unified logging.
const BFF_URL =
  process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const LIST_QUERY = `
  query ListTickets($status: String, $limit: Int, $offset: Int, $assignee: String, $customerEmail: String) {
    ticketPage(status: $status, limit: $limit, offset: $offset, sortKey: "lastModifiedAt", sortOrder: "desc", assignee: $assignee, customerEmail: $customerEmail) {
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
  const res = await projectScopedBffFetch(BFF_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // BFF uses this header to route commerce queries; ticketing subgraph ignores it.
      // Including it keeps all BFF callers consistent and future-proofs header requirements.
      "x-csa-commerce-platform": process.env.BFF_COMMERCE_PLATFORM ?? "commercetools",
    },
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
 *   status   — "open" | "closed" | "in_progress" | "resolved" | "" (all)
 *              "assigned_to_me" maps to status=open filtered by assignee
 *   assignee — email of the agent to filter by (used when status=assigned_to_me)
 *   limit    — max rows (default 50)
 *   offset   — pagination offset (default 0)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "";
  const assigneeParam = searchParams.get("assignee") ?? null;
  const customerEmailParam = searchParams.get("customerEmail") ?? null;
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  // Map UI tab names to DB status values.
  // "assigned_to_me" uses the same status bucket as "open" but additionally
  // filters by the logged-in agent's email via the assignee arg.
  const statusMap: Record<string, string> = {
    assigned_to_me: "open",
    open: "open",
    closed: "closed",
    resolved: "resolved",
  };
  const dbStatus = statusMap[status] ?? "";

  // Only apply the assignee filter for the "assigned_to_me" tab and only
  // when the caller actually supplied an email — never silently fall through
  // to returning all-open tickets when the param is missing.
  const assignee = status === "assigned_to_me" ? (assigneeParam || null) : null;

  // customerEmail: used by customer-detail page to show all tickets for a specific customer,
  // regardless of status or assignee.
  const customerEmail = customerEmailParam || null;

  try {
    const data = await gql(LIST_QUERY, {
      status: dbStatus || null,
      limit,
      offset,
      assignee,
      customerEmail,
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
