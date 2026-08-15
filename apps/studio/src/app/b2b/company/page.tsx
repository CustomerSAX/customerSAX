import { AppShell } from "@/components/shell/AppShell";
import { CompanyListView } from "@/features/companies/components/CompanyListView";

export default function CompaniesPage() {
  return (
    <AppShell>
      <CompanyListView />
    </AppShell>
  );
}
