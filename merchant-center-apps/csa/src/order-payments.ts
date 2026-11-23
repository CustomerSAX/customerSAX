import type { Order, Payment } from './types';

type OrderPaymentSource = Pick<
  Order,
  | 'id'
  | 'orderNumber'
  | 'paymentState'
  | 'createdAt'
  | 'lastModifiedAt'
  | 'totalPrice'
  | 'paymentInfo'
>;

export const paymentMethodLabel = (payment: Payment) => {
  const name = payment.paymentMethodInfo?.name;
  if (typeof name === 'string') return name;
  if (name) return Object.values(name)[0] ?? '—';
  return payment.paymentMethodInfo?.method ?? '—';
};

export const paymentProviderLabel = (payment: Payment) =>
  payment.paymentMethodInfo?.paymentInterface ?? '—';

export const paymentStatusLabel = (
  payment: Payment,
  order: Pick<Order, 'paymentState'>
) =>
  payment.paymentStatus?.interfaceText ??
  payment.paymentStatus?.interfaceCode ??
  order.paymentState ??
  '—';

const transactionStateFor = (paymentState?: string | null) => {
  if (paymentState === 'Paid' || paymentState === 'Refunded') return 'Success';
  if (paymentState === 'Failed') return 'Failure';
  return 'Pending';
};

/**
 * Studio shows a demo payment preview for orders that only have an order-level
 * payment state. Keep the Merchant Center view useful for those same demo
 * orders, while preferring real linked commercetools Payment resources.
 */
export const paymentsForOrder = (order: OrderPaymentSource): Payment[] => {
  const linkedPayments = order.paymentInfo?.payments ?? [];
  if (linkedPayments.length > 0) return linkedPayments;
  if (order.totalPrice.centAmount <= 0 && !order.orderNumber) return [];

  const orderReference = order.orderNumber ?? order.id;
  const cleanReference = orderReference.replace(/[^a-zA-Z0-9_-]/g, '');
  const paymentState = order.paymentState ?? 'Pending';
  const transactionIdPrefix = order.id.slice(0, 8);
  const transactions: Payment['transactions'] = [
    {
      id: `txn_${transactionIdPrefix}_1`,
      timestamp: order.createdAt,
      type: 'Charge',
      state: transactionStateFor(paymentState),
      amount: order.totalPrice,
      interactionId: `int_${cleanReference}_1`,
    },
  ];

  if (paymentState === 'Refunded') {
    transactions.unshift({
      id: `txn_${transactionIdPrefix}_ref`,
      timestamp: order.lastModifiedAt,
      type: 'Refund',
      state: 'Success',
      amount: order.totalPrice,
      interactionId: `ref_${cleanReference}_1`,
    });
  }

  return [
    {
      id: `pay_${cleanReference}_1`,
      interfaceId: `pi_${transactionIdPrefix}`,
      createdAt: order.createdAt,
      lastModifiedAt: order.lastModifiedAt,
      amountPlanned: order.totalPrice,
      paymentMethodInfo: {
        paymentInterface: 'Adyen',
        method: 'Credit Card',
        name: 'Credit Card (Visa •••• 4242)',
      },
      paymentStatus: {
        interfaceCode:
          paymentState === 'Paid' ? 'succeeded' : paymentState.toLowerCase(),
        interfaceText:
          paymentState === 'Paid' ? 'succeeded' : paymentState.toLowerCase(),
      },
      transactions,
      isDerived: true,
    },
  ];
};
