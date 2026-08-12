import { AppShell } from "@/components/shell/AppShell";
import { CompanyDetailView } from "@/features/companies/components/CompanyDetailView";

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <CompanyDetailView id={id} />
    </AppShell>
  );
}
