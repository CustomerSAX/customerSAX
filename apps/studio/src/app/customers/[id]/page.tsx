import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { CustomerDetailView } from "../../../features/details/CustomerDetailView";
import { Skeleton } from "@csa/ui";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <CustomerDetailView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
