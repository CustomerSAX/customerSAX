export type ReportTypeKey = "Tickets" | "Orders" | "Carts" | "Customer" | "Product" | "SLA";

export type ReportPermissionKey =
  | "ViewCsaTickets"
  | "ViewCustomerOrders"
  | "ViewCustomerCarts"
  | "ViewCsaCustomer"
  | "ViewProductSearch";

export type ReportPermissions = Record<ReportPermissionKey, boolean>;

export interface ReportTypeOption {
  value: ReportTypeKey;
  label: string;
  permission: ReportPermissionKey;
}

export type ReportExportRow = Record<string, string | number>;
