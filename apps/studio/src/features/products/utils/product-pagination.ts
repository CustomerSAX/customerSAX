/** Invalid or absent page parameters open the first page. */
export function productPageFromParam(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Preserve other query parameters and the hash when changing pages. */
export function productPageHref(href: string, page: number): string {
  const url = new URL(href);
  url.searchParams.set("page", String(productPageFromParam(String(page))));
  return `${url.pathname}${url.search}${url.hash}`;
}
