import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { CustomerDetailView } from "../../../features/customers/components/CustomerDetailView";
import { Skeleton } from "@csa/ui";

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={300} className="w-full" />}>
        <CustomerDetailView id={id} />
      </Suspense>
    </AppShell>
  );
}
