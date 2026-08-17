export type AuditActionClass = "a-create" | "a-edit" | "a-remove" | "a-view" | "a-approve" | "a-denied";

export type AuditResult = "Success" | "Denied";

export type AuditDateRangeKey = "today" | "yesterday" | "last7" | "last30" | "thismonth" | "lastmonth";

export interface AuditFieldDiff {
  label: string;
  value?: string;
  before?: string;
  after?: string;
}

export interface AuditLogEntry {
  id: string;
  /** ISO timestamp */
  timestamp: string;
  agent: string;
  userEmail: string;
  action: string;
  actionClass: AuditActionClass;
  module: string;
  entity: string;
  details: string;
  result: AuditResult;
  fields: AuditFieldDiff[];
  ipAddress: string;
  sessionId: string;
}

export interface AuditLogFilters {
  dateRange: AuditDateRangeKey;
  agent: string;
  action: string;
  search: string;
}
