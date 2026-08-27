import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { TicketCreateView } from "../../../features/tickets/components/TicketCreateView";
import { Skeleton } from "@csa/ui";

export default function CreateTicketPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <TicketCreateView />
      </Suspense>
    </AppShell>
  );
}
