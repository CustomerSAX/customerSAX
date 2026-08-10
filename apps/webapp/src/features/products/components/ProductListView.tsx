"use client";

/**
 * ProductListView — Product Directory (100% parity with CT-CSA-Standalone product-list.tsx)
 *
 * Features:
 * - PageHeader with eyebrow, title, description
 * - Selectable search input: 5 field options (All Fields, Name, Description, Product Key, SKU)
 * - Min 4 chars for auto-search, 350ms debounce, Enter fires immediately, empty → browse
 * - Reset button clears search + sort
 * - DataTableManager (gear): show/hide columns, density, text wrapping — localStorage persisted
 * - 12 manageable columns: Name, Type, Key, Status, Created, Modified (visible), SKU, Price, Avail, Desc, ID, Categories (hidden)
 * - Sortable columns (disabled during active search): Name, Key, Created, Modified
 * - Sort indicator ▲/▼, sort resets pagination to page 1
 * - Variant expand/collapse per row with count + sub-table (Variant ID, SKU, Key)
 * - Status badge (Published / Modified)
 * - Row click → /products/[id]
 * - Skeleton loader (6 rows) while loading
 * - Empty state (no results)
 * - TablePagination (resets to page 1 on search/sort)
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  Panel,
  Button,
  Icon,
  Badge,
  Skeleton,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
} from "@csa/ui";
import { useProductList } from "../hooks/use-products";
import { SelectableSearchInput } from "./SelectableSearchInput";
import type {
  ProductListRow,
  ProductSortKey,
  TableSettings,
  ProductColumn,
} from "../types/product-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_KEY = "csa_product_table_settings";

const SEARCH_FIELD_OPTIONS = [
  { value: "allFields", label: "All Fields" },
  { value: "name", label: "Name" },
  { value: "description", label: "Description" },
  { value: "key", label: "Product Key" },
  { value: "variants.sku", label: "SKU" },
];

/** All 12 manageable columns, ordered: default-visible first, then hidden. */
const ALL_COLUMNS: ProductColumn[] = [
  { key: "itemName", label: "Product Name" },
  { key: "productType", label: "Product Type" },
  { key: "key", label: "Product Key" },
  { key: "status", label: "Status" },
  { key: "created", label: "Date Created" },
  { key: "modified", label: "Date Modified" },
  // Hidden by default
  { key: "sku", label: "SKU" },
  { key: "price", label: "Price" },
  { key: "availability", label: "Availability" },
  { key: "description", label: "Description" },
  { key: "id", label: "Product ID" },
  { key: "categories", label: "Categories" },
];

const DEFAULT_VISIBLE_KEYS = new Set([
  "itemName",
  "productType",
  "key",
  "status",
  "created",
  "modified",
]);

const DEFAULT_SETTINGS: TableSettings = {
  visibleColumnKeys: Array.from(DEFAULT_VISIBLE_KEYS),
  isCondensed: false,
  isWrappingText: false,
};

const SORTABLE_COLUMNS = new Set<string>([
  "itemName",
  "key",
  "created",
  "modified",
]);

// ---------------------------------------------------------------------------
// TableSettings persistence
// ---------------------------------------------------------------------------

function loadSettings(): TableSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TableSettings>;
    return {
      visibleColumnKeys:
        Array.isArray(parsed.visibleColumnKeys) &&
        parsed.visibleColumnKeys.length > 0
          ? parsed.visibleColumnKeys
          : DEFAULT_SETTINGS.visibleColumnKeys,
      isCondensed: parsed.isCondensed ?? DEFAULT_SETTINGS.isCondensed,
      isWrappingText: parsed.isWrappingText ?? DEFAULT_SETTINGS.isWrappingText,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: TableSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Best-effort — don't crash if storage is full
  }
}

// ---------------------------------------------------------------------------
// DataTableManager panel
// ---------------------------------------------------------------------------

interface DataTableManagerProps {
  settings: TableSettings;
  onChange: (s: TableSettings) => void;
  onClose: () => void;
}

function DataTableManager({ settings, onChange, onClose }: DataTableManagerProps) {
  const visSet = new Set(settings.visibleColumnKeys);

  const toggleColumn = (key: string) => {
    const next = new Set(visSet);
    if (next.has(key)) {
      if (next.size <= 1) return; // Keep at least one column
      next.delete(key);
    } else {
      next.add(key);
    }
    const updated: TableSettings = {
      ...settings,
      visibleColumnKeys: ALL_COLUMNS.filter((c) => next.has(c.key)).map(
        (c) => c.key
      ),
    };
    onChange(updated);
    saveSettings(updated);
  };

  const setDensity = (condensed: boolean) => {
    const updated: TableSettings = { ...settings, isCondensed: condensed };
    onChange(updated);
    saveSettings(updated);
  };

  const setWrapping = (wrap: boolean) => {
    const updated: TableSettings = { ...settings, isWrappingText: wrap };
    onChange(updated);
    saveSettings(updated);
  };

  return (
    <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-m-border bg-m-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-m-border px-4 py-3">
        <span className="text-sm font-semibold text-m-text">
          Table Settings
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-m-text-muted hover:text-m-text transition-colors"
          aria-label="Close table settings"
        >
          <Icon name="x" size="sm" />
        </button>
      </div>

      {/* Columns */}
      <div className="px-4 py-3 border-b border-m-border">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-m-text-muted">
          Columns
        </p>
        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={visSet.has(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="rounded border-m-border text-m-primary focus:ring-m-primary h-3.5 w-3.5"
              />
              <span className="text-xs text-m-text">{col.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Density */}
      <div className="px-4 py-3 border-b border-m-border">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-m-text-muted">
          Row Density
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDensity(false)}
            className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
              !settings.isCondensed
                ? "bg-m-primary text-white"
                : "bg-m-surface-2 text-m-text hover:bg-m-surface-3"
            }`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => setDensity(true)}
            className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
              settings.isCondensed
                ? "bg-m-primary text-white"
                : "bg-m-surface-2 text-m-text hover:bg-m-surface-3"
            }`}
          >
            Condensed
          </button>
        </div>
      </div>

      {/* Text wrapping */}
      <div className="px-4 py-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.isWrappingText}
            onChange={(e) => setWrapping(e.target.checked)}
            className="rounded border-m-border text-m-primary focus:ring-m-primary h-3.5 w-3.5"
          />
          <span className="text-xs text-m-text">Wrap long text</span>
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant sub-table (expand row)
// ---------------------------------------------------------------------------

interface VariantSubTableProps {
  productId: string;
  variants: ProductListRow["variants"];
  colSpan: number;
}

function VariantSubTable({ productId, variants, colSpan }: VariantSubTableProps) {
  if (variants.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan}>
          <span className="italic text-m-text-muted">No variants found.</span>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <div className="border-t border-m-border bg-m-surface-2/40 px-8 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-m-text-muted">
            Variants
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-semibold uppercase text-m-text-muted">
                <th className="py-1.5 pr-6 text-left">Variant ID</th>
                <th className="py-1.5 pr-6 text-left">SKU</th>
                <th className="py-1.5 text-left">Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m-border/40">
              {variants.map((v) => (
                <tr key={`${productId}-var-${v.id}`}>
                  <td className="py-1.5 pr-6 font-mono text-m-text-muted">
                    {v.id}
                  </td>
                  <td className="py-1.5 pr-6 text-m-text">{v.sku}</td>
                  <td className="py-1.5 text-m-text-muted">{v.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={status === "Published" ? "success" : "warning"}
      size="sm"
    >
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function TableSkeletonRows({
  rowCount,
  colCount,
  condensed,
}: {
  rowCount: number;
  colCount: number;
  condensed: boolean;
}) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, i) => (
        <TableRow key={i}>
          {/* Expand button placeholder */}
          <TableCell className="w-10">
            <Skeleton width={28} height={20} rounded="sm" />
          </TableCell>
          {Array.from({ length: colCount }, (_, j) => (
            <TableCell key={j} className={condensed ? "py-2" : ""}>
              <Skeleton
                width={`${50 + ((i + j) % 4) * 10}%`}
                height={14}
                rounded="sm"
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// ProductListView
// ---------------------------------------------------------------------------

export function ProductListView() {
  const router = useRouter();

  const {
    products,
    totalItems,
    loading,
    error,
    search,
    appliedSearch,
    sort,
    page,
    perPage,
    expanded,
    setSearch,
    onSearch,
    onReset,
    onSort,
    onPageChange,
    toggleExpanded,
  } = useProductList();

  const [settings, setSettings] = useState<TableSettings>(() =>
    loadSettings()
  );
  const [showManager, setShowManager] = useState(false);

  // Sync settings from storage (handles tab-switching)
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const isSearchActive = appliedSearch.text.trim().length > 0;

  // Derive visible columns from settings
  const visibleColumns = useMemo(
    () =>
      ALL_COLUMNS.filter((c) => settings.visibleColumnKeys.includes(c.key)),
    [settings.visibleColumnKeys]
  );

  // Total column count including the expand column
  const totalColCount = visibleColumns.length + 1;

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/products/${id}`);
    },
    [router]
  );

  const handleSortClick = useCallback(
    (columnKey: string) => {
      if (!SORTABLE_COLUMNS.has(columnKey) || isSearchActive) return;
      onSort(columnKey as ProductSortKey);
    },
    [onSort, isSearchActive]
  );

  const cellClass = settings.isCondensed ? "py-2" : "py-3";
  const textClass = settings.isWrappingText
    ? "whitespace-normal"
    : "whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Product Directory"
        subtitle="Browse and search catalog products, manage variants, and inspect pricing data."
        breadcrumbs={
          <span className="text-xs font-medium text-m-text-muted uppercase tracking-widest">
            Catalog Operations
          </span>
        }
      />

      {/* Toolbar */}
      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4">
          <SelectableSearchInput
            fieldValue={search.option}
            searchValue={search.text}
            fieldOptions={SEARCH_FIELD_OPTIONS}
            placeholder={`Search products (min 4 chars)…`}
            onFieldChange={(f) =>
              setSearch({ text: search.text, option: f as typeof search.option })
            }
            onSearchChange={(t) =>
              setSearch({ text: t, option: search.option })
            }
            onSearch={onSearch}
            onReset={onReset}
            showReset={search.text.length > 0 || sort !== null}
          />
          {isSearchActive && (
            <p className="text-xs text-m-text-muted">
              Showing results for &quot;{appliedSearch.text}&quot; in{" "}
              <strong>
                {
                  SEARCH_FIELD_OPTIONS.find(
                    (o) => o.value === appliedSearch.option
                  )?.label
                }
              </strong>
              {sort !== null && (
                <span className="text-m-text-muted/60 ml-1">
                  — sort disabled during search
                </span>
              )}
            </p>
          )}
        </div>
      </Panel>

      {/* Table panel */}
      <Panel
        title={`Products${!loading && totalItems > 0 ? ` (${totalItems})` : ""}`}
        headerActions={
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowManager((v) => !v)}
              aria-label="Table settings"
              title="Manage columns, density, and text wrapping"
            >
              <Icon name="settings-2" size="sm" />
            </Button>
            {showManager && (
              <DataTableManager
                settings={settings}
                onChange={setSettings}
                onClose={() => setShowManager(false)}
              />
            )}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              {/* Expand column header */}
              <TableHead className="w-10 px-3" />

              {visibleColumns.map((col) => {
                const sortable = SORTABLE_COLUMNS.has(col.key) && !isSearchActive;
                const isSorted = sort?.key === col.key;
                return (
                  <TableHead
                    key={col.key}
                    sortable={sortable}
                    sortDirection={
                      isSorted ? sort.order : false
                    }
                    onSort={
                      sortable ? () => handleSortClick(col.key) : undefined
                    }
                    title={
                      isSearchActive && SORTABLE_COLUMNS.has(col.key)
                        ? "Sorting is disabled during search"
                        : undefined
                    }
                    className={
                      isSearchActive && SORTABLE_COLUMNS.has(col.key)
                        ? "opacity-50"
                        : ""
                    }
                  >
                    {col.label}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableSkeletonRows
                rowCount={6}
                colCount={visibleColumns.length}
                condensed={settings.isCondensed}
              />
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={totalColCount}
                  className="py-12 text-center"
                >
                  <span className="text-m-danger text-sm">{error}</span>
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColCount}
                  className="py-12"
                >
                  <EmptyState
                    icon="package"
                    title="No Products Found"
                    description={
                      isSearchActive
                        ? "No products match your search. Try adjusting your query or resetting the search."
                        : "There are no products in the catalog yet."
                    }
                    action={
                      isSearchActive ? (
                        <Button variant="secondary" onClick={onReset}>
                          Reset Search
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const isExpanded = expanded.has(product.id);
                const hasVariants = product.variantCount > 0;

                return (
                  <>
                    <TableRow
                      key={product.id}
                      clickable
                      onClick={() => handleRowClick(product.id)}
                    >
                      {/* Expand button */}
                      <TableCell
                        className={`w-10 px-3 ${cellClass}`}
                        onClick={(e) => {
                          if (hasVariants) {
                            e.stopPropagation();
                            toggleExpanded(product.id);
                          }
                        }}
                      >
                        {hasVariants && (
                          <button
                            type="button"
                            title={`${isExpanded ? "Collapse" : "Expand"} variants (${product.variantCount})`}
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${product.variantCount} variant${product.variantCount !== 1 ? "s" : ""}`}
                            className="flex items-center gap-1 text-m-text-muted hover:text-m-text transition-colors rounded px-1.5 py-0.5 text-[10px] font-medium bg-m-surface-2 hover:bg-m-surface-3"
                          >
                            <Icon
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size="xs"
                            />
                            {product.variantCount}
                          </button>
                        )}
                      </TableCell>

                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={`${cellClass} ${textClass}`}
                        >
                          {col.key === "status" ? (
                            <StatusBadge status={product.status} />
                          ) : (
                            <span>
                              {product[col.key as keyof ProductListRow] as string}
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>

                    {isExpanded && (
                      <VariantSubTable
                        key={`${product.id}-variants`}
                        productId={product.id}
                        variants={product.variants}
                        colSpan={totalColCount}
                      />
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && totalItems > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={perPage}
            onPageChange={onPageChange}
          />
        )}
      </Panel>
    </div>
  );
}
