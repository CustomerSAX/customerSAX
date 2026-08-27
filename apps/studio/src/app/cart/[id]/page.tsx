import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { CartDetailView } from "../../../features/cart/components/CartDetailView";
import { Skeleton } from "@csa/ui";

export default async function CartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartDetailView id={id} />
      </Suspense>
    </AppShell>
  );
}
