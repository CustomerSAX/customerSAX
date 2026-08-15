import { AppShell } from "../../components/shell/AppShell";
import { CustomerListView } from "../../features/customers/components/CustomerListView";

export default function CustomersPage() {
  return (
    <AppShell>
      <CustomerListView />
    </AppShell>
  );
}

