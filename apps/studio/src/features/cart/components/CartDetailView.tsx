"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@csa/ui";
import {
  DetailPage,
  BackLink,
  EntityHeader,
  SummaryGrid,
  SummaryCard,
  ContentGrid,
  MainColumn,
  SideColumn,
  SectionCard,
  CardEmpty,
  StatusPill,
  PrimaryButton,
  SecondaryButton,
  InfoList,
  InfoRow,
} from "@/components/detail";
import { formatDateTime } from "@/lib/format-date";
import {
  useCartStore,
} from "../hooks/use-carts";
import type { CartLineItem } from "../types/cart-types";

interface CartDetailViewProps {
  id: string;
}

type CatalogProduct = {
  productId: string;
  name: string;
  sku: string;
  key?: string;
  unitPrice: number;
  imageUrl?: string;
};

type ProductSearchResult = {
  id?: string;
  sku?: string;
  name?: string;
  imageUrl?: string;
  price?: {
    centAmount?: number;
    currencyCode?: string;
    fractionDigits?: number;
  };
};

function toCatalogProduct(product: ProductSearchResult): CatalogProduct {
  const centAmount = product.price?.centAmount ?? 0;
  const fractionDigits = product.price?.fractionDigits ?? 2;
  return {
    productId: product.id || product.sku || "",
    name: product.name || product.sku || "Unnamed product",
    sku: product.sku || "",
    unitPrice: centAmount / 10 ** fractionDigits,
    imageUrl: product.imageUrl,
  };
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
    loading,
    error,
    getCartById,
    updateLineItemQuantity,
    addLineItemToCart,
  } = useCartStore();

  const cart = getCartById(id);

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
  const [searchCatalogResults, setSearchCatalogResults] = useState<CatalogProduct[]>([]);
  const [searchSelectedQty, setSearchSelectedQty] = useState<Record<string, number>>({});
  const [catalogFeedback, setCatalogFeedback] = useState("");

  useEffect(() => {
    if (!cart) return;
    const next: Record<string, number> = {};
    cart.lineItems.forEach((li) => {
      next[li.id] = li.quantity;
    });
    setStagedQuantities(next);
  }, [cart]);

  if (!cart) {
    return (
      <DetailPage>
        <BackLink href={isB2b ? "/b2b/cart" : "/cart"}>Back to Carts</BackLink>
        <CardEmpty
          icon="shopping-cart"
          title={loading ? "Loading cart" : "Cart not found"}
          hint={error || (loading ? "Fetching cart data from the commerce backend." : "No cart matched this ID.")}
        />
      </DetailPage>
    );
  }

  const handleUpdateLineItem = (lineItemId: string) => {
    const newQty = stagedQuantities[lineItemId] ?? 1;
    updateLineItemQuantity(cart.id, lineItemId, newQty);
  };

  const handleCatalogSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchCatalogText.trim();
    if (!q) {
      setSearchCatalogResults([]);
      return;
    }
    const response = await fetch(`/api/product-search?q=${encodeURIComponent(q)}`);
    const payload = (await response.json().catch(() => ({}))) as { results?: ProductSearchResult[] };
    const results = (payload.results ?? []).map(toCatalogProduct).filter((product) => product.productId);
    setSearchCatalogResults(results);
    const initialQty: Record<string, number> = {};
    results.forEach((r) => {
      initialQty[r.productId] = 1;
    });
    setSearchSelectedQty(initialQty);
  };

  const handleAddCatalogItemToCart = (prod: CatalogProduct) => {
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

  const canEditCart = cart.cartState === "Active" || cart.cartState === "Merged";
  const showConfigureQuote = isB2b && canEditCart && Boolean(cart.customerId) && cart.discountCodes.length === 0;

  const prefix = isB2b ? "/b2b" : "";
  const backTarget = customerIdParam
    ? `/customers/${customerIdParam}`
    : `${prefix}/cart`;

  return (
    <DetailPage>
      <BackLink href={backTarget}>
        {customerIdParam ? "Back to Customer Profile" : "Back to Carts"}
      </BackLink>

      <EntityHeader
        title={`Cart ${cart.cartNumber || cart.id}`}
        status={
          <StatusPill tone={cart.cartState === "Ordered" ? "success" : "primary"}>
            {cart.cartState}
          </StatusPill>
        }
        meta={`Active cart for ${cart.customerName} (${cart.customerEmail}) • Created ${formatDateTime(cart.createdAt)}`}
        actions={
          <>
            {showConfigureQuote && (
              <SecondaryButton onClick={() => router.push(`${prefix}/cart/${cart.id}/address-details`)}>
                Configure Quote
              </SecondaryButton>
            )}
            <PrimaryButton
              disabled={!canEditCart || cart.lineItems.length === 0}
              onClick={() => router.push(`${prefix}/cart/${cart.id}/address-details`)}
            >
              Place Order →
            </PrimaryButton>
          </>
        }
      />

      <SummaryGrid>
        <SummaryCard 
          icon="user" 
          label="Customer" 
          value={cart.customerName || "Guest"} 
          sub={cart.customerEmail || "No email"} 
        />
        <SummaryCard 
          icon="globe" 
          label="Country" 
          value={cart.country || "US"} 
        />
        <SummaryCard 
          icon="shopping-bag" 
          label="Items" 
          value={cart.lineItems.length} 
        />
        <SummaryCard 
          icon="dollar-sign" 
          label="Grand Total" 
          value={`$${cart.grandTotal.toFixed(2)}`} 
          tone="primary"
        />
      </SummaryGrid>

      <ContentGrid>
        <MainColumn span={8}>
          {/* Cart Items Panel */}
          <SectionCard title={`Cart Line Items (${cart.lineItems.length})`} icon="shopping-cart">
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
              <CardEmpty
                icon="shopping-cart"
                title="Cart is empty"
                hint="No line items currently in this cart."
              />
            )}
          </SectionCard>

          {/* Add Line Items Panel */}
          {canEditCart && (
            <SectionCard title="Add Line Items" icon="plus">
              <div className="space-y-4">
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
              </div>
            </SectionCard>
          )}
        </MainColumn>

        <SideColumn span={4}>
          <SectionCard title="Cart Summary" icon="bar-chart-2">
            <InfoList>
              <InfoRow label="Order Number" value={cart.orderNumber || "--"} mono />
              <InfoRow label="Cart Status" value={cart.cartState} />
              <InfoRow label="Country" value={cart.country || "US"} />
            </InfoList>
            
            <div className="mt-4 pt-4 border-t border-m-border space-y-2 text-xs">
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

            <div className="flex justify-between items-center pt-3 mt-3 border-t-2 border-m-border">
              <span className="text-[13px] font-bold text-m-text">Grand Total</span>
              <span className="text-lg font-extrabold text-m-primary">${cart.grandTotal.toFixed(2)}</span>
            </div>
          </SectionCard>

          {/* Cart Discounts Section */}
          <SectionCard title="Discounts" icon="tag">
            <div className="space-y-4">
              <div className="rounded border border-m-border bg-m-surface-2 p-3 text-xs text-m-text-muted">
                Discount code lookup is not exposed by the commerce backend yet.
              </div>

              {/* Applied discounts */}
              {cart.appliedDiscounts && cart.appliedDiscounts.length > 0 && (
                <div className="pt-3 mt-2 border-t border-m-border space-y-1">
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
                <div className="pt-3 mt-2 border-t border-m-border space-y-1">
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
            </div>
          </SectionCard>
        </SideColumn>
      </ContentGrid>
    </DetailPage>
  );
}
