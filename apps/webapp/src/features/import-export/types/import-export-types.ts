/**
 * Import / Export Module Types
 *
 * Strongly-typed domain interfaces for B2B CSV/JSON Data Import & Export.
 */

export type B2BResourceType = "company" | "employee" | "cart" | "quote";

export interface ImportRowResult {
  line: number;
  success: boolean;
  message: string;
}

export interface ImportJobHistory {
  id: string;
  resource: B2BResourceType;
  filename: string;
  fileSize: string;
  timestamp: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  status: "Completed" | "Failed" | "Processing";
}

export interface ExportJobHistory {
  id: string;
  resource: B2BResourceType;
  filename: string;
  fileSize: string;
  timestamp: string;
  recordCount: number;
  status: "Ready" | "Generating";
}
