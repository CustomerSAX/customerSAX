import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { muiComponents } from './components';

describe('MUI select filter defaults', () => {
  it.each(['All statuses', 'All priorities'])('displays the empty-value option %s', (label) => {
    const html = renderToStaticMarkup(createElement(muiComponents.Select, {
      value: '',
      options: [{ value: '', label }, { value: 'Open', label: 'Open' }],
    }));
    expect(html).toMatch(new RegExp(`role="combobox"[^>]*>${label}</div>`));
  });

  it('displays the selected non-empty option', () => {
    const html = renderToStaticMarkup(createElement(muiComponents.Select, {
      value: 'Open',
      options: [{ value: '', label: 'All statuses' }, { value: 'Open', label: 'Open' }],
    }));
    expect(html).toMatch(/role="combobox"[^>]*>Open<\/div>/);
  });
});
