import { AppShell } from "../../../components/shell/AppShell";
import { TicketDetailView } from "../../../features/details/TicketDetailView";

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <TicketDetailView id={params.id} />
    </AppShell>
  );
}
