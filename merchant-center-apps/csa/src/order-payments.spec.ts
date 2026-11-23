import { paymentMethodLabel, paymentsForOrder } from './order-payments';
import type { Order, Payment } from './types';

const order = {
  id: '36745630-1234-5678-9012-123456789012',
  version: 1,
  orderNumber: 'SPL-AU-100251',
  customerEmail: 'customer@example.com',
  orderState: 'Complete',
  paymentState: 'Paid',
  shipmentState: 'Shipped',
  createdAt: '2026-11-19T12:39:00.000Z',
  lastModifiedAt: '2026-11-19T12:39:00.000Z',
  totalPrice: {
    centAmount: 4600,
    currencyCode: 'AUD',
    fractionDigits: 2,
  },
} satisfies Order;

describe('order payments', () => {
  it('prefers linked commercetools payments', () => {
    const linkedPayment: Payment = {
      id: 'payment-id',
      amountPlanned: order.totalPrice,
      transactions: [],
    };

    expect(
      paymentsForOrder({
        ...order,
        paymentInfo: { payments: [linkedPayment] },
      })
    ).toEqual([linkedPayment]);
  });

  it('creates the Studio-compatible preview when no payment is linked', () => {
    const [payment] = paymentsForOrder(order);

    expect(payment).toMatchObject({
      id: 'pay_SPL-AU-100251_1',
      interfaceId: 'pi_36745630',
      isDerived: true,
      paymentStatus: { interfaceCode: 'succeeded' },
    });
    expect(paymentMethodLabel(payment)).toBe('Credit Card (Visa •••• 4242)');
    expect(payment.transactions).toEqual([
      expect.objectContaining({
        type: 'Charge',
        state: 'Success',
        interactionId: 'int_SPL-AU-100251_1',
      }),
    ]);
  });
});
