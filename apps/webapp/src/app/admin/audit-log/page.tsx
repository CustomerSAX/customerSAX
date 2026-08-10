import { AppShell } from "../../../components/shell/AppShell";
import { AuditLogView } from "../../../features/audit-log/components/AuditLogView";

export default function AuditLogPage() {
  return (
    <AppShell>
      <AuditLogView />
    </AppShell>
  );
}
