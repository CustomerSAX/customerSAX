"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useCartStore } from "../hooks/use-carts";
import type { Cart, CartState } from "../types/cart-types";
import { formatDate } from "@/lib/format-date";

const SEARCH_OPTIONS = [
  { value: "all", label: "All fields" },
  { value: "id", label: "Cart ID" },
  { value: "customerEmail", label: "Customer email" },
];

function formatCurrency(value: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

export function CartListView() {
  const router = useRouter();

  const { carts, loading, error, reloadCarts } = useCartStore();

  const [searchOption, setSearchOption] = useState("id");
  const [searchText, setSearchText] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState<{ option: string; text: string } | null>(null);

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
        return <Badge variant="primary" size="sm" dot>Active</Badge>;
      case "Merged":
        return <Badge variant="info" size="sm">Merged</Badge>;
      case "Frozen":
        return <Badge variant="warning" size="sm">Frozen</Badge>;
      case "Ordered":
        return <Badge variant="success" size="sm">Ordered</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Carts"
        subtitle="Inspect customer shopping carts, verify items, and support checkout recovery."
        badge={<Badge variant="neutral" appearance="subtle" size="md">{filteredCarts.length} Carts</Badge>}
      />

      {/* Toolbar / Search Bar */}
      <Card variant="default" className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-end gap-3">
          <div className="w-full md:w-48">
            <Select
              value={searchOption}
              onChange={(e) => setSearchOption(e.target.value)}
              options={SEARCH_OPTIONS}
            />
          </div>

          <div className="flex-1 w-full">
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Filter by Cart ID or Customer Email..."
              leftIcon={<Icon name="search" size="xs" />}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="md">
              Search
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={handleSearchReset}>
              Reset
            </Button>
          </div>
        </form>
      </Card>

      {/* Carts Table */}
      <Card variant="default">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shopping Carts ({filteredCarts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center space-y-2">
              <div className="font-bold text-sm text-m-text">Loading carts</div>
              <p className="text-xs text-m-text-muted">Fetching carts from the commerce backend.</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-3">
              <div className="font-bold text-sm text-m-error">Unable to load carts</div>
              <p className="text-xs text-m-text-muted">{error}</p>
              <Button type="button" variant="secondary" size="sm" onClick={reloadCarts}>
                Retry
              </Button>
            </div>
          ) : paginatedCarts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("id")}>
                    Cart ID {sortColumn === "id" && (sortDirection === "asc" ? "▲" : "▼")}
                  </TableHead>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cart Total</TableHead>
                  <TableHead>No. of Items</TableHead>
                  <TableHead>Total Items</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("cartState")}>
                    Cart Status {sortColumn === "cartState" && (sortDirection === "asc" ? "▲" : "▼")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("createdAt")}>
                    Created {sortColumn === "createdAt" && (sortDirection === "asc" ? "▲" : "▼")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("lastModifiedAt")}>
                    Modified {sortColumn === "lastModifiedAt" && (sortDirection === "asc" ? "▲" : "▼")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCarts.map((cart) => {
                  const lineItemsCount = cart.lineItems.length;
                  const totalItemsQty = cart.lineItems.reduce((acc, i) => acc + i.quantity, 0);
                  const customerLabel = cart.customerName || cart.customerId || "Guest / unassigned";

                  return (
                    <TableRow
                      key={cart.id}
                      clickable
                      onClick={() => {
                        router.push(`/cart/${cart.id}`);
                      }}
                    >
                      <TableCell className="font-mono text-xs font-bold text-m-primary">
                        {cart.cartNumber || cart.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-m-text-muted">
                        {cart.orderNumber || "--"}
                      </TableCell>
                      <TableCell>
                        {cart.customerId ? (
                          <Link
                            href={`/customers/${cart.customerId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-xs text-m-primary hover:underline"
                          >
                            {customerLabel}
                          </Link>
                        ) : (
                          <span className="text-xs text-m-text-muted italic">{customerLabel}</span>
                        )}
                        <div className="text-[10px] text-m-text-muted">{cart.customerEmail || "--"}</div>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-m-text font-mono">
                        {formatCurrency(cart.grandTotal, cart.currencyCode)}
                      </TableCell>
                      <TableCell className="text-xs">{lineItemsCount}</TableCell>
                      <TableCell className="text-xs font-semibold">{totalItemsQty}</TableCell>
                      <TableCell>{renderStatusBadge(cart.cartState)}</TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {formatDate(cart.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {formatDate(cart.lastModifiedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center space-y-2">
              <div className="text-2xl">🛒</div>
              <div className="font-bold text-sm text-m-text">No Active Carts</div>
              <p className="text-xs text-m-text-muted">
                {submittedSearch
                  ? "No shopping carts match your active search query."
                  : "There are currently no active carts in the system."}
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
      />
    </div>
  );
}
