"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Accordion, Button } from "@csa/ui";
import type { UseProductListReturn } from "../hooks/use-products";
import type { CatalogFacetOption } from "../types/product-types";

export function ProductFilters({ list }: { list: UseProductListReturn }) {
  const t = useTranslations("Products");
  const { facets, filters, onFiltersChange, onReset, loading } = list;
  const [min, setMin] = useState(filters.minPrice?.toString() ?? "");
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? "");
  useEffect(() => {
    setMin(filters.minPrice?.toString() ?? "");
    setMax(filters.maxPrice?.toString() ?? "");
  }, [filters.minPrice, filters.maxPrice]);
  const invalid =
    (min !== "" && (!Number.isFinite(Number(min)) || Number(min) < 0)) ||
    (max !== "" && (!Number.isFinite(Number(max)) || Number(max) < 0)) ||
    (min !== "" && max !== "" && Number(min) > Number(max));
  const groups: Array<{
    key: "productTypes" | "categoryIds" | "availability";
    label: string;
    options: CatalogFacetOption[];
  }> = [
    {
      key: "productTypes",
      label: t("columns.productType"),
      options: facets?.productTypes ?? []
    },
    {
      key: "categoryIds",
      label: t("columns.categories"),
      options: facets?.categories ?? []
    },
    {
      key: "availability",
      label: t("columns.availability"),
      options: facets
        ? [
            { value: "inStock", label: t("inStock"), count: facets.availability.inStock },
            {
              value: "outOfStock",
              label: t("outOfStock"),
              count: facets.availability.outOfStock
            },
            {
              value: "unknown",
              label: t("availabilityUnknown"),
              count: facets.availability.unknown
            }
          ]
        : []
    }
  ];
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setMin("");
          setMax("");
          onReset();
        }}
      >
        {t("resetSearch")}
      </Button>
      <Accordion
        type="multiple"
        className="space-y-3 divide-y-0 rounded-none border-none bg-transparent"
      >
        {groups.map(({ key, label, options }) => (
          <Accordion.Item
            key={key}
            value={key}
            className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
          >
            <Accordion.Trigger className="text-xs font-semibold text-m-text">
              {label}
              {filters[key]?.length ? ` (${filters[key]!.length})` : ""}
            </Accordion.Trigger>
            <Accordion.Content className="px-4 pb-4 pt-0">
              <div className="max-h-64 space-y-3 overflow-y-auto">
                {options.length === 0 && (
                  <p className="text-xs text-m-text-muted">
                    {loading ? t("loadingProducts") : t("noFilterOptions")}
                  </p>
                )}
                {options.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-xs text-m-text"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-m-primary"
                      checked={filters[key]?.includes(option.value) ?? false}
                      disabled={loading}
                      onChange={(event) => {
                        const values = filters[key] ?? [];
                        onFiltersChange({
                          ...filters,
                          [key]: event.target.checked
                            ? [...values, option.value]
                            : values.filter((value) => value !== option.value)
                        });
                      }}
                    />
                    <span className="min-w-0 flex-1 break-words">{option.label}</span>
                    <span className="text-m-text-muted">{option.count}</span>
                  </label>
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
        <Accordion.Item
          value="price"
          className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
        >
          <Accordion.Trigger className="text-xs font-semibold text-m-text">
            {t("priceRange")}
            {filters.minPrice != null || filters.maxPrice != null ? " •" : ""}
          </Accordion.Trigger>
          <Accordion.Content className="px-4 pb-4 pt-0">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!invalid)
                  onFiltersChange({
                    ...filters,
                    minPrice: min === "" ? undefined : Number(min),
                    maxPrice: max === "" ? undefined : Number(max)
                  });
              }}
            >
              <p className="text-xs text-m-text-muted">
                {t("priceCurrency", { currency: facets?.price.currency ?? "USD" })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-m-text-muted">
                  {t("minPrice")}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={min}
                    placeholder={facets?.price.min?.toString() ?? "0"}
                    onChange={(event) => setMin(event.target.value)}
                    className="mt-1 w-full rounded-m-md border border-m-border bg-m-surface p-2 text-m-text"
                  />
                </label>
                <label className="text-xs text-m-text-muted">
                  {t("maxPrice")}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={max}
                    placeholder={facets?.price.max?.toString() ?? "—"}
                    onChange={(event) => setMax(event.target.value)}
                    className="mt-1 w-full rounded-m-md border border-m-border bg-m-surface p-2 text-m-text"
                  />
                </label>
              </div>
              {invalid && (
                <p role="alert" className="text-xs text-m-danger">
                  {t("invalidPriceRange")}
                </p>
              )}
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={loading || invalid}
              >
                {t("applyFilters")}
              </Button>
            </form>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
