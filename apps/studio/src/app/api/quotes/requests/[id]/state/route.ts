import { NextRequest, NextResponse } from "next/server";
import { bffJsonHeaders } from "@/lib/commerce-headers";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { requestLogger } from "@/lib/request-logger";

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const UPDATE_QUOTE_REQUEST_STATE_MUTATION = `
  mutation UpdateQuoteRequestState($id: ID!, $state: String!) {
    updateQuoteRequestState(id: $id, state: $state) {
      id
      version
      quoteRequestState
    }
  }
`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { log, requestId } = requestLogger(request, "api/quotes/requests/[id]/state");
  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as { state?: string };
    const state = body.state?.trim();

    if (!["Accepted", "Rejected", "Cancelled"].includes(state || "")) {
      return NextResponse.json({ error: "Unsupported quote request state." }, { status: 400 });
    }

    const response = await projectScopedBffFetch(
      BFF_URL,
      {
        method: "POST",
        headers: bffJsonHeaders(),
        body: JSON.stringify({
          query: UPDATE_QUOTE_REQUEST_STATE_MUTATION,
          variables: { id, state }
        })
      },
      requestId
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.errors?.length) {
      const message = payload?.errors?.length
        ? payload.errors.map((error: { message?: string }) => error.message).filter(Boolean).join("; ")
        : payload?.error || `BFF HTTP ${response.status}`;

      return NextResponse.json({ error: message || "Unable to update quote request." }, { status: 502 });
    }

    return NextResponse.json(payload.data.updateQuoteRequestState);
  } catch (error) {
    log.error("quote request state update failed", error, { quoteRequestId: id });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update quote request." },
      { status: 502 }
    );
  }
}
