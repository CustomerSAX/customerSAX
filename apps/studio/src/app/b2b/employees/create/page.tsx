import { AppShell } from "@/components/shell/AppShell";
import { EmployeeCreateView } from "@/features/employees/components/EmployeeCreateView";

export default function CreateEmployeePage() {
  return (
    <AppShell>
      <EmployeeCreateView />
    </AppShell>
  );
}
