import { AppShell } from "../../../components/shell/AppShell";
import { CustomerDetailView } from "../../../features/details/CustomerDetailView";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <CustomerDetailView id={params.id} />
    </AppShell>
  );
}
