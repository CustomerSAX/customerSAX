import { generateKnowledgeBaseTemplate } from "@/features/knowledge-base/utils/excel";

export const dynamic = "force-dynamic";

export async function GET() {
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
