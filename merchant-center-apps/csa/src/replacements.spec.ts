import { parseReplacementQuantity, replacementReference } from './replacements';

describe('replacementReference', () => {
  it('creates the durable link stored on the replacement order', () => {
    expect(replacementReference('order-1', 'return-1')).toBe(
      'CSA-RPL:order-1:return-1'
    );
  });
});

describe('parseReplacementQuantity', () => {
  it('accepts whole quantities within the returned quantity', () => {
    expect(parseReplacementQuantity(' 2 ', 3)).toBe(2);
  });

  it('rejects zero, fractional, and excessive quantities', () => {
    expect(parseReplacementQuantity('0', 3)).toBeUndefined();
    expect(parseReplacementQuantity('1.5', 3)).toBeUndefined();
    expect(parseReplacementQuantity('4', 3)).toBeUndefined();
  });
});
