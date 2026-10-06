import { redirect } from "next/navigation";

/** Preserve existing bookmarks while Products becomes the single catalog entry. */
export default async function AlgoliaSearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  redirect(`/products${params.size ? `?${params}` : ""}`);
}
