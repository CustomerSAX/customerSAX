import { Suspense } from "react";
import { AppShell } from "../../../../components/shell/AppShell";
import { CartCreateQuoteRequestView } from "../../../../features/cart/components/CartCreateQuoteRequestView";
import { Skeleton } from "@csa/ui";

export default async function CartCreateQuoteRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={400} className="w-full" />}>
        <CartCreateQuoteRequestView id={id} />
      </Suspense>
    </AppShell>
  );
}
