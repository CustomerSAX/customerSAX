import { Suspense } from "react";
import { Skeleton } from "@csa/ui";
import { AppShell } from "../../components/shell/AppShell";
import { ProductListView } from "../../features/products/components/ProductListView";

import { productsProvider } from "../../features/products/providers/config";

export const dynamic = "force-dynamic";

export default function ProductsPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={500} className="w-full" />}>
        <ProductListView provider={productsProvider(process.env.PRODUCTS_PROVIDER)} />
      </Suspense>
    </AppShell>
  );
}
