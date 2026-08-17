import { AppShell } from "@/components/shell/AppShell";
import { CompanyCreateView } from "@/features/companies/components/CompanyCreateView";

export default function CreateCompanyPage() {
  return (
    <AppShell>
      <CompanyCreateView />
    </AppShell>
  );
}
