import { AppShell } from "../../components/shell/AppShell";
import { TicketListView } from "../../features/tickets/components/TicketListView";

export default function TicketsPage() {
  return (
    <AppShell>
      <TicketListView />
    </AppShell>
  );
}

