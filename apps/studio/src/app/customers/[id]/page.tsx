import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { CustomerDetailView } from "../../../features/customers/components/CustomerDetailView";
import { Skeleton } from "@csa/ui";

export const dynamic = 'force-dynamic';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <CustomerDetailView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
