"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Icon,
  Input,
  Label,
  Select,
  Toast,
} from "@csa/ui";
import { REPORT_TYPES, getMockReportRows, useReportPermissions } from "../hooks/use-reports";
import { useReportToasts } from "../hooks/use-report-toasts";
import { exportRowsToExcel, formatDdMmYyyy } from "../utils/export-report";
import type { ReportTypeKey } from "../types/report-types";

const EXPORT_SIMULATION_DELAY_MS = 400;

export function ReportExportPanel() {
  const permissions = useReportPermissions();
  const { toasts, pushToast, dismissToast } = useReportToasts();

  const reportTypeOptions = useMemo(
    () => REPORT_TYPES.filter((reportType) => permissions[reportType.permission]),
    [permissions],
  );

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportTypeKey | "">(
    reportTypeOptions[0]?.value ?? "",
  );
  const [isExporting, setIsExporting] = useState(false);

  const selectedReportValue = useMemo(() => {
    if (reportTypeOptions.some((reportType) => reportType.value === selectedReport)) {
      return selectedReport;
    }
    return reportTypeOptions[0]?.value ?? "";
  }, [reportTypeOptions, selectedReport]);

  const handleExport = () => {
    if (reportTypeOptions.length === 0) {
      pushToast("error", "Your role does not include access to generate these reports.");
      return;
    }
    if (!selectedReportValue) {
      pushToast("error", "Please select a report type.");
      return;
    }

    setIsExporting(true);
    window.setTimeout(() => {
      const fileName = `Report - ${selectedReportValue} (${formatDdMmYyyy(fromDate)} to ${formatDdMmYyyy(toDate)})`;
      try {
        exportRowsToExcel(getMockReportRows(selectedReportValue), fileName);
        pushToast("success", `${fileName} exported successfully!`);
      } catch {
        pushToast("error", "No data to export");
      } finally {
        setIsExporting(false);
      }
    }, EXPORT_SIMULATION_DELAY_MS);
  };

  return (
    <>
      <Card variant="default" className="overflow-visible">
        <CardHeader>
          <CardTitle>Generate & Export Report</CardTitle>
          <CardDescription>
            Select date range parameters and export formatted Excel data for your assigned role permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-end">
            <FormField label="From Date">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </FormField>
            <FormField label="To Date">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </FormField>
            <div className="flex w-full flex-col gap-1.5">
              <Label>Report Type</Label>
              {reportTypeOptions.length === 0 ? (
                <p className="flex h-[38px] items-center text-xs text-m-text-muted">
                  No report types match your assigned permissions.
                </p>
              ) : (
                <Select
                  value={selectedReportValue}
                  onChange={(event) => setSelectedReport(event.target.value as ReportTypeKey)}
                  options={reportTypeOptions.map((reportType) => ({
                    value: reportType.value,
                    label: reportType.label,
                  }))}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-m-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-m-text-muted">
              <strong className="text-m-text">Note:</strong> Report exports generate .xlsx workbooks adhering to
              assigned RBAC permissions.
            </p>
            <Button
              variant="primary"
              loading={isExporting}
              disabled={reportTypeOptions.length === 0}
              leftIcon={<Icon name="download" size="xs" />}
              onClick={handleExport}
            >
              Generate & Export (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              variant={toast.variant}
              title={toast.title}
              onClose={() => dismissToast(toast.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
