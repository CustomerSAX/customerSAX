import type {
  ReportExportRow,
  ReportPermissions,
  ReportTypeKey,
  ReportTypeOption,
} from "../types/report-types";

export const REPORT_TYPES: ReportTypeOption[] = [
  { value: "Tickets", label: "Tickets", permission: "ViewCsaTickets" },
  { value: "Orders", label: "Orders", permission: "ViewCustomerOrders" },
  { value: "Carts", label: "Carts", permission: "ViewCustomerCarts" },
  { value: "Customer", label: "Customer", permission: "ViewCsaCustomer" },
  { value: "Product", label: "Product", permission: "ViewProductSearch" },
  { value: "SLA", label: "SLA", permission: "ViewCsaTickets" },
];

const MOCK_REPORT_ROWS: Record<ReportTypeKey, ReportExportRow[]> = {
  Tickets: [
    { id: "T001", status: "Open", priority: "High", created: "2026-05-14" },
    { id: "T002", status: "In Progress", priority: "Medium", created: "2026-05-13" },
    { id: "T003", status: "Resolved", priority: "Low", created: "2026-05-10" },
  ],
  Orders: [
    { id: "O001", status: "Confirmed", amount: 1500, created: "2026-05-14" },
    { id: "O002", status: "Pending", amount: 2000, created: "2026-05-13" },
    { id: "O003", status: "Shipped", amount: 875, created: "2026-05-09" },
  ],
  Carts: [
    { id: "C001", status: "Active", items: 5, created: "2026-05-14" },
    { id: "C002", status: "Abandoned", items: 3, created: "2026-05-12" },
  ],
  Customer: [
    { id: "CU001", name: "John Doe", email: "john@example.com", created: "2026-05-10" },
    { id: "CU002", name: "Jane Smith", email: "jane@example.com", created: "2026-05-05" },
  ],
  Product: [
    { id: "P001", name: "Product A", category: "Electronics", price: 500 },
    { id: "P002", name: "Product B", category: "Clothing", price: 100 },
  ],
  SLA: [
    { ticketId: "T001", slaStatus: "Met", responseTime: "2 hours" },
    { ticketId: "T002", slaStatus: "Not Met", responseTime: "4 hours" },
  ],
};

/**
 * No auth/permissions system exists in this UI-only phase, so every report
 * type is granted by default. The shape mirrors the legacy role-permission
 * record so the gating logic (filtering, empty state, disabled button) is
 * preserved and can be wired to a real permissions source later.
 */
const DEFAULT_PERMISSIONS: ReportPermissions = {
  ViewCsaTickets: true,
  ViewCustomerOrders: true,
  ViewCustomerCarts: true,
  ViewCsaCustomer: true,
  ViewProductSearch: true,
};

export function useReportPermissions(): ReportPermissions {
  return DEFAULT_PERMISSIONS;
}

export function getMockReportRows(type: ReportTypeKey): ReportExportRow[] {
  return MOCK_REPORT_ROWS[type] ?? [];
}
