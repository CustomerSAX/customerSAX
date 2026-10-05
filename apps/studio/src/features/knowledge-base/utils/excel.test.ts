import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  generateKnowledgeBaseTemplate,
  parseAndValidateKnowledgeBaseExcel
} from "./excel";

describe("Knowledge Base Excel utility", () => {
  it("generates a valid template that passes validation", () => {
    const templateBuffer = generateKnowledgeBaseTemplate();
    expect(templateBuffer).toBeDefined();
    expect(templateBuffer.length).toBeGreaterThan(0);

    const result = parseAndValidateKnowledgeBaseExcel(templateBuffer);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.items.length).toBeGreaterThan(0);

    const faqItems = result.items.filter((i) => i.type === "faq");
    const troubleshootItems = result.items.filter((i) => i.type === "troubleshoot");

    expect(faqItems.length).toBe(3);
    expect(troubleshootItems.length).toBe(3);

    expect(faqItems[0].section).toBe("Account");
    expect(faqItems[0].question).toBe("How do I reset my password?");
  });

  it("fails if file is not a valid spreadsheet", () => {
    const garbage = Buffer.from("this is just plain text, not an excel file");
    const result = parseAndValidateKnowledgeBaseExcel(garbage);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fails if FAQ sheet is missing", () => {
    const wb = XLSX.utils.book_new();
    const tsData = [
      ["Section", "Question", "Answer"],
      ["General", "Why?", "Because."]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tsData), "Troubleshoot");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parseAndValidateKnowledgeBaseExcel(buf);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required sheet: "FAQ".');
  });

  it("fails if required columns are missing in a sheet", () => {
    const wb = XLSX.utils.book_new();
    const faqData = [
      ["Section", "Question"], // missing Answer
      ["Account", "How do I login?"]
    ];
    const tsData = [
      ["Section", "Question", "Answer"],
      ["General", "Why?", "Because."]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(faqData), "FAQ");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tsData), "Troubleshoot");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parseAndValidateKnowledgeBaseExcel(buf);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("missing required column header(s): Answer"))).toBe(true);
  });

  it("flags empty values in rows with line numbers", () => {
    const wb = XLSX.utils.book_new();
    const faqData = [
      ["Section", "Question", "Answer"],
      ["Account", "", "Click settings."], // missing Question
      ["", "How do I pay?", "Use card."] // missing Section
    ];
    const tsData = [
      ["Section", "Question", "Answer"],
      ["General", "Issue", ""] // missing Answer
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(faqData), "FAQ");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tsData), "Troubleshoot");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = parseAndValidateKnowledgeBaseExcel(buf);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Sheet "FAQ", Row 2: "Question" cannot be empty'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Sheet "FAQ", Row 3: "Section" cannot be empty'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Sheet "Troubleshoot", Row 2: "Answer" cannot be empty'))).toBe(true);
  });
});
