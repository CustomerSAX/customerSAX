import { NextRequest, NextResponse } from "next/server";
import { bffJsonHeaders } from "@/lib/commerce-headers";
import { projectScopedBffFetch } from "@/lib/project-scoped-bff";
import { requestLogger } from "@/lib/request-logger";

const BFF_URL = process.env.AI_COMMERCE_SERVICE_URL ?? "http://localhost:4000/graphql";

const CREATE_QUOTE_REQUEST_MUTATION = `
  mutation CreateQuoteRequest($cartId: ID!, $comment: String) {
    createQuoteRequest(cartId: $cartId, comment: $comment) {
      id
      version
      quoteRequestState
    }
  }
`;

export async function POST(request: NextRequest) {
  const { log, requestId } = requestLogger(request, "api/quotes/requests");

  try {
    const body = (await request.json().catch(() => ({}))) as { cartId?: string; comment?: string };
    const cartId = body.cartId?.trim();
    const comment = body.comment?.trim();

    if (!cartId) {
      return NextResponse.json({ error: "cartId is required." }, { status: 400 });
    }

    const response = await projectScopedBffFetch(
      BFF_URL,
      {
        method: "POST",
        headers: bffJsonHeaders(),
        body: JSON.stringify({
          query: CREATE_QUOTE_REQUEST_MUTATION,
          variables: {
            cartId,
            comment: comment || null
          }
        })
      },
      requestId
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.errors?.length) {
      const message = payload?.errors?.length
        ? payload.errors.map((error: { message: string }) => error.message).join("; ")
        : payload?.error || `BFF HTTP ${response.status}`;

      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(payload.data.createQuoteRequest);
  } catch (error) {
    log.error("quote request creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create quote request." },
      { status: 502 }
    );
  }
}
