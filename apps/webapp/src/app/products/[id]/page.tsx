import { AppShell } from "../../../components/shell/AppShell";
import { ProductDetailView } from "../../../features/details/ProductDetailView";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <ProductDetailView id={params.id} />
    </AppShell>
  );
}
