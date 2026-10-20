"use client";

import { useMemo, useState } from "react";
import { useApolloClient, useQuery } from "@apollo/client";
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
import { ORDERS_PAGE_QUERY } from "@/features/orders/api/queries";
import { CUSTOMERS_PAGE_QUERY } from "@/features/customers/api/queries";
import { REPORT_TYPES, useReportPermissions } from "../hooks/use-reports";
import { useReportToasts } from "../hooks/use-report-toasts";
import { exportRowsToExcel, formatDdMmYyyy } from "../utils/export-report";
import type { ReportExportRow, ReportTypeKey } from "../types/report-types";

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

type Money = { centAmount?: number | null; currencyCode?: string | null; fractionDigits?: number | null } | null | undefined;

function money(value: Money) {
  if (!value || typeof value.centAmount !== "number") return "";
  return (value.centAmount / 10 ** (value.fractionDigits ?? 2)).toFixed(value.fractionDigits ?? 2);
}

// SLA = the tickets report plus real time-to-resolve, computed from each
// ticket's own createdAt and resolutionDate (blank while unresolved).
function mapTicketsToSlaRows(tickets: TicketReportRow[], fromDate: string, toDate: string): ReportExportRow[] {
  const byId = new Map(tickets.map((t) => [t.ticketNumber || t.id, t]));
  return mapTicketsToRows(tickets, fromDate, toDate).map((row) => {
    const ticket = byId.get(String(row["Ticket ID"]));
    const created = ticket?.createdAt ? new Date(ticket.createdAt).getTime() : NaN;
    const resolved = ticket?.resolutionDate ? new Date(ticket.resolutionDate).getTime() : NaN;
    const hours = Number.isFinite(created) && Number.isFinite(resolved) && resolved >= created ? ((resolved - created) / 36e5).toFixed(1) : "";
    return { ...row, "Hours to Resolve": hours };
  });
}

type OrderReportRow = {
  id: string;
  orderNumber?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  orderState?: string | null;
  state?: string | null;
  shipmentState?: string | null;
  paymentState?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  totalPrice?: Money;
  lineItems?: Array<{ quantity?: number | null }> | null;
};

function mapOrdersToRows(orders: OrderReportRow[], fromDate: string, toDate: string): ReportExportRow[] {
  return orders
    .filter((o) => isWithinDateRange(o.createdAt, fromDate, toDate))
    .map((o) => ({
      "Order Number": o.orderNumber || o.id,
      "Customer Email": o.customerEmail || "",
      "Customer ID": o.customerId || "",
      "Order State": o.orderState || o.state || "",
      "Payment State": o.paymentState || "",
      "Shipment State": o.shipmentState || "",
      Total: money(o.totalPrice),
      Currency: o.totalPrice?.currencyCode || "",
      "Line Items": o.lineItems?.length ?? 0,
      "Total Quantity": (o.lineItems ?? []).reduce((n, li) => n + (li.quantity ?? 0), 0),
      "Created At": o.createdAt || "",
      "Last Modified At": o.lastModifiedAt || "",
    }));
}

type CustomerReportRow = {
  id: string;
  customerNumber?: string | null;
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  customerGroup?: { name?: string | null; key?: string | null } | null;
};

function mapCustomersToRows(customers: CustomerReportRow[], fromDate: string, toDate: string): ReportExportRow[] {
  return customers
    .filter((c) => isWithinDateRange(c.createdAt, fromDate, toDate))
    .map((c) => ({
      "Customer ID": c.id,
      "Customer Number": c.customerNumber || "",
      "First Name": c.firstName || "",
      "Last Name": c.lastName || "",
      Email: c.email || "",
      Company: c.companyName || "",
      "Customer Group": c.customerGroup?.name || c.customerGroup?.key || "",
      "External ID": c.externalId || "",
      "Created At": c.createdAt || "",
      "Last Modified At": c.lastModifiedAt || "",
    }));
}

type CartReportRow = {
  id: string;
  customerId?: string | null;
  customerEmail?: string | null;
  cartState?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  totalPrice?: Money;
  lineItems?: Array<{ quantity?: number | null }> | null;
};

function mapCartsToRows(carts: CartReportRow[], fromDate: string, toDate: string): ReportExportRow[] {
  return carts
    .filter((c) => isWithinDateRange(c.createdAt, fromDate, toDate))
    .map((c) => ({
      "Cart ID": c.id,
      "Customer Email": c.customerEmail || "",
      "Customer ID": c.customerId || "",
      State: c.cartState || "",
      Total: money(c.totalPrice),
      Currency: c.totalPrice?.currencyCode || "",
      "Line Items": c.lineItems?.length ?? 0,
      "Total Quantity": (c.lineItems ?? []).reduce((n, li) => n + (li.quantity ?? 0), 0),
      "Created At": c.createdAt || "",
      "Last Modified At": c.lastModifiedAt || "",
    }));
}

export function ReportExportPanel() {
  const permissions = useReportPermissions();
  const apollo = useApolloClient();
  const { toasts, pushToast, dismissToast } = useReportToasts();
  const {
    data: ticketsData,
    error: ticketsError,
    loading: ticketsLoading,
    refetch: refetchTickets,
  } = useQuery<TicketsReportData>(TICKETS_QUERY, {
    fetchPolicy: "cache-first",
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
    const fileName = `Report - ${selectedReportValue} (${formatDdMmYyyy(fromDate)} to ${formatDdMmYyyy(toDate)})`;
    try {
      let rows: ReportExportRow[];
      if (selectedReportValue === "Tickets" || selectedReportValue === "SLA") {
        let ticketRows = ticketsData?.ticketPage?.results ?? [];
        if (ticketsError) {
          const result = await refetchTickets();
          ticketRows = result.data?.ticketPage?.results ?? [];
        }
        rows = selectedReportValue === "SLA"
          ? mapTicketsToSlaRows(ticketRows, fromDate, toDate)
          : mapTicketsToRows(ticketRows, fromDate, toDate);
      } else if (selectedReportValue === "Orders") {
        const { data } = await apollo.query<{ orderPage?: { results?: OrderReportRow[] } }>({
          query: ORDERS_PAGE_QUERY,
          variables: { limit: 500, offset: 0, sortKey: "createdAt", sortOrder: "desc" },
          fetchPolicy: "network-only",
        });
        rows = mapOrdersToRows(data?.orderPage?.results ?? [], fromDate, toDate);
      } else if (selectedReportValue === "Customer") {
        const { data } = await apollo.query<{ customerPage?: { results?: CustomerReportRow[] } }>({
          query: CUSTOMERS_PAGE_QUERY,
          variables: { limit: 500, offset: 0, sortKey: "createdAt", sortOrder: "desc" },
          fetchPolicy: "network-only",
        });
        rows = mapCustomersToRows(data?.customerPage?.results ?? [], fromDate, toDate);
      } else if (selectedReportValue === "Carts") {
        // commercetools rejects one large cart query as too complex, so page
        // through 100 at a time (the same size the Carts page loads), up to 500.
        const carts: CartReportRow[] = [];
        for (let offset = 0; offset < 500; offset += 100) {
          const response = await fetch(`/api/carts?limit=100&offset=${offset}`);
          const payload = (await response.json().catch(() => ({}))) as { results?: CartReportRow[]; total?: number; error?: string };
          if (!response.ok) throw new Error(payload.error || `Failed to load carts (${response.status})`);
          const page = payload.results ?? [];
          carts.push(...page);
          if (page.length < 100 || (typeof payload.total === "number" && carts.length >= payload.total)) break;
        }
        rows = mapCartsToRows(carts, fromDate, toDate);
      } else {
        throw new Error("Product export isn't connected yet: there is no catalog listing source for reports.");
      }

      await exportRowsToExcel(rows, fileName);
      pushToast("success", `${fileName} exported successfully!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export report";
      pushToast("error", message);
    } finally {
      setIsExporting(false);
    }
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
