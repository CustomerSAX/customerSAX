import { Suspense } from "react";
import { Skeleton } from "@csa/ui";
import { AppShell } from "../../components/shell/AppShell";
import { ProductListView } from "../../features/products/components/ProductListView";

import { currentProductsConfiguration } from "../../features/products/providers/server-config";

export const dynamic = "force-dynamic";

async function ProjectProducts() {
  const { key, provider, searchConfig } = await currentProductsConfiguration();
  return <ProductListView key={key} provider={provider} searchConfig={searchConfig} />;
}

export default function ProductsPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton height={500} className="w-full" />}>
        <ProjectProducts />
      </Suspense>
    </AppShell>
  );
}
