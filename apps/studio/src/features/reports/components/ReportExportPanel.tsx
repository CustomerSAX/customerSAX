"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
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
import { TICKETS_QUERY } from "@/features/tickets/api/queries";
import { REPORT_TYPES, useReportPermissions } from "../hooks/use-reports";
import { useReportToasts } from "../hooks/use-report-toasts";
import { exportRowsToExcel, formatDdMmYyyy } from "../utils/export-report";
import type { ReportExportRow, ReportTypeKey } from "../types/report-types";

const EXPORT_SIMULATION_DELAY_MS = 400;

type TicketReportRow = {
  assignee?: string | null;
  category?: string | null;
  contactType?: string | null;
  createdAt?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  id: string;
  lastModifiedAt?: string | null;
  orderNumber?: string | null;
  priority?: string | null;
  resolutionDate?: string | null;
  source?: string | null;
  status?: string | null;
  subject?: string | null;
  ticketNumber?: string | null;
  timeSpentOnTicket?: string | null;
};

type TicketsReportData = {
  ticketPage?: {
    results?: TicketReportRow[];
    total?: number;
  };
};

function parseDateBoundary(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinDateRange(value: string | null | undefined, fromDate: string, toDate: string) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  const from = parseDateBoundary(fromDate);
  const to = parseDateBoundary(toDate, true);

  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function mapTicketsToRows(tickets: TicketReportRow[], fromDate: string, toDate: string): ReportExportRow[] {
  return tickets
    .filter((ticket) => isWithinDateRange(ticket.createdAt, fromDate, toDate))
    .map((ticket) => ({
      "Ticket ID": ticket.ticketNumber || ticket.id,
      Subject: ticket.subject || "",
      Status: ticket.status || "",
      Priority: ticket.priority || "",
      Category: ticket.category || "",
      "Customer Email": ticket.customerEmail || "",
      "Customer ID": ticket.customerId || "",
      "Order Number": ticket.orderNumber || "",
      Assignee: ticket.assignee || "",
      "Contact Type": ticket.contactType || ticket.source || "",
      "Created At": ticket.createdAt || "",
      "Last Modified At": ticket.lastModifiedAt || "",
      "Resolution Date": ticket.resolutionDate || "",
      "Time Spent": ticket.timeSpentOnTicket || "",
    }));
}

function getRowsForReport(
  reportType: ReportTypeKey,
  tickets: TicketReportRow[],
  fromDate: string,
  toDate: string,
): ReportExportRow[] {
  if (reportType === "Tickets" || reportType === "SLA") {
    return mapTicketsToRows(tickets, fromDate, toDate);
  }

  return [];
}

export function ReportExportPanel() {
  const permissions = useReportPermissions();
  const { toasts, pushToast, dismissToast } = useReportToasts();
  const {
    data: ticketsData,
    error: ticketsError,
    loading: ticketsLoading,
    refetch: refetchTickets,
  } = useQuery<TicketsReportData>(TICKETS_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { limit: 500, offset: 0 },
  });

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

  const handleExport = async () => {
    if (reportTypeOptions.length === 0) {
      pushToast("error", "Your role does not include access to generate these reports.");
      return;
    }
    if (!selectedReportValue) {
      pushToast("error", "Please select a report type.");
      return;
    }

    setIsExporting(true);
    window.setTimeout(async () => {
      const fileName = `Report - ${selectedReportValue} (${formatDdMmYyyy(fromDate)} to ${formatDdMmYyyy(toDate)})`;
      try {
        let ticketRows = ticketsData?.ticketPage?.results ?? [];

        if ((selectedReportValue === "Tickets" || selectedReportValue === "SLA") && ticketsError) {
          const result = await refetchTickets();
          ticketRows = result.data?.ticketPage?.results ?? [];
        }

        const rows = getRowsForReport(
          selectedReportValue,
          ticketRows,
          fromDate,
          toDate,
        );

        await exportRowsToExcel(rows, fileName);
        pushToast("success", `${fileName} exported successfully!`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to export report";
        pushToast("error", message);
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
              loading={isExporting || ticketsLoading}
              disabled={reportTypeOptions.length === 0 || ticketsLoading}
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
