import { Badge, PageHeader } from "@csa/ui";
import { AuditLogListView } from "./AuditLogListView";

export function AuditLogView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Review security audit trail, agent actions, AI assistant tool calls, and platform configuration changes."
        badge={
          <Badge variant="primary" appearance="subtle">
            Administration
          </Badge>
        }
      />
      <AuditLogListView />
    </div>
  );
}
