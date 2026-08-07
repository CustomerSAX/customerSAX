import { AppShell } from "../../../components/shell/AppShell";
import { CartDetailView } from "../../../features/details/CartDetailView";

export default function CartDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <CartDetailView id={params.id} />
    </AppShell>
  );
}
