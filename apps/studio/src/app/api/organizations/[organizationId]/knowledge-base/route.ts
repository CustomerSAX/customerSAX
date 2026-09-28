import { NextResponse, type NextRequest } from "next/server";
import {
  getKnowledgeBaseByOrganization,
  deleteKnowledgeBaseByOrganization
} from "@csa/mongodb";
import { authorizeOrganizationAccess } from "@/features/knowledge-base/api/auth-guard";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ organizationId: string }> | { organizationId: string };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;

  const emptyResponse = {
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
    const data = await getKnowledgeBaseByOrganization(organizationId);
    return NextResponse.json(data, {
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
    const result = await deleteKnowledgeBaseByOrganization(organizationId);
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount }, { status: 200 });
  } catch (error: any) {
    console.error(`[knowledge-base] Failed to delete KB for org ${organizationId}:`, error);
    return NextResponse.json(
      { error: "Failed to delete knowledge base." },
      { status: 500 }
    );
  }
}
