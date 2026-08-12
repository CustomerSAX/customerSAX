import { AppShell } from "@/components/shell/AppShell";
import { QuoteListView } from "@/features/quotes/components/QuoteListView";

export default function QuotesPage() {
  return (
    <AppShell>
      <QuoteListView />
    </AppShell>
  );
}
