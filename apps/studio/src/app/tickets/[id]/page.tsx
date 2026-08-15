import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { TicketDetailView } from "../../../features/details/TicketDetailView";
import { Skeleton } from "@csa/ui";

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <TicketDetailView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
