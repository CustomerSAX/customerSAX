import { NextResponse, type NextRequest } from "next/server";
import { replaceKnowledgeBase } from "@csa/mongodb";
import { authorizeOrganizationAccess } from "@/features/knowledge-base/api/auth-guard";
import { parseAndValidateKnowledgeBaseExcel } from "@/features/knowledge-base/utils/excel";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

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
          { ok: false, error: "No file was uploaded. Please attach an Excel (.xlsx) file." },
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
      { ok: false, error: "The uploaded file is empty. Please upload a valid .xlsx file." },
      { status: 400 }
    );
  }

  // Validate file extension
  if (filename && !filename.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid file type. Please upload a valid Excel spreadsheet (.xlsx)."
      },
      { status: 400 }
    );
  }

  // Parse and validate the Excel workbook contents
  const parseResult = parseAndValidateKnowledgeBaseExcel(fileBuffer);

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
    // Atomically replace existing Knowledge Base for this organization
    const { count, status } = await replaceKnowledgeBase(
      organizationId,
      parseResult.items
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Knowledge Base uploaded successfully.",
        count,
        status
      },
      { status: 200 }
    );
  } catch (dbError: any) {
    console.error(`[knowledge-base] Failed to store KB for org ${organizationId}:`, dbError);
    return NextResponse.json(
      {
        ok: false,
        error: "An error occurred while saving the knowledge base to the database.",
        detail: dbError?.message || String(dbError)
      },
      { status: 500 }
    );
  }
}
