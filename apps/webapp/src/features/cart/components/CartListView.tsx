"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
} from "@csa/ui";
import { useCartStore } from "../hooks/use-carts";
import type { Cart, CartState } from "../types/cart-types";

const SEARCH_OPTIONS = [
  { value: "all", label: "All fields" },
  { value: "id", label: "Cart ID" },
  { value: "customerEmail", label: "Customer email" },
];

export function CartListView() {
  const router = useRouter();
  const pathname = usePathname();
  const isB2b = pathname?.startsWith("/b2b");

  const { carts } = useCartStore();

  const [searchOption, setSearchOption] = useState("id");
  const [searchText, setSearchText] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState<{ option: string; text: string } | null>(null);

  const [sortColumn, setSortColumn] = useState<keyof Cart>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSubmittedSearch({ option: searchOption, text: searchText.trim().toLowerCase() });
  };

  const handleSearchReset = () => {
    setSearchOption("id");
    setSearchText("");
    setSubmittedSearch(null);
    setCurrentPage(1);
  };

  const filteredCarts = useMemo(() => {
    let result = [...carts];

    if (submittedSearch && submittedSearch.text) {
      const q = submittedSearch.text;
      const opt = submittedSearch.option;

      result = result.filter((cart) => {
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

    result.sort((a, b) => {
      let valA: any = a[sortColumn] ?? "";
      let valB: any = b[sortColumn] ?? "";

      if (sortColumn === "createdAt" || sortColumn === "lastModifiedAt") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [carts, submittedSearch, sortColumn, sortDirection]);

  const totalItems = filteredCarts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedCarts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCarts.slice(start, start + pageSize);
  }, [filteredCarts, currentPage, pageSize]);

  const handleSort = (col: keyof Cart) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  };

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
          {paginatedCarts.length > 0 ? (
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

                  return (
                    <TableRow
                      key={cart.id}
                      clickable
                      onClick={() => {
                        const prefix = isB2b ? "/b2b" : "";
                        router.push(`${prefix}/cart/${cart.id}`);
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
                            {cart.customerName}
                          </Link>
                        ) : (
                          <span className="text-xs text-m-text-muted italic">{cart.customerName}</span>
                        )}
                        <div className="text-[10px] text-m-text-muted">{cart.customerEmail}</div>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-m-text font-mono">
                        ${cart.grandTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs">{lineItemsCount}</TableCell>
                      <TableCell className="text-xs font-semibold">{totalItemsQty}</TableCell>
                      <TableCell>{renderStatusBadge(cart.cartState)}</TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {new Date(cart.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-m-text-muted">
                        {new Date(cart.lastModifiedAt).toLocaleDateString()}
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

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-m-text-muted">
          <span>
            Showing page {currentPage} of {totalPages} ({totalItems} carts total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
