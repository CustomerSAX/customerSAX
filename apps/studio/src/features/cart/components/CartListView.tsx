"use client";

import { Fragment, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Icon,
  Input,
  Select,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  useDataTable,
} from "@csa/ui";
import { ColumnManager, type ManagedColumn } from "@/components/table/ColumnManager";
import { useCartStore } from "../hooks/use-carts";
import type { Cart, CartState } from "../types/cart-types";
import { formatDate } from "@/lib/format-date";
import { useTablePaginationLabels } from "@/lib/use-table-pagination-labels";

function formatCurrency(value: number, currencyCode = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

type CartColumnKey =
  | "id"
  | "orderNumber"
  | "customer"
  | "customerEmail"
  | "companyName"
  | "store"
  | "country"
  | "grandTotal"
  | "lineItemCount"
  | "totalQuantity"
  | "cartState"
  | "createdAt"
  | "lastModifiedAt";

const CART_COLUMN_STORAGE_KEY = "csa_cart_columns";

const CART_COLUMNS: ManagedColumn<CartColumnKey>[] = [
  { key: "id", label: "Cart ID", pinned: true },
  { key: "orderNumber", label: "Order Number" },
  { key: "customer", label: "Customer" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "companyName", label: "Company" },
  { key: "store", label: "Store" },
  { key: "country", label: "Country" },
  { key: "grandTotal", label: "Cart Total" },
  { key: "lineItemCount", label: "No. of Items" },
  { key: "totalQuantity", label: "Total Items" },
  { key: "cartState", label: "Cart Status" },
  { key: "createdAt", label: "Created" },
  { key: "lastModifiedAt", label: "Modified" },
];

const DEFAULT_CART_COLUMN_KEYS: CartColumnKey[] = [
  "id",
  "orderNumber",
  "customer",
  "grandTotal",
  "lineItemCount",
  "totalQuantity",
  "cartState",
  "createdAt",
  "lastModifiedAt",
];

const SORTABLE_CART_COLUMN_KEYS = new Set<CartColumnKey>([
  "id",
  "orderNumber",
  "customer",
  "customerEmail",
  "companyName",
  "store",
  "country",
  "grandTotal",
  "cartState",
  "createdAt",
  "lastModifiedAt",
]);

function readStoredColumnKeys<TKey extends string>(
  storageKey: string,
  columns: ManagedColumn<TKey>[],
  defaultKeys: TKey[]
) {
  if (typeof window === "undefined") return defaultKeys;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultKeys;

  try {
    const parsed = JSON.parse(raw) as TKey[];
    const allowed = new Set(columns.map((column) => column.key));
    const filtered = parsed.filter((key) => allowed.has(key));
    return filtered.length > 0 ? filtered : defaultKeys;
  } catch {
    return defaultKeys;
  }
}

export function CartListView() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Carts");
  const common = useTranslations("Common");
  const paginationLabels = useTablePaginationLabels();
  const searchOptions = [
    { value: "all", label: common("allFields") },
    { value: "id", label: t("cartId") },
    { value: "customerEmail", label: t("customerEmail") },
  ];
  const localizedCartColumns = CART_COLUMNS.map((column) => ({ ...column, label: t(`columns.${column.key}`) }));

  const { carts, loading, error, reloadCarts } = useCartStore();

  const [searchOption, setSearchOption] = useState("id");
  const [searchText, setSearchText] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState<{ option: string; text: string } | null>(null);
  const [visibleCartColumnKeys, setVisibleCartColumnKeys] = useState<CartColumnKey[]>(() =>
    readStoredColumnKeys(CART_COLUMN_STORAGE_KEY, CART_COLUMNS, DEFAULT_CART_COLUMN_KEYS)
  );

  const visibleCartColumns = useMemo(() => {
    const visibleSet = new Set(visibleCartColumnKeys);
    return CART_COLUMNS.filter((column) => visibleSet.has(column.key));
  }, [visibleCartColumnKeys]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetPage();
    setSubmittedSearch({ option: searchOption, text: searchText.trim().toLowerCase() });
  };

  const handleSearchReset = () => {
    setSearchOption("id");
    setSearchText("");
    setSubmittedSearch(null);
    resetPage();
  };

  const filteredCarts = useMemo(() => {
    if (submittedSearch && submittedSearch.text) {
      const q = submittedSearch.text;
      const opt = submittedSearch.option;

      return carts.filter((cart) => {
        if (opt === "id") {
          return (
            cart.id.toLowerCase().includes(q) ||
            (cart.cartNumber && cart.cartNumber.toLowerCase().includes(q))
          );
        }
        if (opt === "customerEmail") {
          return cart.customerEmail.toLowerCase().includes(q);
        }
        // "all"
        return (
          cart.id.toLowerCase().includes(q) ||
          (cart.cartNumber && cart.cartNumber.toLowerCase().includes(q)) ||
          cart.customerName.toLowerCase().includes(q) ||
          cart.customerEmail.toLowerCase().includes(q) ||
          (cart.companyName && cart.companyName.toLowerCase().includes(q))
        );
      });
    }

    return carts;
  }, [carts, submittedSearch]);

  const {
    page: currentPage,
    pageSize,
    paginatedRows: paginatedCarts,
    resetPage,
    setPage: setCurrentPage,
    sortDirection,
    sortKey: sortColumn,
    totalItems,
    totalPages,
    onSort: handleSort,
  } = useDataTable<Cart, keyof Cart>({
    rows: filteredCarts,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
    newSortDirection: "desc",
    pageSize: 20,
    getSortValue: (cart, key) => {
      const value = cart[key];
      if (key === "createdAt" || key === "lastModifiedAt") return value ? new Date(String(value)).getTime() : 0;
      return value;
    },
  });

  const renderStatusBadge = (state: CartState) => {
    switch (state) {
      case "Active":
        return <Badge variant="primary" size="sm" dot>{t("state.Active")}</Badge>;
      case "Merged":
        return <Badge variant="info" size="sm">{t("state.Merged")}</Badge>;
      case "Frozen":
        return <Badge variant="warning" size="sm">{t("state.Frozen")}</Badge>;
      case "Ordered":
        return <Badge variant="success" size="sm">{t("state.Ordered")}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{state}</Badge>;
    }
  };

  const handleCartColumnsChange = useCallback((keys: CartColumnKey[]) => {
    const nextKeys = keys.length > 0 ? keys : DEFAULT_CART_COLUMN_KEYS;
    setVisibleCartColumnKeys(nextKeys);
    window.localStorage.setItem(CART_COLUMN_STORAGE_KEY, JSON.stringify(nextKeys));
  }, []);

  const renderSortIndicator = (key: CartColumnKey) => {
    if (sortColumn !== key) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const renderCartCell = (cart: Cart, key: CartColumnKey) => {
    const lineItemsCount = cart.lineItems.length;
    const totalItemsQty = cart.lineItems.reduce((acc, i) => acc + i.quantity, 0);
    const customerLabel = cart.customerName || cart.customerId || t("guest");

    if (key === "id") {
      return (
        <TableCell className="font-mono text-xs font-bold text-m-primary">
          {cart.cartNumber || cart.id}
        </TableCell>
      );
    }

    if (key === "orderNumber") {
      return (
        <TableCell className="font-mono text-xs text-m-text-muted">
          {cart.orderNumber || "--"}
        </TableCell>
      );
    }

    if (key === "customer") {
      return (
        <TableCell>
          <span className="font-semibold text-xs text-m-text">{customerLabel}</span>
          <div className="text-[10px] text-m-text-muted">{cart.customerEmail || "--"}</div>
        </TableCell>
      );
    }

    if (key === "customerEmail") {
      return <TableCell className="text-xs text-m-text-muted">{cart.customerEmail || "--"}</TableCell>;
    }

    if (key === "companyName") {
      return <TableCell className="text-xs text-m-text">{cart.companyName ?? "--"}</TableCell>;
    }

    if (key === "store") {
      return <TableCell className="text-xs text-m-text">{cart.store || "--"}</TableCell>;
    }

    if (key === "country") {
      return <TableCell className="text-xs text-m-text">{cart.country ?? "--"}</TableCell>;
    }

    if (key === "grandTotal") {
      return (
        <TableCell className="font-bold text-xs text-m-text font-mono">
          {formatCurrency(cart.grandTotal, cart.currencyCode, locale)}
        </TableCell>
      );
    }

    if (key === "lineItemCount") {
      return <TableCell className="text-xs">{lineItemsCount}</TableCell>;
    }

    if (key === "totalQuantity") {
      return <TableCell className="text-xs font-semibold">{totalItemsQty}</TableCell>;
    }

    if (key === "cartState") {
      return <TableCell>{renderStatusBadge(cart.cartState)}</TableCell>;
    }

    if (key === "createdAt") {
      return <TableCell className="text-xs text-m-text-muted">{formatDate(cart.createdAt, locale)}</TableCell>;
    }

    return (
      <TableCell className="text-xs text-m-text-muted">
        {formatDate(cart.lastModifiedAt, locale)}
      </TableCell>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        badge={<Badge variant="neutral" appearance="subtle" size="md">{t("countBadge", { count: filteredCarts.length })}</Badge>}
      />

      {/* Toolbar / Search Bar */}
      <Card variant="default" className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-end gap-3">
          <div className="w-full md:w-48">
            <Select
              value={searchOption}
              onChange={(e) => setSearchOption(e.target.value)}
              options={searchOptions}
            />
          </div>

          <div className="flex-1 w-full">
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t("searchPlaceholder")}
              leftIcon={<Icon name="search" size="xs" />}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="md">
              {common("search")}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={handleSearchReset}>
              {common("reset")}
            </Button>
          </div>
        </form>
      </Card>

      {/* Carts Table */}
      <Card variant="default">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("countTitle", { count: filteredCarts.length })}</CardTitle>
          <ColumnManager
            columns={localizedCartColumns}
            defaultVisibleKeys={DEFAULT_CART_COLUMN_KEYS}
            title={t("columnsTitle")}
            visibleKeys={visibleCartColumnKeys}
            onChange={handleCartColumnsChange}
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center space-y-2">
              <div className="font-bold text-sm text-m-text">{t("loading")}</div>
              <p className="text-xs text-m-text-muted">{t("loadingDescription")}</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-3">
              <div className="font-bold text-sm text-m-error">{t("loadError")}</div>
              <p className="text-xs text-m-text-muted">{error}</p>
              <Button type="button" variant="secondary" size="sm" onClick={reloadCarts}>
                {common("retry")}
              </Button>
            </div>
          ) : paginatedCarts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleCartColumns.map((column) => {
                    const isSortable = SORTABLE_CART_COLUMN_KEYS.has(column.key);
                    const sortKey = column.key === "customer" ? "customerName" : column.key;
                    return (
                      <TableHead
                        key={column.key}
                        className={isSortable ? "cursor-pointer select-none" : undefined}
                        onClick={isSortable ? () => handleSort(sortKey as keyof Cart) : undefined}
                      >
                        {t(`columns.${column.key}`)}
                        {isSortable ? renderSortIndicator(sortKey as CartColumnKey) : null}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCarts.map((cart) => (
                  <TableRow
                    key={cart.id}
                    clickable
                    onClick={() => {
                      router.push(`/cart/${cart.id}`);
                    }}
                  >
                    {visibleCartColumns.map((column) => (
                      <Fragment key={column.key}>{renderCartCell(cart, column.key)}</Fragment>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center space-y-2">
              <div className="text-2xl">🛒</div>
              <div className="font-bold text-sm text-m-text">{t("emptyTitle")}</div>
              <p className="text-xs text-m-text-muted">
                {submittedSearch
                  ? t("emptySearch")
                  : t("emptyDefault")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <TablePagination
        page={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        labels={paginationLabels}
      />
    </div>
  );
}
