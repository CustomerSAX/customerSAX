"use client";

import { useState, useCallback } from "react";
import type { B2BResourceType, ImportJobHistory, ExportJobHistory, ImportRowResult } from "../types/import-export-types";

export function useImportExport(initialResource: B2BResourceType = "company") {
  const [selectedResource, setSelectedResource] = useState<B2BResourceType>(initialResource);
  const [importHistory, setImportHistory] = useState<ImportJobHistory[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportJobHistory[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<ImportRowResult[] | null>(null);

  const processImport = useCallback(
    (file: File) => {
      setIsProcessing(true);
      setImportResults(null);

      const newHistoryItem: ImportJobHistory = {
        id: `imp-${Date.now()}`,
        resource: selectedResource,
        filename: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        timestamp: new Date().toISOString(),
        totalRows: 0,
        successCount: 0,
        errorCount: 0,
        status: "Failed",
      };

      setImportResults([
        { line: 0, success: false, message: "CSV import is not connected to a backend endpoint yet." },
      ]);
      setImportHistory((prev) => [newHistoryItem, ...prev]);
      setIsProcessing(false);
    },
    [selectedResource]
  );

  const triggerExport = useCallback(() => {
    setIsProcessing(true);

    const newExport: ExportJobHistory = {
      id: `exp-${Date.now()}`,
      resource: selectedResource,
      filename: `${selectedResource}s-export-${new Date().toISOString().slice(0, 10)}.csv`,
      fileSize: "0 KB",
      timestamp: new Date().toISOString(),
      recordCount: 0,
      status: "Failed",
    };

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
