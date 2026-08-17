import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { OrderDetailView } from "../../../features/orders/components/OrderDetailView";
import { Skeleton } from "@csa/ui";

export const dynamic = 'force-dynamic';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <OrderDetailView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
