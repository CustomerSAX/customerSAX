import { AppShell } from "../../components/shell/AppShell";
import { TicketsPageView } from "../../features/workspace/ModulePages";

export default function TicketsPage() {
  return (
    <AppShell>
      <TicketsPageView />
    </AppShell>
  );
}
