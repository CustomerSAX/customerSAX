"use client";

import { Drawer, Button } from "@csa/ui";
import type { ProductCardArgs } from "../types";

export function ProductDetailDrawer({
  isOpen,
  onClose,
  product,
  onAddToCart,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: ProductCardArgs;
  /** Callback fired when the rep clicks Add to Cart. Handled by the parent
   *  (ChatStream's ToolCallCard dispatcher), which sends the order.add_item
   *  hidden-action to the AI so the real commerce flow handles it. */
  onAddToCart?: () => void;
}) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} position="right" size="md">
      <Drawer.Header title={product.name} subtitle={product.sku} onClose={onClose} />
      <Drawer.Content>
        {product.image && (
          <div className="h-64 overflow-hidden rounded-m-lg bg-m-surface-2 flex items-center justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.name} className="max-h-full object-contain" />
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold text-m-text">{product.price}</span>
            <span className="text-sm font-medium">{product.stock}</span>
          </div>
          {product.category && (
            <p className="text-sm text-m-text-muted">{product.category}</p>
          )}
          {product.description && (
            <div className="pt-4 border-t border-m-border">
              <h4 className="text-sm font-semibold mb-2">Description</h4>
              <p className="text-sm text-m-text leading-relaxed">{product.description}</p>
            </div>
          )}
        </div>
      </Drawer.Content>
      <Drawer.Footer>
        <Button variant="outline" onClick={onClose}>Close</Button>
        {onAddToCart && (
          <Button variant="primary" onClick={() => { onAddToCart(); onClose(); }}>
            Add to Cart
          </Button>
        )}
      </Drawer.Footer>
    </Drawer>
  );
}
