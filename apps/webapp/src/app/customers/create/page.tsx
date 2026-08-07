import { AppShell } from "../../../components/shell/AppShell";
import { CustomerCreateView } from "../../../features/customers/components/CustomerCreateView";

export default function CreateCustomerPage() {
  return (
    <AppShell>
      <CustomerCreateView />
    </AppShell>
  );
}
