import {
  calculateReturnRefundCentAmount,
  formatRefundInput,
  parseRefundAmount,
} from './refunds';

describe('refund helpers', () => {
  it('calculates the amount for the non-refunded return quantities', () => {
    expect(
      calculateReturnRefundCentAmount(
        [
          {
            id: 'line-1',
            quantity: 2,
            totalPrice: {
              centAmount: 9000,
              currencyCode: 'AUD',
              fractionDigits: 2,
            },
          },
        ],
        [
          {
            id: 'return-1',
            lineItemId: 'line-1',
            quantity: 1,
            shipmentState: 'Returned',
            paymentState: 'Initial',
          },
          {
            id: 'return-2',
            lineItemId: 'line-1',
            quantity: 1,
            shipmentState: 'Returned',
            paymentState: 'Refunded',
          },
        ]
      )
    ).toBe(4500);
  });

  it('parses and formats currency input', () => {
    expect(parseRefundAmount('$45.00', 2)).toBe(4500);
    expect(parseRefundAmount('0', 2)).toBeUndefined();
    expect(parseRefundAmount('invalid', 2)).toBeUndefined();
    expect(formatRefundInput(4500, 2)).toBe('45.00');
  });
});
