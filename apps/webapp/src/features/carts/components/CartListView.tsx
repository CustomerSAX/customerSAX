"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader, SearchBar, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from "@csa/ui";
import { formatCartMoney, useCartStore } from "../hooks/use-carts";

export function CartListView() {
  const { carts, loading, error, refetch } = useCartStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? carts.filter((cart) => [cart.id, cart.key, cart.customerName].some((value) => value?.toLowerCase().includes(query))) : carts;
  }, [carts, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <div className="space-y-6">
    <PageHeader title="Carts" subtitle="Live carts from commercetools, including ownership, line items, totals, and versions." badge={<Badge variant="primary">Cart Operations</Badge>} actions={<Button variant="secondary" onClick={() => void refetch()}>Refresh</Button>} />
    <Card className="p-4"><SearchBar value={search} onChange={(value) => { setSearch(typeof value === "string" ? value : (value as ChangeEvent<HTMLInputElement>).target.value); setPage(1); }} onClear={() => { setSearch(""); setPage(1); }} placeholder="Search by cart ID, key, or customer name..." /></Card>
    {loading && carts.length === 0 ? <div className="space-y-2">{Array.from({length:5}).map((_, index) => <Skeleton key={index} height={40} />)}</div> : error ? <Card className="p-8"><EmptyState title="Unable to load carts" description={error.message} action={<Button onClick={() => void refetch()}>Retry</Button>} /></Card> : rows.length === 0 ? <Card className="p-8"><EmptyState title="No Carts Found" description="No carts match the current search." /></Card> : <Card className="overflow-hidden"><Table>
      <TableHeader><TableRow>{["Cart ID","Key","Customer Name","Items","Total","Currency","Version"].map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((cart) => <TableRow key={cart.id}>
        <TableCell className="font-mono text-xs font-bold text-m-primary"><Link href={`/cart/${cart.id}`}>{cart.id}</Link></TableCell>
        <TableCell>{cart.key || "--"}</TableCell><TableCell>{cart.customerName || "Guest / Unassigned"}</TableCell><TableCell>{cart.lineItems.reduce((sum, item) => sum + item.quantity, 0)}</TableCell><TableCell className="font-semibold">{formatCartMoney(cart.totalPrice)}</TableCell><TableCell>{cart.currencyCode}</TableCell><TableCell>{cart.version}</TableCell>
      </TableRow>)}</TableBody>
      <TablePagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />
    </Table></Card>}
  </div>;
}
