import { Suspense } from "react";
import { AppShell } from "../../../../components/shell/AppShell";
import { CartAddressDetailsView } from "../../../../features/cart/components/CartAddressDetailsView";
import { Skeleton } from "@csa/ui";

export default function CartAddressDetailsPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartAddressDetailsView id={params.id} />
      </Suspense>
    </AppShell>
  );
}
