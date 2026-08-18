"use client";

import { useState, useMemo, useCallback } from "react";
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
import { SectionCard } from "@/components/detail";
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

export function OrderListView() {
  const router = useRouter();
  const pathname = usePathname();
  const isB2b = pathname?.startsWith("/b2b");

  const { orders, duplicateOrder, loading, error, refetch } = useOrderStore();

  const [searchOption, setSearchOption] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [orderStateFilter, setOrderStateFilter] = useState("");
  const [paymentStateFilter, setPaymentStateFilter] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);

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
                  <TableHead onClick={() => handleSort("orderNumber")} className="cursor-pointer">
                    Order Number {sortColumn === "orderNumber" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  {!isB2b && (
                    <TableHead onClick={() => handleSort("customerName")} className="cursor-pointer">
                      Customer {sortColumn === "customerName" && (sortDirection === "asc" ? "↑" : "↓")}
                    </TableHead>
                  )}
                  <TableHead onClick={() => handleSort("customerEmail")} className="cursor-pointer">
                    {isB2b ? "Email (order)" : "Customer Email"} {sortColumn === "customerEmail" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("grandTotal")} className="cursor-pointer">
                    {isB2b ? "Order final total (gross)" : "Order Total"} {sortColumn === "grandTotal" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>{isB2b ? "Line items" : "No. of order Items"}</TableHead>
                  <TableHead>{isB2b ? "Total quantity" : "Total Items"}</TableHead>
                  <TableHead onClick={() => handleSort("orderState")} className="cursor-pointer">
                    Order Status {sortColumn === "orderState" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Shipment Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead onClick={() => handleSort("createdAt")} className="cursor-pointer">
                    {isB2b ? "Date created" : "Created"} {sortColumn === "createdAt" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead onClick={() => handleSort("lastModifiedAt")} className="cursor-pointer">
                    {isB2b ? "Date modified" : "Modified"} {sortColumn === "lastModifiedAt" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="text-right">{isB2b ? "Copy order" : "Duplicate"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((o) => {
                  const totalItemQty = o.lineItems.reduce((acc, item) => acc + item.quantity, 0);
                  return (
                    <TableRow key={o.id} clickable onClick={() => router.push(`/orders/${o.id}`)}>
                      <TableCell className="font-mono text-xs font-bold text-m-primary">
                        <Link href={`/orders/${o.id}`} className="hover:underline">
                          {o.orderNumber}
                        </Link>
                      </TableCell>
                      {!isB2b && (
                        <TableCell className="font-medium text-m-primary">
                          {o.customerId ? (
                            <Link
                              href={`/customers/${o.customerId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline text-m-primary"
                            >
                              {o.customerName}
                            </Link>
                          ) : (
                            o.customerName
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-m-text-muted text-xs">{o.customerEmail}</TableCell>
                      <TableCell className="font-bold text-m-text">${o.grandTotal.toFixed(2)}</TableCell>
                      <TableCell>{o.lineItems.length}</TableCell>
                      <TableCell>{totalItemQty}</TableCell>
                      <TableCell>{renderOrderStateBadge(o.orderState)}</TableCell>
                      <TableCell>{renderShipmentBadge(o.shipmentState)}</TableCell>
                      <TableCell>{renderPaymentBadge(o.paymentState)}</TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {formatDateTime(o.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {formatDateTime(o.lastModifiedAt)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={isB2b ? "Copy order" : "Duplicate order"}
                          leftIcon={<Icon name="copy" size="xs" />}
                          onClick={(e) => handleDuplicateOrder(e, o)}
                        >
                          {isB2b ? "Copy" : "Duplicate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
