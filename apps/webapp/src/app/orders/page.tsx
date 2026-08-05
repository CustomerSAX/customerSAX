import { AppShell } from "../../components/shell/AppShell";
import { OrdersPageView } from "../../features/workspace/ModulePages";

export default function OrdersPage() {
  return (
    <AppShell>
      <OrdersPageView />
    </AppShell>
  );
}
