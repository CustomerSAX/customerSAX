import { Suspense } from "react";
import { AppShell } from "../../../../components/shell/AppShell";
import { CartPlaceOrderView } from "../../../../features/cart/components/CartPlaceOrderView";
import { Skeleton } from "@csa/ui";

export default async function CartPlaceOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartPlaceOrderView id={id} />
      </Suspense>
    </AppShell>
  );
}
