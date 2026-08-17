"use client";

import { useState, useCallback } from "react";
import type { B2BResourceType, ImportJobHistory, ExportJobHistory, ImportRowResult } from "../types/import-export-types";

const INITIAL_IMPORT_HISTORY: ImportJobHistory[] = [
  {
    id: "imp-101",
    resource: "company",
    filename: "companies-batch-2026.csv",
    fileSize: "14.2 KB",
    timestamp: "2026-08-01T10:15:00Z",
    totalRows: 12,
    successCount: 12,
    errorCount: 0,
    status: "Completed",
  },
  {
    id: "imp-102",
    resource: "employee",
    filename: "employees-northwind.csv",
    fileSize: "28.5 KB",
    timestamp: "2026-07-28T14:30:00Z",
    totalRows: 45,
    successCount: 43,
    errorCount: 2,
    status: "Completed",
  },
];

const INITIAL_EXPORT_HISTORY: ExportJobHistory[] = [
  {
    id: "exp-101",
    resource: "company",
    filename: "companies-export-20260805.csv",
    fileSize: "18.4 KB",
    timestamp: "2026-08-05T09:00:00Z",
    recordCount: 15,
    status: "Ready",
  },
  {
    id: "exp-102",
    resource: "quote",
    filename: "quotes-q3-export.csv",
    fileSize: "34.1 KB",
    timestamp: "2026-08-04T16:20:00Z",
    recordCount: 28,
    status: "Ready",
  },
];

export function useImportExport(initialResource: B2BResourceType = "company") {
  const [selectedResource, setSelectedResource] = useState<B2BResourceType>(initialResource);
  const [importHistory, setImportHistory] = useState<ImportJobHistory[]>(INITIAL_IMPORT_HISTORY);
  const [exportHistory, setExportHistory] = useState<ExportJobHistory[]>(INITIAL_EXPORT_HISTORY);

  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<ImportRowResult[] | null>(null);

  const processImport = useCallback(
    (file: File) => {
      setIsProcessing(true);
      setImportResults(null);

      setTimeout(() => {
        const mockResults: ImportRowResult[] = [
          { line: 1, success: true, message: "Valid record imported successfully" },
          { line: 2, success: true, message: "Valid record imported successfully" },
          { line: 3, success: false, message: "Missing required key field" },
          { line: 4, success: true, message: "Valid record imported successfully" },
        ];

        const newHistoryItem: ImportJobHistory = {
          id: `imp-${Date.now()}`,
          resource: selectedResource,
          filename: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          timestamp: new Date().toISOString(),
          totalRows: 4,
          successCount: 3,
          errorCount: 1,
          status: "Completed",
        };

        setImportResults(mockResults);
        setImportHistory((prev) => [newHistoryItem, ...prev]);
        setIsProcessing(false);
      }, 1200);
    },
    [selectedResource]
  );

  const triggerExport = useCallback(() => {
    setIsProcessing(true);

    setTimeout(() => {
      const newExport: ExportJobHistory = {
        id: `exp-${Date.now()}`,
        resource: selectedResource,
        filename: `${selectedResource}s-export-${new Date().toISOString().slice(0, 10)}.csv`,
        fileSize: "22.5 KB",
        timestamp: new Date().toISOString(),
        recordCount: 25,
        status: "Ready",
      };

      setExportHistory((prev) => [newExport, ...prev]);
      setIsProcessing(false);
    }, 1000);
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
