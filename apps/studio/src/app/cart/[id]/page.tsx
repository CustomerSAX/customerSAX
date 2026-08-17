import { Suspense } from "react";
import { AppShell } from "../../../components/shell/AppShell";
import { CartDetailView } from "../../../features/cart/components/CartDetailView";
import { Skeleton } from "@csa/ui";

export default function CartDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartDetailView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
