import { Account360View } from "@/features/accounts/Account360View";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountPage({ params }: PageProps) {
  const { id } = await params;
  return <Account360View accountId={id} />;
}
