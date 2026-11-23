import {
  exactSearchPredicate,
  formatMoney,
  idInPredicate,
  parseCsvPreview,
  rowsToCsv,
} from './utils';

describe('money formatting', () => {
  it.each(['AUD', 'USD', 'EUR'])(
    'shows the ISO currency code for %s',
    (code) => {
      expect(
        formatMoney({
          centAmount: 5700,
          currencyCode: code,
          fractionDigits: 2,
        })
      ).toContain(code);
    }
  );
});

describe('CSV utilities', () => {
  it('escapes commas, quotes, and newlines during export', () => {
    expect(
      rowsToCsv(
        ['name', 'note'],
        [{ name: 'Doe, Jane', note: 'Said "hello"\nagain' }]
      )
    ).toBe('name,note\r\n"Doe, Jane","Said ""hello""\nagain"');
  });

  it('parses quoted CSV values containing commas and newlines', () => {
    const result = parseCsvPreview(
      'email,note\r\njane@example.com,"first, second\nthird"'
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([['jane@example.com', 'first, second\nthird']]);
  });

  it('reports rows with the wrong number of columns', () => {
    expect(parseCsvPreview('email,name\none@example.com').errors).toContain(
      'Row 2 has 1 columns; expected 2.'
    );
  });
});

describe('predicate utilities', () => {
  it('escapes quotes instead of interpolating unsafe predicates', () => {
    expect(exactSearchPredicate('a" or id="b', ['email'])).toBe(
      '(email="a\\" or id=\\"b")'
    );
  });

  it('does not send partial text to UUID-only fields', () => {
    expect(exactSearchPredicate('aks', ['email', 'id'])).toBe('(email="aks")');
  });

  it('includes UUID-only fields when the value is a valid UUID', () => {
    const id = 'a81bc81b-dead-4e5d-abff-90865d1e13b1';
    expect(exactSearchPredicate(id, ['email', 'id'])).toBe(
      `(email="${id}" or id="${id}")`
    );
  });

  it('builds a safe predicate for customer search result IDs', () => {
    expect(idInPredicate(['first-id', 'second-id'])).toBe(
      'id in ("first-id", "second-id")'
    );
  });
});
