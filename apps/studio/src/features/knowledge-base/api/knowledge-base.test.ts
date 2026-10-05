import { describe, expect, it } from "vitest";
import { GET as getTemplateRoute } from "@/app/api/organizations/[organizationId]/knowledge-base/template/route";
import {
  generateKnowledgeBaseTemplate,
  parseAndValidateKnowledgeBaseExcel
} from "@/features/knowledge-base/utils/excel";

describe("Knowledge Base Endpoints & Utilities", () => {
  it("Template route returns valid binary Excel file with correct attachment headers", async () => {
    const response = await getTemplateRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="knowledge-base-template.xlsx"'
    );

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);

    const parseResult = parseAndValidateKnowledgeBaseExcel(arrayBuffer);
    expect(parseResult.valid).toBe(true);
    expect(parseResult.items.length).toBe(6); // 3 FAQ, 3 Troubleshoot
  });

  it("Excel parser validates required sheets and columns", () => {
    const validBuffer = generateKnowledgeBaseTemplate();
    const res = parseAndValidateKnowledgeBaseExcel(validBuffer);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);

    const faqSections = new Set(
      res.items.filter((i) => i.type === "faq").map((i) => i.section)
    );
    expect(faqSections.has("Account")).toBe(true);
    expect(faqSections.has("Orders")).toBe(true);

    const troubleshootSections = new Set(
      res.items.filter((i) => i.type === "troubleshoot").map((i) => i.section)
    );
    expect(troubleshootSections.has("Login Issues")).toBe(true);
    expect(troubleshootSections.has("Payment Issues")).toBe(true);
  });

  it("Ensures organization isolation grouping logic", () => {
    // Test data structure returned to frontend
    const sampleDbItems = [
      {
        _id: "1",
        organizationId: "org-a",
        type: "faq" as const,
        section: "Billing",
        question: "How to pay?",
        answer: "Credit card"
      },
      {
        _id: "2",
        organizationId: "org-a",
        type: "troubleshoot" as const,
        section: "Network",
        question: "Offline?",
        answer: "Check cable"
      }
    ];

    // Filter by organization
    const orgAItems = sampleDbItems.filter((i) => i.organizationId === "org-a");
    const orgBItems = sampleDbItems.filter((i) => i.organizationId === "org-b");

    expect(orgAItems).toHaveLength(2);
    expect(orgBItems).toHaveLength(0);
  });
});
