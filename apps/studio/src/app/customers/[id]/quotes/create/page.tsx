import { AppShell } from "@/components/shell/AppShell";
import { QuoteCreateView } from "@/features/quotes/components/QuoteCreateView";

export default async function CreateCustomerQuotePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <QuoteCreateView customerContextId={id} />
    </AppShell>
  );
}
