import type { Money, Order, ReturnInfo } from './types';

export type RefundApiResponse = {
  provider: string;
  providerRefundId: string;
  status: string;
  transactionState: 'Pending' | 'Success' | 'Failure';
  amount: Money;
  orderId: string;
  paymentId: string | null;
};

export const calculateReturnRefundCentAmount = (
  lineItems: NonNullable<Order['lineItems']>,
  returnItems: ReturnInfo['items']
) =>
  returnItems
    .filter((returnItem) => returnItem.paymentState !== 'Refunded')
    .reduce((total, returnItem) => {
      const lineItem = lineItems.find(
        (item) => item.id === (returnItem.lineItemId ?? returnItem.id)
      );
      if (!lineItem || lineItem.quantity <= 0) return total;
      return (
        total +
        Math.round(
          (lineItem.totalPrice.centAmount / lineItem.quantity) *
            returnItem.quantity
        )
      );
    }, 0);

export const parseRefundAmount = (
  value: string,
  fractionDigits: number
): number | undefined => {
  const normalized = value.trim().replace(/[^0-9.-]/g, '');
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const centAmount = Math.round(amount * 10 ** fractionDigits);
  return Number.isSafeInteger(centAmount) && centAmount > 0
    ? centAmount
    : undefined;
};

export const formatRefundInput = (centAmount: number, fractionDigits: number) =>
  (centAmount / 10 ** fractionDigits).toFixed(fractionDigits);

export const createRefundIdempotencyKey = (
  orderId: string,
  returnItemIds: string[]
) => {
  const suffix =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `csa-${orderId}-${[...returnItemIds]
    .sort()
    .join('-')}-${suffix}`.slice(0, 200);
};
