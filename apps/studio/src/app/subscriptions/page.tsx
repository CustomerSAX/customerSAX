import { AppShell } from "../../components/shell/AppShell";
import { SubscriptionManagementView } from "../../features/subscriptions/components/SubscriptionManagementView";

export default function SubscriptionsPage() {
  return (
    <AppShell>
      <SubscriptionManagementView />
    </AppShell>
  );
}
