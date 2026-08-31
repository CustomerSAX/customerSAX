"use client";

import { useState, useCallback } from "react";
import type { B2BResourceType, ImportJobHistory, ExportJobHistory, ImportRowResult } from "../types/import-export-types";

export type ExportCsvRow = Record<string, string | number | boolean | null | undefined>;
export type ImportCsvRow = Record<string, string>;
export type ImportRowHandler = (row: ImportCsvRow, line: number) => Promise<void>;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function csvEscape(value: ExportCsvRow[string]) {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function rowsToCsv(rows: ExportCsvRow[], preferredHeaders: string[] = []) {
  const discoveredHeaders = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );
  const headers =
    preferredHeaders.length > 0
      ? [...preferredHeaders, ...discoveredHeaders.filter((header) => !preferredHeaders.includes(header))]
      : discoveredHeaders;

  if (headers.length === 0) return "";

  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    return {
      line: index + 2,
      row: headers.reduce<ImportCsvRow>((record, header, valueIndex) => {
        record[header] = values[valueIndex] ?? "";
        return record;
      }, {}),
    };
  });
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useImportExport(initialResource: B2BResourceType = "company") {
  const [selectedResource, setSelectedResource] = useState<B2BResourceType>(initialResource);
  const [importHistory, setImportHistory] = useState<ImportJobHistory[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportJobHistory[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<ImportRowResult[] | null>(null);

  const processImport = useCallback(
    async (file: File, importRow: ImportRowHandler) => {
      setIsProcessing(true);
      setImportResults(null);

      try {
        const timestamp = new Date().toISOString();
        const parsedRows = parseCsv(await file.text());
        const results: ImportRowResult[] = [];

        for (const { line, row } of parsedRows) {
          try {
            await importRow(row, line);
            results.push({ line, success: true, message: "Imported successfully." });
          } catch (error) {
            results.push({
              line,
              success: false,
              message: error instanceof Error ? error.message : "Import failed.",
            });
          }
        }

        const successCount = results.filter((result) => result.success).length;
        const errorCount = results.length - successCount;
        const newHistoryItem: ImportJobHistory = {
          id: `imp-${Date.now()}`,
          resource: selectedResource,
          filename: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          timestamp,
          totalRows: parsedRows.length,
          successCount,
          errorCount,
          status: parsedRows.length > 0 && errorCount === 0 ? "Completed" : "Failed",
        };

        setImportResults(
          parsedRows.length > 0
            ? results
            : [{ line: 0, success: false, message: "CSV file has no data rows." }]
        );
        setImportHistory((prev) => [newHistoryItem, ...prev]);
      } catch (error) {
        const timestamp = new Date().toISOString();
        setImportResults([
          {
            line: 0,
            success: false,
            message: error instanceof Error ? error.message : "Unable to read CSV file.",
          },
        ]);
        setImportHistory((prev) => [{
          id: `imp-${Date.now()}`,
          resource: selectedResource,
          filename: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          timestamp,
          totalRows: 0,
          successCount: 0,
          errorCount: 1,
          status: "Failed",
        }, ...prev]);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedResource]
  );

  const triggerExport = useCallback((rows: ExportCsvRow[], headers?: string[]) => {
    setIsProcessing(true);

    const csvContent = rowsToCsv(rows, headers);
    const filename = `${selectedResource}s-export-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

    const newExport: ExportJobHistory = {
      id: `exp-${Date.now()}`,
      resource: selectedResource,
      filename,
      fileSize: formatFileSize(blob.size),
      timestamp: new Date().toISOString(),
      recordCount: rows.length,
      status: "Ready",
      csvContent,
    };

    downloadCsv(filename, csvContent);
    setExportHistory((prev) => [newExport, ...prev]);
    setIsProcessing(false);
  }, [selectedResource]);

  return {
    selectedResource,
    setSelectedResource,
    importHistory,
    exportHistory,
    isProcessing,
    importResults,
    processImport,
    triggerExport,
  };
}
