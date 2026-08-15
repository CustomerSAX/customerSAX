"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  FormField,
  Label,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import {
  useCartStore,
  MOCK_CATALOG_PRODUCTS,
  MOCK_AVAILABLE_DISCOUNTS,
} from "../hooks/use-carts";
import type { CartLineItem } from "../types/cart-types";

interface CartDetailViewProps {
  id: string;
}

function ProductThumbnail({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-12 h-12 bg-m-bg border border-m-border rounded flex items-center justify-center text-[10px] font-bold text-m-text-muted shrink-0">
        NO IMG
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-12 h-12 object-contain rounded border border-m-border bg-white shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

export function CartDetailView({ id }: CartDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");
  const isB2b = pathname?.startsWith("/b2b");

  const {
    carts,
    getCartById,
    updateLineItemQuantity,
    addLineItemToCart,
    applyDiscountCode,
  } = useCartStore();

  const cart = getCartById(id) || carts[0];

  // Staged quantity input state
  const [stagedQuantities, setStagedQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    cart?.lineItems.forEach((li) => {
      initial[li.id] = li.quantity;
    });
    return initial;
  });

  // Catalog search state
  const [searchCatalogText, setSearchCatalogText] = useState("");
  const [searchCatalogResults, setSearchCatalogResults] = useState<typeof MOCK_CATALOG_PRODUCTS>([]);
  const [searchSelectedQty, setSearchSelectedQty] = useState<Record<string, number>>({});
  const [catalogFeedback, setCatalogFeedback] = useState("");

  // Discount code state
  const [selectedDiscountCode, setSelectedDiscountCode] = useState("");
  const [discountFeedback, setDiscountFeedback] = useState("");

  const handleUpdateLineItem = (lineItemId: string) => {
    const newQty = stagedQuantities[lineItemId] ?? 1;
    updateLineItemQuantity(cart.id, lineItemId, newQty);
  };

  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchCatalogText.trim().toLowerCase();
    if (!q) {
      setSearchCatalogResults([]);
      return;
    }
    const results = MOCK_CATALOG_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
    setSearchCatalogResults(results);
    const initialQty: Record<string, number> = {};
    results.forEach((r) => {
      initialQty[r.productId] = 1;
    });
    setSearchSelectedQty(initialQty);
  };

  const handleAddCatalogItemToCart = (prod: typeof MOCK_CATALOG_PRODUCTS[number]) => {
    const qty = searchSelectedQty[prod.productId] || 1;
    addLineItemToCart(cart.id, {
      productId: prod.productId,
      key: prod.key,
      name: prod.name,
      sku: prod.sku,
      imageUrl: prod.imageUrl,
      unitPrice: prod.unitPrice,
      quantity: qty,
    });
    setCatalogFeedback(`Added ${qty} × ${prod.name} to cart.`);
    setTimeout(() => setCatalogFeedback(""), 3500);
  };

  const handleApplyDiscountCode = () => {
    if (!selectedDiscountCode) return;
    applyDiscountCode(cart.id, selectedDiscountCode);
    setDiscountFeedback(`Applied promotional code ${selectedDiscountCode}.`);
    setSelectedDiscountCode("");
    setTimeout(() => setDiscountFeedback(""), 3500);
  };

  const canEditCart = cart.cartState === "Active" || cart.cartState === "Merged";
  const showConfigureQuote = isB2b && canEditCart && Boolean(cart.customerId) && cart.discountCodes.length === 0;

  const prefix = isB2b ? "/b2b" : "";
  const backTarget = customerIdParam
    ? `/customers/${customerIdParam}`
    : `${prefix}/cart`;

  return (
    <div className="space-y-6 pb-20">
      {/* Back Link & Header */}
      <div>
        <Link
          href={backTarget}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-m-primary hover:text-m-primary-600 mb-3"
        >
          <Icon name="arrow-left" size="xs" />
          {customerIdParam ? "Back to Customer Profile" : "Back to Carts"}
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <span>Cart Details</span>
              <Badge variant="primary" appearance="outline" size="md" className="font-mono">
                {cart.cartNumber || cart.id}
              </Badge>
            </div>
          }
          subtitle={`Active cart for ${cart.customerName} (${cart.customerEmail}) • Created ${new Date(cart.createdAt).toLocaleString()}`}
          badge={
            <Badge
              variant={cart.cartState === "Ordered" ? "success" : "primary"}
              appearance="subtle"
              size="md"
              dot
            >
              {cart.cartState}
            </Badge>
          }
          actions={
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push(backTarget)}
            >
              ← Back
            </Button>
          }
        />
      </div>

      {/* Customer Information Panel */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          {cart.customerId ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
                <span className="text-[10px] font-bold text-m-text-muted uppercase tracking-wider">Customer Name</span>
                <Link
                  href={`/customers/${cart.customerId}`}
                  className="font-bold text-m-primary hover:underline text-sm"
                >
                  {cart.customerName}
                </Link>
              </div>

              <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
                <span className="text-[10px] font-bold text-m-text-muted uppercase tracking-wider">Customer Email</span>
                <span className="font-semibold text-m-text text-sm">{cart.customerEmail}</span>
              </div>

              <div className="p-3 bg-m-bg rounded-md border border-m-border flex flex-col gap-1">
                <span className="text-[10px] font-bold text-m-text-muted uppercase tracking-wider">Country</span>
                <span className="font-semibold text-m-text text-sm">{cart.country || "US"}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-m-text-muted italic py-2">
              Guest (anonymous cart) — no customer assigned.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart Summary & Financial Breakdown Panel */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Cart Summary & Financial Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="space-y-4">
              <FormField>
                <Label>Order Number</Label>
                <Input value={cart.orderNumber || "--"} readOnly className="bg-m-bg font-mono" />
              </FormField>

              <FormField>
                <Label>Cart Status</Label>
                <Select
                  value={cart.cartState}
                  onChange={() => {}}
                  disabled
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Merged", label: "Merged" },
                    { value: "Frozen", label: "Frozen" },
                    { value: "Ordered", label: "Ordered" },
                  ]}
                />
              </FormField>
            </div>

            <div className="p-4 bg-m-bg rounded-lg border border-m-border flex flex-col justify-between space-y-3 text-xs">
              <div className="divide-y divide-m-border space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-m-text-muted">Country</span>
                  <span className="font-semibold text-m-text">{cart.country || "US"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-m-text-muted">Subtotal</span>
                  <span className="font-semibold text-m-text">${cart.netTotal.toFixed(2)}</span>
                </div>
                {cart.discountTotal > 0 && (
                  <div className="flex justify-between py-1 text-m-success font-semibold">
                    <span>Discount</span>
                    <span>-${cart.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-m-text-muted">Shipping</span>
                  <span className="font-semibold text-m-text">${cart.shippingTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-m-text-muted">Tax</span>
                  <span className="font-semibold text-m-text">${cart.taxTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t-2 border-m-border">
                <span className="text-sm font-bold text-m-text">Grand Total (with Tax & Shipping)</span>
                <span className="text-xl font-extrabold text-m-primary">${cart.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cart Items Panel */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Cart Line Items ({cart.lineItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cart.lineItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Sub Total</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead className="text-right">Total Gross</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.lineItems.map((item: CartLineItem) => (
                  <TableRow key={item.id}>
                    <TableCell className="flex items-center gap-3">
                      <ProductThumbnail src={item.imageUrl} />
                      <div>
                        <div className="font-bold text-xs text-m-text">{item.name}</div>
                        <div className="text-[10px] text-m-text-muted font-mono">
                          SKU: {item.sku} {item.key ? `· Key: ${item.key}` : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-m-text">${item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="w-20">
                        <Input
                          type="number"
                          min={1}
                          disabled={!canEditCart}
                          value={stagedQuantities[item.id] ?? item.quantity}
                          onChange={(e) =>
                            setStagedQuantities((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className="text-xs text-center"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!canEditCart || (stagedQuantities[item.id] ?? item.quantity) === item.quantity}
                        onClick={() => handleUpdateLineItem(item.id)}
                      >
                        Update
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs font-medium">${item.subtotal.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-m-text-muted">${item.tax.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-bold text-m-text text-right">
                      ${item.totalGross.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-xs text-m-text-muted italic py-4 text-center">
              No line items currently in this cart.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Line Items Panel */}
      {canEditCart && (
        <Card variant="default">
          <CardHeader>
            <CardTitle>Add Line Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {catalogFeedback && (
              <div className="p-2.5 bg-m-success-surface text-m-success text-xs font-semibold rounded-md">
                {catalogFeedback}
              </div>
            )}
            <form onSubmit={handleCatalogSearch} className="space-y-2">
              <Label>Search catalog products by name or SKU</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    value={searchCatalogText}
                    onChange={(e) => setSearchCatalogText(e.target.value)}
                    placeholder="Type product name (e.g. Chair, Headphones, Keyboard)..."
                  />
                </div>
                <Button type="submit" variant="primary" size="md">
                  Search
                </Button>
              </div>
            </form>

            {searchCatalogResults.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchCatalogResults.map((prod) => (
                    <TableRow key={prod.productId}>
                      <TableCell className="flex items-center gap-3">
                        <ProductThumbnail src={prod.imageUrl} />
                        <div>
                          <div className="font-bold text-xs text-m-text">{prod.name}</div>
                          <div className="text-[10px] text-m-text-muted font-mono">
                            SKU: {prod.sku} · Key: {prod.key}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">${prod.unitPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="w-20">
                          <Input
                            type="number"
                            min={1}
                            value={searchSelectedQty[prod.productId] || 1}
                            onChange={(e) =>
                              setSearchSelectedQty((prev) => ({
                                ...prev,
                                [prod.productId]: Number(e.target.value),
                              }))
                            }
                            className="text-xs text-center"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddCatalogItemToCart(prod)}
                        >
                          + Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cart Discounts Section */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Cart Discounts & Promotional Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {discountFeedback && (
            <div className="p-2 bg-m-success-surface text-m-success text-xs font-semibold rounded">
              {discountFeedback}
            </div>
          )}
          <FormField>
            <Label>Select Promotional Code</Label>
            <Select
              value={selectedDiscountCode}
              disabled={!canEditCart}
              onChange={(e) => setSelectedDiscountCode(e.target.value)}
              options={[
                { value: "", label: "Select discount code..." },
                ...MOCK_AVAILABLE_DISCOUNTS.map((d) => ({
                  value: d.code,
                  label: `${d.code} — ${d.name} (${d.value})`,
                })),
              ]}
            />
          </FormField>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canEditCart || !selectedDiscountCode}
              onClick={handleApplyDiscountCode}
            >
              Apply Discount Code
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedDiscountCode("")}
            >
              Reset
            </Button>
          </div>

          {/* Applied discounts */}
          {cart.appliedDiscounts && cart.appliedDiscounts.length > 0 && (
            <div className="pt-3 border-t border-m-border space-y-1">
              <span className="text-[10px] font-bold text-m-success-dark uppercase tracking-wider block">
                Applied Discounts
              </span>
              {cart.appliedDiscounts.map((row) => (
                <div key={row.code} className="text-xs font-semibold text-m-text">
                  🏷️ {row.code} {row.name ? `— ${row.name}` : ""} ({row.savings} saved)
                </div>
              ))}
            </div>
          )}

          {/* Ineffective discounts */}
          {cart.ineffectiveDiscounts && cart.ineffectiveDiscounts.length > 0 && (
            <div className="pt-3 border-t border-m-border space-y-1">
              <span className="text-[10px] font-bold text-m-warning-dark uppercase tracking-wider block">
                Not Applied
              </span>
              {cart.ineffectiveDiscounts.map((row) => (
                <div key={row.code} className="text-xs text-m-text-muted">
                  <span className="font-bold text-m-text">{row.code}:</span> {row.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-m-border shadow-lg flex items-center justify-between z-40 px-8">
        <Button variant="secondary" size="md" onClick={() => router.push(backTarget)}>
          Cancel
        </Button>
        <div className="flex items-center gap-3">
          {showConfigureQuote && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push(`${prefix}/cart/${cart.id}/address-details`)}
            >
              Configure Quote
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            disabled={!canEditCart || cart.lineItems.length === 0}
            onClick={() => router.push(`${prefix}/cart/${cart.id}/address-details`)}
          >
            Place Order →
          </Button>
        </div>
      </div>
    </div>
  );
}
