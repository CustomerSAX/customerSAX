import { Suspense } from "react";
import { AppShell } from "../../../../components/shell/AppShell";
import { CartAddressDetailsView } from "../../../../features/cart/components/CartAddressDetailsView";
import { Skeleton } from "@csa/ui";

export default async function CartQuoteAddressDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartAddressDetailsView id={id} mode="quote" />
      </Suspense>
    </AppShell>
  );
}
