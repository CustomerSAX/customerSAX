import { redirect } from "next/navigation";

function safeCallback(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default async function SelectProjectPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  redirect(safeCallback(params.callbackUrl));
}
