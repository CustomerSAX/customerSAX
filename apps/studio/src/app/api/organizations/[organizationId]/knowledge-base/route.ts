import { NextResponse, type NextRequest } from "next/server";
import { authorizeOrganizationAccess } from "@/features/knowledge-base/api/auth-guard";
import { executeBffGraphql } from "@/features/knowledge-base/api/bff-client";
import type { KnowledgeBaseData } from "@/features/knowledge-base/types/knowledge-base-types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

const GET_KNOWLEDGE_BASE_QUERY = `
  query GetKnowledgeBase($clientId: ID!) {
    adminKnowledgeBase(clientId: $clientId) {
      faq {
        section
        items {
          id
          question
          answer
        }
      }
      troubleshoot {
        section
        items {
          id
          question
          answer
        }
      }
      status {
        lastUpdatedAt
        faqCount
        troubleshootCount
      }
    }
  }
`;

const DELETE_KNOWLEDGE_BASE_MUTATION = `
  mutation DeleteKnowledgeBase($clientId: ID!) {
    adminDeleteKnowledgeBase(clientId: $clientId)
  }
`;

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;

  const emptyResponse: KnowledgeBaseData = {
    faq: [],
    troubleshoot: [],
    status: { lastUpdatedAt: null, faqCount: 0, troubleshootCount: 0 }
  };

  if (!organizationId) {
    return NextResponse.json(emptyResponse, { status: 200 });
  }

  const auth = await authorizeOrganizationAccess(organizationId, false);
  if (!auth.authorized && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const result = await executeBffGraphql<{ adminKnowledgeBase: KnowledgeBaseData }>(
      GET_KNOWLEDGE_BASE_QUERY,
      { clientId: organizationId },
      auth.user,
      organizationId
    );
    return NextResponse.json(result.adminKnowledgeBase || emptyResponse, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error: any) {
    console.error(`[knowledge-base] Failed to fetch KB for org ${organizationId}:`, error);
    return NextResponse.json(emptyResponse, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization identifier is required." },
      { status: 400 }
    );
  }

  const auth = await authorizeOrganizationAccess(organizationId, true);
  if (!auth.authorized && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    await executeBffGraphql<{ adminDeleteKnowledgeBase: boolean }>(
      DELETE_KNOWLEDGE_BASE_MUTATION,
      { clientId: organizationId },
      auth.user,
      organizationId
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error(`[knowledge-base] Failed to delete KB for org ${organizationId}:`, error);
    return NextResponse.json(
      { error: "Failed to delete knowledge base." },
      { status: 500 }
    );
  }
}
