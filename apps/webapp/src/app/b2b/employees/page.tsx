import { AppShell } from "@/components/shell/AppShell";
import { EmployeeListView } from "@/features/employees/components/EmployeeListView";

export default function EmployeesPage() {
  return (
    <AppShell>
      <EmployeeListView />
    </AppShell>
  );
}
