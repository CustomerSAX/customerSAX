import { NextResponse, type NextRequest } from "next/server";
import { authorizeOrganizationAccess } from "@/features/knowledge-base/api/auth-guard";
import { executeBffGraphql } from "@/features/knowledge-base/api/bff-client";
import { parseAndValidateKnowledgeBaseExcel } from "@/features/knowledge-base/utils/excel";
import type { KnowledgeBaseStatus } from "@/features/knowledge-base/types/knowledge-base-types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

const REPLACE_KNOWLEDGE_BASE_MUTATION = `
  mutation ReplaceKnowledgeBase($clientId: ID!, $items: [KnowledgeBaseItemInput!]!) {
    adminReplaceKnowledgeBase(clientId: $clientId, items: $items) {
      ok
      count
      status {
        lastUpdatedAt
        faqCount
        troubleshootCount
      }
    }
  }
`;

export async function POST(request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;

  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "Organization identifier is required." },
      { status: 400 }
    );
  }

  const auth = await authorizeOrganizationAccess(organizationId, true);
  if (!auth.authorized && auth.errorResponse) {
    return auth.errorResponse;
  }

  let fileBuffer: ArrayBuffer | null = null;
  let filename = "";

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = (formData.get("file") || formData.get("upload")) as File | null;

      if (!file) {
        return NextResponse.json(
          { ok: false, error: "No file was uploaded. Please attach an Excel (.xlsx) or CSV (.csv) file." },
          { status: 400 }
        );
      }

      filename = file.name || "";
      fileBuffer = await file.arrayBuffer();
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: "Failed to read uploaded form data." },
        { status: 400 }
      );
    }
  } else {
    // Direct binary body
    try {
      fileBuffer = await request.arrayBuffer();
      filename = request.headers.get("x-filename") || "upload.xlsx";
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: "Failed to read uploaded file payload." },
        { status: 400 }
      );
    }
  }

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    return NextResponse.json(
      { ok: false, error: "The uploaded file is empty. Please upload a valid .xlsx or .csv file." },
      { status: 400 }
    );
  }

  // Validate file extension
  const lowerFilename = (filename || "").toLowerCase();
  const isExcel = lowerFilename.endsWith(".xlsx") || lowerFilename.endsWith(".xls");
  const isCsv = lowerFilename.endsWith(".csv");

  if (filename && !isExcel && !isCsv) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid file type. Please upload a valid Excel spreadsheet (.xlsx) or CSV file (.csv)."
      },
      { status: 400 }
    );
  }

  // Parse and validate the Excel or CSV workbook contents
  const parseResult = parseAndValidateKnowledgeBaseExcel(fileBuffer, filename);

  if (!parseResult.valid) {
    // If validation fails, do NOT touch existing records! Return actionable error messages.
    return NextResponse.json(
      {
        ok: false,
        error: "Spreadsheet validation failed.",
        errors: parseResult.errors
      },
      { status: 400 }
    );
  }

  try {
    // Atomically replace existing Knowledge Base for this organization via admin service
    const result = await executeBffGraphql<{
      adminReplaceKnowledgeBase: {
        ok: boolean;
        count: number;
        status: KnowledgeBaseStatus;
      };
    }>(
      REPLACE_KNOWLEDGE_BASE_MUTATION,
      { clientId: organizationId, items: parseResult.items },
      auth.user,
      organizationId
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Knowledge Base uploaded successfully.",
        count: result.adminReplaceKnowledgeBase.count,
        status: result.adminReplaceKnowledgeBase.status
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[knowledge-base] Failed to store KB for org ${organizationId}:`, err);
    return NextResponse.json(
      {
        ok: false,
        error: "An error occurred while saving the knowledge base to the database.",
        detail: err?.message || String(err)
      },
      { status: 500 }
    );
  }
}
