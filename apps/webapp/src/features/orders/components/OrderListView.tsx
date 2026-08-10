"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  PageHeader,
  Card,
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
} from "@csa/ui";
import { useOrderStore } from "../hooks/use-orders";
import type { Order, OrderState, ShipmentState, PaymentState } from "../types/order-types";

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

  const { orders, duplicateOrder } = useOrderStore();

  const [searchOption, setSearchOption] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [orderStateFilter, setOrderStateFilter] = useState("");
  const [paymentStateFilter, setPaymentStateFilter] = useState("");

  const [sortColumn, setSortColumn] = useState<keyof Order>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  const handleSort = (column: keyof Order) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

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

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const valA = String(a[sortColumn] ?? "");
      const valB = String(b[sortColumn] ?? "");
      const res = valA.localeCompare(valB, undefined, { numeric: true });
      return sortDirection === "asc" ? res : -res;
    });
  }, [filteredOrders, sortColumn, sortDirection]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));

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
            ? `${sortedOrders.length} result${sortedOrders.length === 1 ? "" : "s"} — search, inspect, and copy orders for follow-up work.`
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
              Refresh
            </Button>
          </div>
        }
      />

      {/* Search & Toolbar */}
      <Card variant="default" className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <div className="w-full sm:w-48">
              <Select
                value={searchOption}
                onChange={(e) => setSearchOption(e.target.value)}
                options={B2C_SEARCH_FIELD_OPTIONS}
              />
            </div>
            <div className="flex-1">
              <SearchBar
                value={searchText}
                onChange={(val) => {
                  setSearchText(typeof val === "string" ? val : (val as React.ChangeEvent<HTMLInputElement>).target.value);
                  setCurrentPage(1);
                }}
                onClear={() => {
                  setSearchText("");
                  setCurrentPage(1);
                }}
                placeholder={
                  isB2b
                    ? "Search by email, first or last name, order number, SKU, etc."
                    : "Search by customer email, order number, SKU, store..."
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select
                value={orderStateFilter}
                onChange={(e) => {
                  setOrderStateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={ORDER_STATE_OPTIONS}
              />
            </div>
            <div className="w-40">
              <Select
                value={paymentStateFilter}
                onChange={(e) => {
                  setPaymentStateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={PAYMENT_STATE_OPTIONS}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} className="w-full rounded-md" />
          ))}
        </div>
      ) : sortedOrders.length === 0 ? (
        <Card variant="default" className="p-8">
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
        </Card>
      ) : (
        <Card variant="default" className="overflow-hidden">
          <div className="overflow-x-auto">
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
                        {new Date(o.createdAt).toLocaleString(undefined, {
                          month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {new Date(o.lastModifiedAt).toLocaleString(undefined, {
                          month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit",
                        })}
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
              <TablePagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={sortedOrders.length}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
