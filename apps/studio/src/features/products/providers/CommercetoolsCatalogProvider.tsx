"use client";

import { CatalogView } from "@csa/search";
import { SearchBar, TablePagination } from "@csa/ui";
import { useTranslations } from "next-intl";
import { useProductList } from "../hooks/use-products";
import { ProductFilters } from "../components/ProductFilters";
import { ctCatalogItem } from "./commercetools-mapper";
import type { ProductSortKey } from "../types/product-types";
import { useTablePaginationLabels } from "@/lib/use-table-pagination-labels";

export function CommercetoolsCatalogProvider() {
  const list = useProductList();
  const t = useTranslations("Products");
  const labels = useTablePaginationLabels();
  const searching = Boolean(list.appliedSearch.text.trim());
  return (
    <CatalogView
      provider={{
        enabled: true,
        providerId: "commercetools",
        providerName: "commercetools",
        searchMode: "Catalog Search",
        status: list.error ? "error" : list.loading ? "loading" : "connected"
      }}
      items={list.products.map(ctCatalogItem)}
      loading={list.loading}
      error={list.error}
      onRetry={list.onRetry}
      onReset={list.onReset}
      search={
        <SearchBar
          value={list.search.text}
          onChange={(text) => list.setSearch({ text, option: "allFields" })}
          onSearch={list.onSearch}
          onClear={() => list.setSearch({ text: "", option: "allFields" })}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchProducts")}
        />
      }
      filters={<ProductFilters list={list} />}
      stats={
        <p className="text-sm text-m-text-muted" role="status">
          {list.loading
            ? t("loadingProducts")
            : t("countTitle", { count: list.totalItems })}
        </p>
      }
      sort={
        <div className="flex items-center gap-2">
          <label htmlFor="ct-catalog-sort" className="text-xs text-m-text-muted">
            {t("sortBy")}
          </label>
          <select
            id="ct-catalog-sort"
            disabled={searching || list.loading}
            title={
              searching
                ? t("searchSortHint", { query: list.appliedSearch.text })
                : undefined
            }
            value={`${list.sort?.key ?? "created"}:${list.sort?.order ?? "desc"}`}
            onChange={(event) => {
              const [key, order] = event.target.value.split(":");
              list.onSortChange({
                key: key as ProductSortKey,
                order: order === "asc" ? "asc" : "desc"
              });
            }}
            className="rounded-m-lg border border-m-border bg-m-surface px-3 py-2 text-xs text-m-text"
          >
            <option value="created:desc">{t("newestFirst")}</option>
            <option value="created:asc">{t("oldestFirst")}</option>
            <option value="itemName:asc">{t("nameAscending")}</option>
            <option value="itemName:desc">{t("nameDescending")}</option>
            <option value="modified:desc">{t("recentlyUpdated")}</option>
          </select>
        </div>
      }
      pagination={
        !list.loading && !list.error && list.totalItems > 0 ? (
          <div className="overflow-hidden rounded-m-lg border border-m-border">
            <TablePagination
              page={list.page}
              totalPages={Math.max(1, Math.ceil(list.totalItems / list.perPage))}
              totalItems={list.totalItems}
              pageSize={list.perPage}
              onPageChange={list.onPageChange}
              labels={labels}
            />
          </div>
        ) : null
      }
    />
  );
}
