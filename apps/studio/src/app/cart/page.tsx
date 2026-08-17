import { Suspense } from "react";
import { AppShell } from "../../components/shell/AppShell";
import { CartListView } from "../../features/cart/components/CartListView";
import { Skeleton } from "@csa/ui";

export default function CartPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartListView />
      </Suspense>
    </AppShell>
  );
}
