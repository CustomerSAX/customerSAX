import { Suspense } from "react";
import { AppShell } from "../../../../components/shell/AppShell";
import { CartPlaceOrderView } from "../../../../features/cart/components/CartPlaceOrderView";
import { Skeleton } from "@csa/ui";

export default function CartPlaceOrderPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartPlaceOrderView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
