import { AppShell } from "@/components/shell/AppShell";
import { EmployeeDetailView } from "@/features/employees/components/EmployeeDetailView";

interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <EmployeeDetailView id={id} />
    </AppShell>
  );
}
