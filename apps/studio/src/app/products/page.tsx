import { Suspense } from "react";
import { Skeleton } from "@csa/ui";
import { AppShell } from "../../components/shell/AppShell";
import { ProductListView } from "../../features/products/components/ProductListView";

export default function ProductsPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={500} className="w-full" />}>
        <ProductListView />
      </Suspense>
    </AppShell>
  );
}
