import { AppShell } from "../../components/shell/AppShell";
import { ProductListView } from "../../features/products/components/ProductListView";

export default function ProductsPage() {
  return (
    <AppShell>
      <ProductListView />
    </AppShell>
  );
}
