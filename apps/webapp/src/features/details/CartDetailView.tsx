"use client";

import Link from "next/link";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Icon,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@csa/ui";

interface CartDetailViewProps {
  id: string;
}

const cartItems = [
  { id: "1", name: "Warehouse Trolley (WT-100)", sku: "WT-100", price: "$249.00", qty: 1, total: "$249.00" },
  { id: "2", name: "Safety Gloves (SG-240)", sku: "SG-240", price: "$12.50", qty: 2, total: "$25.00" }
];

export function CartDetailView({ id }: CartDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Back link & Header */}
      <div>
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Carts
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <span>Cart Details</span>
              <Badge variant="primary" appearance="outline" size="md">
                {id}
              </Badge>
            </div>
          }
          subtitle="Active cart for Mia Johnson (mia@example.com) • Last updated today"
          badge={
            <Badge variant="success" appearance="subtle" size="md" dot>
              Active
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" leftIcon={<Icon name="file-text" size="xs" />}>
                Create Quote
              </Button>
              <Button variant="primary" size="md" leftIcon={<Icon name="shopping-bag" size="xs" />}>
                Convert to Order
              </Button>
            </div>
          }
        />
      </div>

      {/* Grid: Cart Items + Checkout Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Cart Items */}
        <div className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Cart Items ({cartItems.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-m-text">{item.name}</TableCell>
                      <TableCell><span className="font-mono text-xs">{item.sku}</span></TableCell>
                      <TableCell>{item.price}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" iconOnly leftIcon={<Icon name="minus" size="xs" />} aria-label="Decrease" />
                          <span className="font-semibold text-xs px-1">{item.qty}</span>
                          <Button variant="outline" size="sm" iconOnly leftIcon={<Icon name="plus" size="xs" />} aria-label="Increase" />
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-m-text">{item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Cart Totals & Discount Coupon Sidebar */}
        <aside className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Cart Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-m-text">Promo / Discount Code</span>
                <div className="flex items-center gap-2">
                  <Input placeholder="Enter code (e.g. SAVE10)" size="md" className="flex-1" />
                  <Button variant="secondary" size="md">Apply</Button>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-m-border">
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Subtotal</span>
                  <span className="font-semibold text-m-text">$274.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-m-text-muted">Estimated Tax</span>
                  <span className="font-semibold text-m-text">$0.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-m-text pt-2 border-t border-m-border">
                  <span>Cart Total</span>
                  <span className="text-m-primary">$274.00</span>
                </div>
              </div>

              <Button variant="primary" size="lg" fullWidth leftIcon={<Icon name="check-circle" size="sm" />}>
                Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
