import * as XLSX from "xlsx";
import type { KnowledgeBaseItemInput, KnowledgeBaseType } from "@csa/mongodb";

export interface ParseResult {
  valid: boolean;
  errors: string[];
  items: KnowledgeBaseItemInput[];
}

/**
 * Generates an Excel template (.xlsx) with pre-populated FAQ and Troubleshoot sheets.
 */
export function generateKnowledgeBaseTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const faqData = [
    ["Section", "Question", "Answer"],
    ["Account", "How do I reset my password?", "Go to Settings and click 'Change Password' to receive a reset link."],
    ["Account", "How do I update my email?", "Open your profile settings, enter your new email address, and verify it."],
    ["Orders", "How can I track my order?", "Go to Orders, locate your order number, and click 'Track Delivery'."]
  ];
  const faqWs = XLSX.utils.aoa_to_sheet(faqData);
  faqWs["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, faqWs, "FAQ");

  const troubleshootData = [
    ["Section", "Question", "Answer"],
    ["Login Issues", "I cannot log in", "Verify your credentials. If you forgot your password, use the reset option."],
    ["Payment Issues", "My payment failed", "Verify your payment method, ensure sufficient funds, and check billing address."],
    ["Orders", "My order is delayed", "Check carrier tracking details or contact customer support for real-time status."]
  ];
  const troubleshootWs = XLSX.utils.aoa_to_sheet(troubleshootData);
  troubleshootWs["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, troubleshootWs, "Troubleshoot");

  const output = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(output);
}

/**
 * Generates a CSV template (.csv) with pre-populated FAQ and Troubleshoot items.
 */
export function generateKnowledgeBaseCsvTemplate(): Uint8Array {
  const csvContent =
`Type,Section,Question,Answer
FAQ,Account,How do I reset my password?,"Go to Settings and click 'Change Password' to receive a reset link."
FAQ,Account,How do I update my email?,"Open your profile settings, enter your new email address, and verify it."
FAQ,Orders,How can I track my order?,"Go to Orders, locate your order number, and click 'Track Delivery'."
Troubleshoot,Login Issues,I cannot log in,"Verify your credentials. If you forgot your password, use the reset option."
Troubleshoot,Payment Issues,My payment failed,"Verify your payment method, ensure sufficient funds, and check billing address."
Troubleshoot,Orders,My order is delayed,"Check carrier tracking details or contact customer support for real-time status."
`;
  return new TextEncoder().encode(csvContent);
}

/**
 * Parses and validates a Knowledge Base file (.xlsx or .csv).
 *
 * Validation checks:
 * 1. Valid Excel workbook or CSV file.
 * 2. Multi-sheet Excel workbook: Required sheets exist: "FAQ" and "Troubleshoot" (case-insensitive).
 *    Required columns in each sheet: "Section", "Question", "Answer".
 * 3. Single-table / CSV: Required columns: "Section", "Question", "Answer".
 *    Optional "Type" column (defaults to "FAQ" if omitted).
 * 4. Each non-empty row must have non-empty values for Section, Question, and Answer.
 * 5. At least one valid question/answer row across the sheets.
 */
export function parseAndValidateKnowledgeBaseExcel(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  filename?: string
): ParseResult {
  const errors: string[] = [];
  const items: KnowledgeBaseItemInput[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    return {
      valid: false,
      errors: ["Invalid or corrupted spreadsheet or CSV file. Please upload a valid .xlsx or .csv file."],
      items: []
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      valid: false,
      errors: ["The uploaded file contains no sheets or data."],
      items: []
    };
  }

  const sheetNames = workbook.SheetNames;
  const findSheet = (target: string): string | undefined => {
    const lower = target.toLowerCase();
    return sheetNames.find((s) => s.trim().toLowerCase() === lower);
  };

  const isCsv = filename?.toLowerCase().endsWith(".csv");
  const faqSheetName = findSheet("faq");
  const troubleshootSheetName =
    findSheet("troubleshoot") || findSheet("troubleshooting");

  // Multi-sheet workbook mode applies when explicit FAQ or Troubleshoot sheets exist and it's not a CSV
  const isMultiSheetWorkbook =
    Boolean(faqSheetName || troubleshootSheetName) && !isCsv;

  if (isMultiSheetWorkbook) {
    if (!faqSheetName) {
      errors.push('Missing required sheet: "FAQ".');
    }

    if (!troubleshootSheetName) {
      errors.push('Missing required sheet: "Troubleshoot".');
    }

    // If missing sheets, stop here with clear sheet errors
    if (errors.length > 0) {
      return { valid: false, errors, items: [] };
    }

    // Helper to validate a sheet
    const validateSheet = (
      sheetName: string,
      type: KnowledgeBaseType,
      displayName: string
    ) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        errors.push(`Sheet "${displayName}" is empty or cannot be read.`);
        return;
      }

      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: ""
      });

      if (!rows || rows.length === 0) {
        errors.push(`Sheet "${displayName}" is empty.`);
        return;
      }

      const headerRow = rows[0] || [];
      const normalizedHeaders = headerRow.map((h: any) =>
        String(h || "").trim().toLowerCase()
      );

      const sectionIdx = normalizedHeaders.indexOf("section");
      const questionIdx = normalizedHeaders.indexOf("question");
      const answerIdx = normalizedHeaders.indexOf("answer");

      const missingCols: string[] = [];
      if (sectionIdx === -1) missingCols.push("Section");
      if (questionIdx === -1) missingCols.push("Question");
      if (answerIdx === -1) missingCols.push("Answer");

      if (missingCols.length > 0) {
        errors.push(
          `Sheet "${displayName}" is missing required column header(s): ${missingCols.join(", ")}.`
        );
        return;
      }

      let validRowsInSheet = 0;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row)) continue;

        const rawSection = String(row[sectionIdx] ?? "").trim();
        const rawQuestion = String(row[questionIdx] ?? "").trim();
        const rawAnswer = String(row[answerIdx] ?? "").trim();

        // Check if entire row is empty
        const isCompletelyEmpty =
          row.every((cell) => String(cell ?? "").trim() === "");
        if (isCompletelyEmpty) continue;

        const rowNum = r + 1; // 1-based index in Excel
        const rowErrors: string[] = [];

        if (!rawSection) {
          rowErrors.push('"Section" cannot be empty');
        }
        if (!rawQuestion) {
          rowErrors.push('"Question" cannot be empty');
        }
        if (!rawAnswer) {
          rowErrors.push('"Answer" cannot be empty');
        }

        if (rowErrors.length > 0) {
          errors.push(
            `Sheet "${displayName}", Row ${rowNum}: ${rowErrors.join(", ")}.`
          );
        } else {
          validRowsInSheet++;
          items.push({
            type,
            section: rawSection,
            question: rawQuestion,
            answer: rawAnswer
          });
        }
      }

      if (validRowsInSheet === 0 && rows.length > 1) {
        errors.push(`Sheet "${displayName}" does not contain any valid entries.`);
      }
    };

    if (faqSheetName) {
      validateSheet(faqSheetName, "faq", "FAQ");
    }

    if (troubleshootSheetName) {
      validateSheet(troubleshootSheetName, "troubleshoot", "Troubleshoot");
    }

    if (errors.length === 0 && items.length === 0) {
      errors.push(
        "Knowledge Base spreadsheet is empty. Please provide at least one entry in FAQ and Troubleshoot sheets."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      items: errors.length === 0 ? items : []
    };
  }

  // Single table / CSV mode
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    return {
      valid: false,
      errors: ["File is empty or cannot be read."],
      items: []
    };
  }

  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1,
    defval: ""
  });

  if (!rows || rows.length === 0) {
    return {
      valid: false,
      errors: ["The uploaded file is empty."],
      items: []
    };
  }

  const headerRow = rows[0] || [];
  const normalizedHeaders = headerRow.map((h: any) =>
    String(h || "").trim().toLowerCase()
  );

  const sectionIdx = normalizedHeaders.indexOf("section");
  const questionIdx = normalizedHeaders.indexOf("question");
  const answerIdx = normalizedHeaders.indexOf("answer");
  const typeIdx = normalizedHeaders.findIndex((h) =>
    ["type", "tab", "category"].includes(h)
  );

  const missingCols: string[] = [];
  if (sectionIdx === -1) missingCols.push("Section");
  if (questionIdx === -1) missingCols.push("Question");
  if (answerIdx === -1) missingCols.push("Answer");

  if (missingCols.length > 0) {
    if (!isCsv) {
      return {
        valid: false,
        errors: [
          'Missing required sheet: "FAQ".'
        ],
        items: []
      };
    }
    return {
      valid: false,
      errors: [
        `Missing required column header(s): ${missingCols.join(", ")}.`
      ],
      items: []
    };
  }

  let validRows = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    const isCompletelyEmpty = row.every(
      (cell) => String(cell ?? "").trim() === ""
    );
    if (isCompletelyEmpty) continue;

    const rowNum = r + 1;
    const rowErrors: string[] = [];

    const rawSection = String(row[sectionIdx] ?? "").trim();
    const rawQuestion = String(row[questionIdx] ?? "").trim();
    const rawAnswer = String(row[answerIdx] ?? "").trim();
    const rawType =
      typeIdx !== -1 ? String(row[typeIdx] ?? "").trim().toLowerCase() : "";

    let itemType: KnowledgeBaseType = "faq";
    if (
      rawType === "troubleshoot" ||
      rawType === "troubleshooting" ||
      rawType === "trouble shoot" ||
      rawType === "guide"
    ) {
      itemType = "troubleshoot";
    } else if (
      rawType === "faq" ||
      rawType === "qa" ||
      rawType === "q&a" ||
      rawType === ""
    ) {
      itemType = "faq";
    } else {
      rowErrors.push('"Type" must be either "FAQ" or "Troubleshoot"');
    }

    if (!rawSection) {
      rowErrors.push('"Section" cannot be empty');
    }
    if (!rawQuestion) {
      rowErrors.push('"Question" cannot be empty');
    }
    if (!rawAnswer) {
      rowErrors.push('"Answer" cannot be empty');
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNum}: ${rowErrors.join(", ")}.`);
    } else {
      validRows++;
      items.push({
        type: itemType,
        section: rawSection,
        question: rawQuestion,
        answer: rawAnswer
      });
    }
  }

  if (validRows === 0 && rows.length > 1 && errors.length === 0) {
    errors.push("File does not contain any valid entries.");
  }

  if (errors.length === 0 && items.length === 0) {
    errors.push(
      "Knowledge Base file is empty. Please provide at least one entry."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    items: errors.length === 0 ? items : []
  };
}
