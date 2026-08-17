import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { AgentsView } from "@/features/agents/AgentsView";

const agentsNavEnabled = process.env.NEXT_PUBLIC_ENABLE_AGENTS_NAV === "true";

export default function AgentsPage() {
  if (!agentsNavEnabled) notFound();
  return (
    <AppShell>
      <AgentsView />
    </AppShell>
  );
}
