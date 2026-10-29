import {
  generateKnowledgeBaseCsvTemplate,
  generateKnowledgeBaseTemplate
} from "@/features/knowledge-base/utils/excel";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const url = request ? new URL(request.url) : null;
  const format = url ? url.searchParams.get("format") : null;

  if (format === "csv") {
    const templateBuffer = generateKnowledgeBaseCsvTemplate();
    return new Response(templateBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="knowledge-base-template.csv"',
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }

  const templateBuffer = generateKnowledgeBaseTemplate();

  return new Response(templateBuffer as any, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="knowledge-base-template.xlsx"',
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
}
