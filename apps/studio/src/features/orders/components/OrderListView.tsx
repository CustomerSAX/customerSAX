"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  PageHeader,
  Button,
  Icon,
  SearchBar,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  Badge,
  Skeleton,
  EmptyState,
  Panel,
  useDataTable,
} from "@csa/ui";
import { SectionCard } from "@csa/ui";
import { ColumnManager, type ManagedColumn } from "@/components/table/ColumnManager";
import { useOrderStore } from "../hooks/use-orders";
import type { Order, OrderState, ShipmentState, PaymentState } from "../types/order-types";
import { formatDateTime } from "@/lib/format-date";

const B2C_SEARCH_FIELD_OPTIONS = [
  { value: "all", label: "All fields" },
  { value: "customerEmail", label: "Customer Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "orderNumber", label: "Order Number" },
  { value: "sku", label: "SKU" },
  { value: "store", label: "Store" },
  { value: "orderState", label: "Order Status" },
];

const ORDER_STATE_OPTIONS = [
  { value: "", label: "All Order Statuses" },
  { value: "Open", label: "Open" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Complete", label: "Complete" },
  { value: "Cancelled", label: "Cancelled" },
];

const PAYMENT_STATE_OPTIONS = [
  { value: "", label: "All Payment Statuses" },
  { value: "Paid", label: "Paid" },
  { value: "Pending", label: "Pending" },
  { value: "BalanceDue", label: "Balance Due" },
  { value: "Failed", label: "Failed" },
  { value: "CreditOwed", label: "Credit Owed" },
];

type OrderColumnKey =
  | "orderNumber"
  | "customer"
  | "customerEmail"
  | "companyName"
  | "store"
  | "grandTotal"
  | "lineItemCount"
  | "totalQuantity"
  | "orderState"
  | "shipmentState"
  | "paymentState"
  | "createdAt"
  | "lastModifiedAt"
  | "duplicate";

const ORDER_COLUMNS: ManagedColumn<OrderColumnKey>[] = [
  { key: "orderNumber", label: "Order Number", pinned: true },
  { key: "customer", label: "Customer" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "companyName", label: "Company" },
  { key: "store", label: "Store" },
  { key: "grandTotal", label: "Order Total" },
  { key: "lineItemCount", label: "No. of Order Items" },
  { key: "totalQuantity", label: "Total Items" },
  { key: "orderState", label: "Order Status" },
  { key: "shipmentState", label: "Shipment Status" },
  { key: "paymentState", label: "Payment Status" },
  { key: "createdAt", label: "Created" },
  { key: "lastModifiedAt", label: "Modified" },
  { key: "duplicate", label: "Duplicate" },
];

const DEFAULT_B2C_ORDER_COLUMN_KEYS: OrderColumnKey[] = [
  "orderNumber",
  "customer",
  "customerEmail",
  "grandTotal",
  "lineItemCount",
  "totalQuantity",
  "orderState",
  "shipmentState",
  "paymentState",
  "createdAt",
  "lastModifiedAt",
  "duplicate",
];

const DEFAULT_B2B_ORDER_COLUMN_KEYS: OrderColumnKey[] = [
  "orderNumber",
  "customerEmail",
  "grandTotal",
  "lineItemCount",
  "totalQuantity",
  "orderState",
  "shipmentState",
  "paymentState",
  "createdAt",
  "lastModifiedAt",
  "duplicate",
];

const SORTABLE_ORDER_COLUMN_KEYS = new Set<OrderColumnKey>([
  "orderNumber",
  "customer",
  "customerEmail",
  "companyName",
  "store",
  "grandTotal",
  "orderState",
  "shipmentState",
  "paymentState",
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

export function OrderListView() {
  const router = useRouter();
  const pathname = usePathname();
  const isB2b = pathname?.startsWith("/b2b");
  const orderColumnStorageKey = isB2b ? "csa_b2b_order_columns" : "csa_order_columns";
  const defaultOrderColumnKeys = isB2b
    ? DEFAULT_B2B_ORDER_COLUMN_KEYS
    : DEFAULT_B2C_ORDER_COLUMN_KEYS;

  const { orders, duplicateOrder, loading, error, refetch } = useOrderStore();

  const [searchOption, setSearchOption] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [orderStateFilter, setOrderStateFilter] = useState("");
  const [paymentStateFilter, setPaymentStateFilter] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleOrderColumnKeys, setVisibleOrderColumnKeys] = useState<OrderColumnKey[]>(() =>
    readStoredColumnKeys(orderColumnStorageKey, ORDER_COLUMNS, defaultOrderColumnKeys)
  );

  const visibleOrderColumns = useMemo(() => {
    const visibleSet = new Set(visibleOrderColumnKeys);
    return ORDER_COLUMNS.filter((column) => visibleSet.has(column.key));
  }, [visibleOrderColumnKeys]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleDuplicateOrder = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const newCartId = duplicateOrder(order.id);
    router.push(`/cart/${newCartId}`);
  };

  const handleOrderColumnsChange = useCallback(
    (keys: OrderColumnKey[]) => {
      const nextKeys = keys.length > 0 ? keys : defaultOrderColumnKeys;
      setVisibleOrderColumnKeys(nextKeys);
      window.localStorage.setItem(orderColumnStorageKey, JSON.stringify(nextKeys));
    },
    [defaultOrderColumnKeys, orderColumnStorageKey]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Order State Filter
      if (orderStateFilter && o.orderState !== orderStateFilter) {
        return false;
      }

      // 2. Payment State Filter
      if (paymentStateFilter && o.paymentState !== paymentStateFilter) {
        return false;
      }

      // 3. Search Text Filter
      if (searchText.trim()) {
        const query = searchText.toLowerCase().trim();
        const [firstName, ...restName] = o.customerName.toLowerCase().split(" ");
        const lastName = restName.join(" ");

        if (searchOption === "orderNumber") {
          if (!o.orderNumber.toLowerCase().includes(query)) return false;
        } else if (searchOption === "customerEmail") {
          if (!o.customerEmail.toLowerCase().includes(query)) return false;
        } else if (searchOption === "firstName") {
          if (!firstName.includes(query)) return false;
        } else if (searchOption === "lastName") {
          if (!lastName.includes(query)) return false;
        } else if (searchOption === "sku") {
          const hasSku = o.lineItems.some((item) => item.sku.toLowerCase().includes(query));
          if (!hasSku) return false;
        } else if (searchOption === "store") {
          if (!o.store.toLowerCase().includes(query)) return false;
        } else if (searchOption === "orderState") {
          if (!o.orderState.toLowerCase().includes(query)) return false;
        } else {
          // all
          const match =
            o.orderNumber.toLowerCase().includes(query) ||
            o.customerName.toLowerCase().includes(query) ||
            o.customerEmail.toLowerCase().includes(query) ||
            o.store.toLowerCase().includes(query) ||
            o.orderState.toLowerCase().includes(query) ||
            o.shipmentState.toLowerCase().includes(query) ||
            o.paymentState.toLowerCase().includes(query) ||
            o.lineItems.some((item) => item.sku.toLowerCase().includes(query) || item.name.toLowerCase().includes(query));
          if (!match) return false;
        }
      }

      return true;
    });
  }, [orders, orderStateFilter, paymentStateFilter, searchText, searchOption]);

  const {
    page: currentPage,
    paginatedRows: paginatedOrders,
    resetPage,
    setPage: setCurrentPage,
    sortDirection,
    sortKey: sortColumn,
    totalItems,
    totalPages,
    onSort: handleSort,
  } = useDataTable<Order, keyof Order>({
    rows: filteredOrders,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
    pageSize: 20,
  });
  const isLoading = loading || isRefreshing;

  const renderOrderStateBadge = (state: OrderState) => {
    switch (state) {
      case "Open":
        return <Badge variant="primary" size="sm" dot>Open</Badge>;
      case "Confirmed":
        return <Badge variant="warning" size="sm">Confirmed</Badge>;
      case "Complete":
        return <Badge variant="success" size="sm">Complete</Badge>;
      case "Cancelled":
        return <Badge variant="error" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{state}</Badge>;
    }
  };

  const renderShipmentBadge = (state: ShipmentState) => {
    switch (state) {
      case "Shipped":
        return <Badge variant="success" size="sm">Shipped</Badge>;
      case "Ready":
        return <Badge variant="info" size="sm">Ready</Badge>;
      case "Pending":
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case "Delayed":
      case "Backorder":
        return <Badge variant="error" size="sm">{state}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{state}</Badge>;
    }
  };

  const renderPaymentBadge = (state: PaymentState) => {
    switch (state) {
      case "Paid":
        return <Badge variant="success" size="sm">Paid</Badge>;
      case "Pending":
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case "BalanceDue":
        return <Badge variant="error" size="sm">Balance Due</Badge>;
      case "Failed":
        return <Badge variant="error" size="sm">Failed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{state}</Badge>;
    }
  };

  const getOrderColumnLabel = (key: OrderColumnKey) => {
    if (isB2b) {
      if (key === "customerEmail") return "Email (order)";
      if (key === "grandTotal") return "Order final total (gross)";
      if (key === "lineItemCount") return "Line items";
      if (key === "totalQuantity") return "Total quantity";
      if (key === "createdAt") return "Date created";
      if (key === "lastModifiedAt") return "Date modified";
      if (key === "duplicate") return "Copy order";
    }

    return ORDER_COLUMNS.find((column) => column.key === key)?.label ?? key;
  };

  const renderSortIndicator = (key: OrderColumnKey) => {
    if (sortColumn !== key) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const renderOrderCell = (order: Order, key: OrderColumnKey) => {
    const totalItemQty = order.lineItems.reduce((acc, item) => acc + item.quantity, 0);

    if (key === "orderNumber") {
      return (
        <TableCell className="font-mono text-xs font-bold text-m-primary">
          <Link href={`/orders/${order.id}`} className="hover:underline">
            {order.orderNumber}
          </Link>
        </TableCell>
      );
    }

    if (key === "customer") {
      return (
        <TableCell className="font-medium text-m-primary">
          {order.customerId ? (
            <Link
              href={`/customers/${order.customerId}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline text-m-primary"
            >
              {order.customerName}
            </Link>
          ) : (
            order.customerName
          )}
        </TableCell>
      );
    }

    if (key === "customerEmail") {
      return <TableCell className="text-m-text-muted text-xs">{order.customerEmail}</TableCell>;
    }

    if (key === "companyName") {
      return <TableCell className="text-m-text">{order.companyName ?? "--"}</TableCell>;
    }

    if (key === "store") {
      return <TableCell className="text-m-text">{order.store || "--"}</TableCell>;
    }

    if (key === "grandTotal") {
      return <TableCell className="font-bold text-m-text">${order.grandTotal.toFixed(2)}</TableCell>;
    }

    if (key === "lineItemCount") {
      return <TableCell>{order.lineItems.length}</TableCell>;
    }

    if (key === "totalQuantity") {
      return <TableCell>{totalItemQty}</TableCell>;
    }

    if (key === "orderState") {
      return <TableCell>{renderOrderStateBadge(order.orderState)}</TableCell>;
    }

    if (key === "shipmentState") {
      return <TableCell>{renderShipmentBadge(order.shipmentState)}</TableCell>;
    }

    if (key === "paymentState") {
      return <TableCell>{renderPaymentBadge(order.paymentState)}</TableCell>;
    }

    if (key === "createdAt") {
      return <TableCell className="text-xs text-m-text-muted">{formatDateTime(order.createdAt)}</TableCell>;
    }

    if (key === "lastModifiedAt") {
      return (
        <TableCell className="text-xs text-m-text-muted">
          {formatDateTime(order.lastModifiedAt)}
        </TableCell>
      );
    }

    return (
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          title={isB2b ? "Copy order" : "Duplicate order"}
          leftIcon={<Icon name="copy" size="xs" />}
          onClick={(e) => handleDuplicateOrder(e, order)}
        >
          {isB2b ? "Copy" : "Duplicate"}
        </Button>
      </TableCell>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={isB2b ? "B2B Orders Commerce" : "Orders Operations"}
        subtitle={
          isB2b
            ? `${totalItems} result${totalItems === 1 ? "" : "s"} — search, inspect, and copy orders for follow-up work.`
            : "Find orders, inspect fulfillment state, and duplicate carts for follow-up work."
        }
        badge={<Badge variant="primary">{isB2b ? "B2B Commerce" : "Order Operations"}</Badge>}
        actions={
          <div className="flex items-center gap-2">
            {isB2b && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push("/b2b/import-export?resource=cart")}
              >
                Import / Export
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Icon name="refresh-cw" size="xs" />}
              onClick={handleRefresh}
            >
              {isLoading ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        }
      />

      {/* Search & Toolbar — flat, no card */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-48">
          <Select
            value={searchOption}
            onChange={(e) => {
              setSearchOption(e.target.value);
              resetPage();
            }}
            options={B2C_SEARCH_FIELD_OPTIONS}
          />
        </div>
        <div className="min-w-[240px] flex-1">
          <SearchBar
            value={searchText}
            onChange={(val) => {
              setSearchText(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value);
              resetPage();
            }}
            onClear={() => {
              setSearchText("");
              resetPage();
            }}
            placeholder={
              isB2b
                ? "Search by email, first or last name, order number, SKU, etc."
                : "Search by customer email, order number, SKU, store..."
            }
          />
        </div>
        <div className="w-40">
          <Select
            value={orderStateFilter}
            onChange={(e) => {
              setOrderStateFilter(e.target.value);
              resetPage();
            }}
            options={ORDER_STATE_OPTIONS}
          />
        </div>
        <div className="w-40">
          <Select
            value={paymentStateFilter}
            onChange={(e) => {
              setPaymentStateFilter(e.target.value);
              resetPage();
            }}
            options={PAYMENT_STATE_OPTIONS}
          />
        </div>
      </div>

      {error && (
        <Panel className="p-4 rounded-lg border border-m-danger/30 bg-m-danger-surface text-sm text-m-danger">
          Unable to load orders from the BFF. Check that the BFF is running and federated with the commerce service.
        </Panel>
      )}

      {/* Orders — one quiet container */}
      <SectionCard
        title={`Orders${!isLoading ? ` (${totalItems})` : ""}`}
        action={
          <ColumnManager
            columns={ORDER_COLUMNS}
            defaultVisibleKeys={defaultOrderColumnKeys}
            title="Order columns"
            visibleKeys={visibleOrderColumnKeys}
            onChange={handleOrderColumnsChange}
          />
        }
        bodyClassName="p-0"
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={40} className="w-full rounded-md" />
            ))}
          </div>
        ) : totalItems === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Orders Found"
              description="No orders match your active search query or filter parameters."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSearchText("");
                    setOrderStateFilter("");
                    setPaymentStateFilter("");
                  }}
                >
                  Reset Search Filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleOrderColumns.map((column) => {
                    const isSortable = SORTABLE_ORDER_COLUMN_KEYS.has(column.key);
                    const sortKey = column.key === "customer" ? "customerName" : column.key;
                    return (
                      <TableHead
                        key={column.key}
                        onClick={isSortable ? () => handleSort(sortKey as keyof Order) : undefined}
                        className={
                          isSortable
                            ? column.key === "duplicate"
                              ? "cursor-pointer text-right"
                              : "cursor-pointer"
                            : column.key === "duplicate"
                              ? "text-right"
                              : undefined
                        }
                      >
                        {getOrderColumnLabel(column.key)}
                        {isSortable ? renderSortIndicator(sortKey as OrderColumnKey) : null}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((o) => (
                  <TableRow key={o.id} clickable onClick={() => router.push(`/orders/${o.id}`)}>
                    {visibleOrderColumns.map((column) => (
                      <Fragment key={column.key}>{renderOrderCell(o, column.key)}</Fragment>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-m-border/60 px-4 py-3">
              <TablePagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
