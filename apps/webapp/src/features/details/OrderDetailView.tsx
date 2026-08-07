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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@csa/ui";

interface OrderDetailViewProps {
  id: string;
}

const lineItems = [
  { id: "1", name: "Warehouse Trolley (WT-100)", sku: "WT-100", price: "$249.00", quantity: 1, total: "$249.00" },
  { id: "2", name: "Safety Gloves (SG-240)", sku: "SG-240", price: "$12.50", quantity: 4, total: "$50.00" },
  { id: "3", name: "Packing Tape (PT-500)", sku: "PT-500", price: "$6.20", quantity: 7, total: "$43.20" }
];

export function OrderDetailView({ id }: OrderDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Back link & Header */}
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Orders
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <span>Order Details</span>
              <Badge variant="primary" appearance="outline" size="md">
                {id}
              </Badge>
            </div>
          }
          subtitle="Placed on Aug 05, 2026 • Customer: Mia Johnson (mia@example.com)"
          badge={
            <Badge variant="warning" appearance="subtle" size="md" dot>
              Processing
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" leftIcon={<Icon name="printer" size="xs" />}>
                Print Invoice
              </Button>
              <Button variant="primary" size="md" leftIcon={<Icon name="truck" size="xs" />}>
                Update Fulfillment
              </Button>
            </div>
          }
        />
      </div>

      {/* Fulfillment Status Banner */}
      <Card variant="flat" className="p-4 flex items-center justify-between border-l-4 border-l-m-primary">
        <div className="flex items-center gap-3">
          <Icon name="package-check" className="text-m-primary" size="md" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-m-text">Payment Captured • Fulfillment Pending</span>
            <span className="text-[11px] text-m-text-muted">FedEx Express tracking code will generate upon dispatch</span>
          </div>
        </div>
        <Badge variant="primary" size="sm">
          Express Delivery
        </Badge>
      </Card>

      {/* Grid: Order Line Items + Summary Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Line Items Table */}
        <div className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Purchased Line Items ({lineItems.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-m-text">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-m-md bg-m-surface-2 text-m-text-muted">
                            <Icon name="package" size="xs" />
                          </div>
                          <span>{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-mono text-xs">{item.sku}</span></TableCell>
                      <TableCell>{item.price}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="font-bold text-m-text">{item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Shipping & Billing Addresses */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card variant="default">
              <CardHeader className="p-4 border-b border-m-border">
                <CardTitle className="text-xs">Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-1 text-m-text-muted leading-relaxed">
                <p className="font-bold text-m-text">Mia Johnson</p>
                <p>742 Evergreen Terrace</p>
                <p>Springfield, OR 97477</p>
                <p>United States</p>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader className="p-4 border-b border-m-border">
                <CardTitle className="text-xs">Billing Address</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-1 text-m-text-muted leading-relaxed">
                <p className="font-bold text-m-text">Mia Johnson</p>
                <p>742 Evergreen Terrace</p>
                <p>Springfield, OR 97477</p>
                <p>United States</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Payment Totals Summary */}
        <aside className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-m-border/60 pb-2">
                <span className="text-m-text-muted">Subtotal</span>
                <span className="font-semibold text-m-text">$342.20</span>
              </div>
              <div className="flex justify-between border-b border-m-border/60 pb-2">
                <span className="text-m-text-muted">Shipping (Express)</span>
                <span className="font-semibold text-m-success">Free</span>
              </div>
              <div className="flex justify-between border-b border-m-border/60 pb-2">
                <span className="text-m-text-muted">Estimated Tax</span>
                <span className="font-semibold text-m-text">$0.00</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-bold text-m-text">
                <span>Total Amount</span>
                <span className="text-m-primary">$342.20</span>
              </div>

              <div className="pt-3 border-t border-m-border space-y-2">
                <span className="text-[11px] font-semibold text-m-text-muted uppercase tracking-wider">Payment Details</span>
                <div className="flex items-center justify-between p-2.5 rounded-m-md border border-m-border bg-m-surface-2">
                  <div className="flex items-center gap-2">
                    <Icon name="credit-card" size="xs" className="text-m-primary" />
                    <span className="text-xs font-medium text-m-text">Credit Card (Visa ****4242)</span>
                  </div>
                  <Badge variant="success" size="sm">Paid</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
