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

interface ProductDetailViewProps {
  id: string;
}

const variants = [
  { id: "var-1", sku: "WT-100-RED", attributes: "Color: Red, Material: Steel", price: "$249.00", stock: "In stock (42 units)" },
  { id: "var-2", sku: "WT-100-BLUE", attributes: "Color: Blue, Material: Steel", price: "$249.00", stock: "In stock (18 units)" },
  { id: "var-3", sku: "WT-100-BLK", attributes: "Color: Black, Material: Heavy-duty", price: "$269.00", stock: "Low stock (3 units)" }
];

export function ProductDetailView({ id }: ProductDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Back link & Header */}
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          Back to Products
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <span>Warehouse Heavy Duty Trolley</span>
              <Badge variant="primary" appearance="outline" size="md">
                {id}
              </Badge>
            </div>
          }
          subtitle="Industrial Equipment • Key: warehouse-trolley • Standard packaging"
          badge={
            <Badge variant="success" appearance="solid" size="md">
              Published
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" leftIcon={<Icon name="edit" size="xs" />}>
                Edit Product
              </Button>
            </div>
          }
        />
      </div>

      {/* Grid: Variants Table + Product Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Product Variants Table */}
        <div className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Product Variants ({variants.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant ID</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Attributes</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-bold text-m-primary">{v.id}</TableCell>
                      <TableCell><span className="font-mono text-xs">{v.sku}</span></TableCell>
                      <TableCell>{v.attributes}</TableCell>
                      <TableCell className="font-bold text-m-text">{v.price}</TableCell>
                      <TableCell>
                        <Badge variant={v.stock.includes("Low") ? "warning" : "success"} size="sm" dot>
                          {v.stock}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Product Attributes & Specifications Sidebar */}
        <aside className="space-y-6">
          <Card variant="default">
            <CardHeader className="p-4 border-b border-m-border">
              <CardTitle className="text-xs">Product Specifications</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-m-border/60 pb-2">
                <span className="text-m-text-muted">Product Type</span>
                <span className="font-semibold text-m-text">Industrial Equipment</span>
              </div>
              <div className="flex justify-between border-b border-m-border/60 pb-2">
                <span className="text-m-text-muted">Base Price</span>
                <span className="font-semibold text-m-primary">$249.00</span>
              </div>
              <div className="flex justify-between border-b border-m-border/60 pb-2">
                <span className="text-m-text-muted">Tax Category</span>
                <span className="font-semibold text-m-text">Standard Rate</span>
              </div>
              <div className="flex justify-between">
                <span className="text-m-text-muted">Master SKU</span>
                <span className="font-mono font-semibold text-m-text">WT-100</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
