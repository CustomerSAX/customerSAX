import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { TicketDetailView } from "../../../features/tickets/components/TicketDetailView";
import { Skeleton } from "@csa/ui";

export const dynamic = 'force-dynamic';

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <TicketDetailView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
