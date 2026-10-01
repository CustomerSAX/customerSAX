"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, Icon, Skeleton, TablePagination } from "@csa/ui";
import type { UseProductListReturn } from "../hooks/use-products";
import type { ProductListRow, ProductSortKey } from "../types/product-types";
import { useTablePaginationLabels } from "@/lib/use-table-pagination-labels";

const inputClass =
  "w-full rounded-m-md border border-m-border bg-m-surface px-3 py-2.5 text-sm text-m-text focus:outline-none focus:ring-2 focus:ring-m-primary";

function ProductImage({ product }: { product: ProductListRow }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex aspect-square items-center justify-center rounded-m-lg bg-m-surface-2 p-5">
      {product.imageUrl && !failed ? (
        // CT image hosts are project-specific.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.itemName}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <Icon name="package" size="lg" className="text-m-text-muted" />
      )}
    </div>
  );
}

function ProductListCard({ product }: { product: ProductListRow }) {
  const t = useTranslations("Products");
  const href = `/products/${encodeURIComponent(product.id)}`;
  return (
    <article className="group rounded-m-xl border border-m-border bg-m-surface p-5 transition-shadow hover:shadow-m-card sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <Link
          href={href}
          aria-label={product.itemName}
          className="w-24 shrink-0 self-start rounded-m-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-primary sm:w-28"
        >
          <ProductImage product={product} />
        </Link>
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold text-m-text">
                  <Link href={href} className="hover:underline">
                    {product.itemName}
                  </Link>
                </h3>
                {product.sku !== "--" && (
                  <span className="break-all font-mono text-xs text-m-text-muted">
                    {product.sku}
                  </span>
                )}
              </div>
              {(product.productType !== "--" || product.categories !== "--") && (
                <p className="text-sm text-m-primary">
                  {[product.productType, product.categories]
                    .filter((value) => value !== "--")
                    .join(" · ")}
                </p>
              )}
              {product.description !== "--" && (
                <p className="line-clamp-2 max-w-3xl text-sm text-m-text-muted">
                  {product.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
              <p className="text-sm font-semibold text-m-text">
                {t("variantCount", { count: product.variantCount })} ·{" "}
                {product.price === "--" ? t("priceUnavailable") : product.price}
              </p>
              <Link
                href={href}
                className="rounded-m-md border border-m-border px-4 py-2 text-center text-sm font-medium text-m-primary hover:bg-m-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-primary"
              >
                {t("viewDetails")}
              </Link>
              {product.availability !== "--" && (
                <Badge
                  size="sm"
                  variant={product.availability === "In stock" ? "success" : "neutral"}
                >
                  {product.availability === "In stock" ? t("inStock") : t("outOfStock")}
                </Badge>
              )}
            </div>
          </div>
          {product.variants.length > 0 && (
            <div className="overflow-x-auto rounded-m-lg border border-m-border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  {t("productVariants", { name: product.itemName })}
                </caption>
                <thead className="border-b border-m-border bg-m-surface-2 text-m-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      {t("variantId")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      SKU
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      {t("variantKey")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m-border">
                  {product.variants.map((variant) => (
                    <tr key={variant.id}>
                      <td className="px-4 py-3 font-mono text-m-text-muted">
                        {variant.id}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={href}
                          className="break-all font-medium text-m-primary hover:underline"
                        >
                          {variant.sku}
                        </Link>
                      </td>
                      <td className="break-all px-4 py-3 text-m-text-muted">
                        {variant.key}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGridView({
  list,
  layout = "grid"
}: {
  list: UseProductListReturn;
  layout?: "grid" | "list";
}) {
  const t = useTranslations("Products");
  const labels = useTablePaginationLabels();
  const {
    products,
    loading,
    error,
    appliedSearch,
    sort,
    page,
    perPage,
    totalItems,
    onRetry,
    onReset,
    onSortChange,
    onPageChange
  } = list;
  const searching = Boolean(appliedSearch.text.trim());
  const filtered = Object.values(list.filters).some((value) => Array.isArray(value) ? value.length > 0 : value != null);
  const resultsClassName =
    layout === "list"
      ? "flex flex-col gap-5"
      : "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  return (
    <div>
      <section className="min-w-0 space-y-5" aria-label={t("title")} aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-m-text-muted" role="status">
            {loading
              ? t("loadingProducts")
              : t("resultRange", {
                  start: totalItems ? (page - 1) * perPage + 1 : 0,
                  end: Math.min(page * perPage, totalItems),
                  total: totalItems
                })}
          </p>
          <div className="flex items-center gap-2">
            <label
              htmlFor="catalog-sort"
              className="whitespace-nowrap text-sm text-m-text-muted"
            >
              {t("sortBy")}
            </label>
            <select
              id="catalog-sort"
              className={inputClass}
              disabled={searching || loading}
              value={`${sort?.key ?? "created"}:${sort?.order ?? "desc"}`}
              onChange={(event) => {
                const [key, order] = event.target.value.split(":");
                onSortChange({
                  key: key as ProductSortKey,
                  order: order === "asc" ? "asc" : "desc"
                });
              }}
            >
              <option value="created:desc">{t("newestFirst")}</option>
              <option value="created:asc">{t("oldestFirst")}</option>
              <option value="itemName:asc">{t("nameAscending")}</option>
              <option value="itemName:desc">{t("nameDescending")}</option>
              <option value="modified:desc">{t("recentlyUpdated")}</option>
            </select>
          </div>
        </div>
        {searching && (
          <p className="text-xs text-m-text-muted">
            {t("searchSortHint", { query: appliedSearch.text })}
          </p>
        )}
        {loading ? (
          <div className={resultsClassName}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton
                key={i}
                height={layout === "list" ? 240 : 360}
                className="rounded-m-xl"
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-m-xl border border-m-border bg-m-surface p-8 text-center"
          >
            <p className="mb-4 text-sm text-m-danger">{error}</p>
            <Button onClick={onRetry}>{t("retry")}</Button>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon="package"
            title={t("emptyTitle")}
            description={filtered ? t("emptyFilters") : searching ? t("emptySearch") : t("emptyDefault")}
            action={
              searching || filtered ? (
                <Button onClick={onReset}>{t("resetSearch")}</Button>
              ) : undefined
            }
          />
        ) : (
          <div className={resultsClassName}>
            {products.map((product) =>
              layout === "list" ? (
                <ProductListCard key={product.id} product={product} />
              ) : (
                <article
                  key={product.id}
                  className="group flex min-w-0 flex-col rounded-m-xl border border-m-border bg-m-surface p-4 transition-shadow hover:shadow-m-card"
                >
                  <Link
                    href={`/products/${encodeURIComponent(product.id)}`}
                    aria-label={product.itemName}
                    className="rounded-m-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-primary"
                  >
                    <ProductImage product={product} />
                  </Link>
                  <div className="flex flex-1 flex-col gap-2 pt-4">
                    {product.productType !== "--" && (
                      <p className="text-xs text-m-text-muted">{product.productType}</p>
                    )}
                    <h3 className="text-sm font-semibold text-m-text">
                      <Link
                        href={`/products/${encodeURIComponent(product.id)}`}
                        className="hover:underline"
                      >
                        {product.itemName}
                      </Link>
                    </h3>
                    {product.sku !== "--" && (
                      <p className="break-all font-mono text-xs text-m-text-muted">
                        {product.sku}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {product.availability !== "--" && (
                        <Badge
                          size="sm"
                          variant={
                            product.availability === "In stock" ? "success" : "neutral"
                          }
                        >
                          {product.availability === "In stock"
                            ? t("inStock")
                            : t("outOfStock")}
                        </Badge>
                      )}
                      <span className="text-xs text-m-text-muted">
                        {t("variantCount", { count: product.variantCount })}
                      </span>
                    </div>
                    <p className="mt-auto pt-3 text-sm font-semibold text-m-text">
                      {product.price === "--" ? t("priceUnavailable") : product.price}
                    </p>
                    <Link
                      href={`/products/${encodeURIComponent(product.id)}`}
                      className="mt-2 rounded-m-md border border-m-border px-3 py-2 text-center text-sm font-medium text-m-primary hover:bg-m-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-primary"
                    >
                      {t("viewDetails")}
                    </Link>
                  </div>
                </article>
              )
            )}
          </div>
        )}
        {!loading && !error && totalItems > 0 && (
          <div className="rounded-m-lg border border-m-border bg-m-surface px-4 py-3">
            <TablePagination
              page={page}
              totalPages={Math.max(1, Math.ceil(totalItems / perPage))}
              totalItems={totalItems}
              pageSize={perPage}
              onPageChange={onPageChange}
              labels={labels}
            />
          </div>
        )}
      </section>
    </div>
  );
}
