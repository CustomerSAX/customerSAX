"use client";

/**
 * Watches the conversation's identified customer and resolves (or clears) the
 * matching active cart in CartStore. Mount once, high in the tree — renders nothing.
 */

import { useEffect } from 'react';
import { useConversationStore } from '../store/conversation-store';
import { useCartStore } from '../store/cart-store';

export function CartProvider() {
  const customerId = useConversationStore((s) => s.customer?.id ?? null);
  const customerEmail = useConversationStore((s) => s.customer?.email ?? null);

  useEffect(() => {
    void useCartStore.getState().resolveForCustomer(customerId, customerEmail ?? null);
  }, [customerId, customerEmail]);

  return null;
}
