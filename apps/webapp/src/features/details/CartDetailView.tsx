"use client";

import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@csa/ui";
import { formatCartMoney, useCartStore } from "../carts/hooks/use-carts";

export function CartDetailView({ id }: { id: string }) {
  const { carts, loading, error } = useCartStore();
  const cart = carts.find((item) => item.id === id || item.key === id);
  if (loading && !cart) return <Skeleton height={240} />;
  if (error) return <Card className="p-8"><EmptyState title="Unable to load cart" description={error.message} /></Card>;
  if (!cart) return <Card className="p-8"><EmptyState title="Cart not found" description="The requested cart is not present in the current commercetools project." /></Card>;

  const quantity = cart.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="space-y-6">
    <Link href="/cart" className="text-xs font-semibold text-m-primary">← Back to Carts</Link>
    <PageHeader title={`Cart ${cart.key || cart.id}`} subtitle={`Customer ${cart.customerName || "Guest / Unassigned"} • Version ${cart.version}`} badge={<Badge variant="success">Live commercetools data</Badge>} />
    <Card><CardHeader><CardTitle>Cart Items ({quantity})</CardTitle></CardHeader><CardContent className="p-0"><Table>
      <TableHeader><TableRow>{["Product","SKU","Product ID","Quantity","Line Total"].map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{cart.lineItems.map((item) => <TableRow key={item.id}><TableCell className="font-semibold">{item.name}</TableCell><TableCell className="font-mono text-xs">{item.sku || "--"}</TableCell><TableCell className="font-mono text-xs">{item.productId || "--"}</TableCell><TableCell>{item.quantity}</TableCell><TableCell className="font-semibold">{formatCartMoney(item.totalPrice)}</TableCell></TableRow>)}</TableBody>
    </Table></CardContent></Card>
    <Card><CardHeader><CardTitle>Cart Summary</CardTitle></CardHeader><CardContent><div className="flex justify-between text-sm"><span>Total</span><strong>{formatCartMoney(cart.totalPrice)}</strong></div><div className="mt-2 flex justify-between text-xs text-m-text-muted"><span>Currency</span><span>{cart.currencyCode}</span></div></CardContent></Card>
  </div>;
}
