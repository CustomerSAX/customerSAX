import { AppShell } from "../../../components/shell/AppShell";
import { ProductDetailView } from "../../../features/products/components/ProductDetailView";

interface ProductDetailPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  return (
    <AppShell>
      <ProductDetailView id={params.id} />
    </AppShell>
  );
}
