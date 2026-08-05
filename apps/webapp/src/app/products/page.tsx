import { AppShell } from "../../components/shell/AppShell";
import { ProductsPageView } from "../../features/workspace/ModulePages";

export default function ProductsPage() {
  return (
    <AppShell>
      <ProductsPageView />
    </AppShell>
  );
}
