import { AppShell } from "../../components/shell/AppShell";
import { OrderListView } from "../../features/orders/components/OrderListView";

export default function OrdersPage() {
  return (
    <AppShell>
      <OrderListView />
    </AppShell>
  );
}

