import { AppShell } from "@/components/shell/AppShell";
import { QuoteCreateView } from "@/features/quotes/components/QuoteCreateView";

export default function CreateQuotePage() {
  return (
    <AppShell>
      <QuoteCreateView />
    </AppShell>
  );
}
