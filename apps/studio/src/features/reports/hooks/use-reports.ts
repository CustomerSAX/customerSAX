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

export function getReportRows(_type: ReportTypeKey): ReportExportRow[] {
  return [];
}
