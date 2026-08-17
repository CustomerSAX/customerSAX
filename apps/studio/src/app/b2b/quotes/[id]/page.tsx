import { AppShell } from "@/components/shell/AppShell";
import { QuoteDetailView } from "@/features/quotes/components/QuoteDetailView";

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <QuoteDetailView id={id} />
    </AppShell>
  );
}
