import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { TicketDetailView } from "../../../features/tickets/components/TicketDetailView";
import { Skeleton } from "@csa/ui";

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <TicketDetailView id={id} />
      </Suspense>
    </AppShell>
  );
}
