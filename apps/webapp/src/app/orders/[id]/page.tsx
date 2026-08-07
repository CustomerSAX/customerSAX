import { AppShell } from "../../../components/shell/AppShell";
import { OrderDetailView } from "../../../features/details/OrderDetailView";

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <OrderDetailView id={params.id} />
    </AppShell>
  );
}
