import { AppShell } from "../../components/shell/AppShell";
import { AlgoliaSearchView } from "../../features/search/components/AlgoliaSearchView";

export default function AlgoliaSearchPage() {
  return (
    <AppShell>
      <AlgoliaSearchView />
    </AppShell>
  );
}
