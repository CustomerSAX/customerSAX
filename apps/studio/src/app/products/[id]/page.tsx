import { AppShell } from "../../../components/shell/AppShell";
import { ProductDetailView } from "../../../features/products/components/ProductDetailView";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <ProductDetailView id={id} />
    </AppShell>
  );
}
